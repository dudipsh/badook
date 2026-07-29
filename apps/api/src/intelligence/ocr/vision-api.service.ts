import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';
import * as path from 'path';
import {
  preprocessImage,
  safeParseJson,
  callGemini,
  callGeminiFinetuned,
  callOpenAI,
  type PreprocessLevel,
  type AiImage,
} from '@budapest/ai-core';
import { GEMINI_MODEL, OPENAI_MODEL } from '../../common/ai-models';
import type { OcrProviderType } from '../../common/ai-models';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ApiUsageLoggerService } from '../../common/services/api-usage-logger.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import {
  validateMathematics,
} from './ocr-validators';

const AI_CALL_TIMEOUT_MS = 120_000; // 2 minutes per AI API call

@Injectable()
export class VisionApiService {
  private readonly logger = new Logger(VisionApiService.name);
  private readonly openai: OpenAI;
  private readonly gemini: GoogleGenerativeAI;
  private vertexAI: VertexAI | null = null;
  private providerCache: { companyId: string; provider: OcrProviderType; ts: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly usageLogger: ApiUsageLoggerService,
    private readonly storage: StorageService,
  ) {
    this.openai = new OpenAI({ apiKey: this.config.get('openai.apiKey') });
    this.gemini = new GoogleGenerativeAI(this.config.get('gemini.apiKey') || '');

    const projectId = this.config.get<string>('gcp.projectId');
    const location = this.config.get<string>('gcp.location') || 'us-central1';
    if (projectId) {
      this.vertexAI = new VertexAI({ project: projectId, location });
      this.logger.log(`Vertex AI initialized: project=${projectId}, location=${location}`);
    }
  }

  async getProvider(companyId: string): Promise<OcrProviderType> {
    const now = Date.now();
    // Short TTL so users see provider changes within 30s of saving in Settings.
    if (this.providerCache && this.providerCache.companyId === companyId && now - this.providerCache.ts < 30_000) {
      return this.providerCache.provider;
    }
    const scanSettings = await this.prisma.companyScanSettings.findUnique({ where: { companyId } });
    const provider = (scanSettings?.ocrProvider as OcrProviderType) ?? 'GEMINI';
    this.providerCache = { companyId, provider, ts: now };
    return provider;
  }

  async readFile(
    filePath: string, level: PreprocessLevel = 'normal', provider?: OcrProviderType,
  ): Promise<{ images: Array<{ base64: string; mimeType: string }> }> {
    const ext = path.extname(filePath).toLowerCase();
    const buffer = await this.storage.getBuffer(filePath);

    if (ext === '.pdf') {
      // Gemini (regular + fine-tuned) supports native PDF processing — send raw PDF bytes for best quality.
      if (provider === 'GEMINI' || provider === 'GEMINI_FINETUNED') {
        this.logger.log(`Sending PDF natively to Gemini (${provider}): ${path.basename(filePath)}`);
        return { images: [{ base64: buffer.toString('base64'), mimeType: 'application/pdf' }] };
      }

      // OpenAI: convert to PNG via mupdf (OpenAI chat completions doesn't accept inline PDFs)
      try {
        const mupdf: any = await (Function('return import("mupdf")')());
        const m = mupdf.default || mupdf;
        const doc = m.Document.openDocument(buffer, 'application/pdf');
        const pageCount = doc.countPages();
        const images: Array<{ base64: string; mimeType: string }> = [];

        for (let i = 0; i < pageCount; i++) {
          const page = doc.loadPage(i);
          const matrix = m.Matrix.scale(3, 3);
          const pixmap = page.toPixmap(matrix, m.ColorSpace.DeviceRGB);
          const pngBuf = pixmap.asPNG();
          const pdfLevel: PreprocessLevel = level === 'aggressive' ? 'aggressive' : 'pdf-scanned';
          const processed = await preprocessImage(Buffer.from(pngBuf), pdfLevel);
          images.push({ base64: processed.toString('base64'), mimeType: 'image/png' });
        }

        this.logger.log(`Converted PDF (${pageCount} pages) to PNG (OpenAI): ${path.basename(filePath)}`);
        return { images };
      } catch (err) {
        this.logger.warn(`PDF-to-image conversion failed, sending as PDF: ${err}`);
        return { images: [{ base64: buffer.toString('base64'), mimeType: 'application/pdf' }] };
      }
    }

    // Non-PDF images (JPEG/PNG from phone cameras): preprocess for better OCR quality
    const processed = await preprocessImage(buffer, level);
    return { images: [{ base64: processed.toString('base64'), mimeType: 'image/png' }] };
  }

  async callVisionApi(
    images: Array<{ base64: string; mimeType: string }>, prompt: string, provider: OcrProviderType,
    companyId?: string, operation?: string,
  ): Promise<string> {
    this.logger.log(`Using OCR provider: ${provider}, images: ${images.length}`);
    const isMultiDoc = operation === 'OCR_MULTI_DOC_DETECT';
    const maxRetries = 3;
    let lastError: Error | null = null;
    const tunedModelName = this.config.get<string>('gcp.tunedModel') || 'gemini-finetuned';
    const model = provider === 'GEMINI' ? GEMINI_MODEL
      : provider === 'GEMINI_FINETUNED' ? tunedModelName
      : OPENAI_MODEL;

    // Use 16384 tokens for extraction calls (multi-page POs can have many line items)
    const maxTokens = isMultiDoc ? 8192 : 16384;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = provider === 'GEMINI_FINETUNED'
          ? await this.callGeminiFinetunedVertex(images, prompt)
          : provider === 'GEMINI'
            ? await this.callGeminiVisionApi(images, prompt)
            : await this.callOpenAiVisionApi(images, prompt, maxTokens);
        if (companyId && operation) {
          this.usageLogger.logUsage({ companyId, provider, model, operation, promptTokens: result.promptTokens, completionTokens: result.completionTokens });
        }

        // Detect truncation: if OpenAI hit the token limit, the response may be incomplete
        if (result.truncated) {
          this.logger.warn(`[TRUNCATION] OpenAI response was truncated (finish_reason=length) for ${operation} on ${images.length} pages. Output may be incomplete.`);
        }

        return result.content;
      } catch (err) {
        lastError = err as Error;
        const is429 = lastError.message?.includes('429') || lastError.message?.includes('RESOURCE_EXHAUSTED') || lastError.message?.includes('rate');
        if (is429 && attempt < maxRetries - 1) {
          const delay = (attempt + 1) * 5000;
          this.logger.warn(`Rate limited (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError!;
  }

  private async callOpenAiVisionApi(
    images: AiImage[], prompt: string, maxTokens = 16384,
  ): Promise<{ content: string; promptTokens: number; completionTokens: number; truncated: boolean }> {
    return callOpenAI(this.openai, images, prompt, {
      model: OPENAI_MODEL,
      maxTokens,
      timeoutMs: AI_CALL_TIMEOUT_MS,
    });
  }

  private async callGeminiVisionApi(
    images: AiImage[], prompt: string,
  ): Promise<{ content: string; promptTokens: number; completionTokens: number; truncated: boolean }> {
    const result = await callGemini(this.gemini, images, prompt, {
      model: GEMINI_MODEL,
      timeoutMs: AI_CALL_TIMEOUT_MS,
    });
    return { ...result, truncated: false };
  }

  private async callGeminiFinetunedVertex(
    images: AiImage[], prompt: string,
  ): Promise<{ content: string; promptTokens: number; completionTokens: number; truncated: boolean }> {
    const tunedModel = this.config.get<string>('gcp.tunedModel');
    if (!this.vertexAI || !tunedModel) {
      throw new Error('Vertex AI not configured. Set GCP_PROJECT_ID and VERTEX_TUNED_MODEL in env.');
    }
    this.logger.log(`Calling fine-tuned Gemini (${tunedModel}) with ${images.length} images`);
    const result = await callGeminiFinetuned(this.vertexAI, images, prompt, {
      tunedModel,
      timeoutMs: AI_CALL_TIMEOUT_MS,
    });
    return { ...result, truncated: false };
  }

  private get verbose(): boolean {
    return this.config.get<boolean>('scanLog.verbose') ?? true;
  }

  private logRawLineItems(fname: string, parsed: any, attempt: number): void {
    if (!this.verbose) return;
    const items = parsed?.lineItems;
    if (!Array.isArray(items) || items.length === 0) return;
    this.logger.log(`[OCR-DEBUG] [RAW] ${fname} (attempt ${attempt}) — ${items.length} line items:`);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      this.logger.log(
        `[OCR-DEBUG] [RAW] ${fname} | Line ${i + 1}: desc="${(it.description || '').slice(0, 50)}" qty=${it.quantity} unitPrice=${it.unitPrice} totalPrice=${it.totalPrice}`,
      );
    }
  }

  async parseWithRetry<T extends { confidence?: number }>(
    filePath: string, companyId: string, prompt: string, operation: string,
  ): Promise<T> {
    const provider = await this.getProvider(companyId);
    const fname = path.basename(filePath);
    let bestResult: T | null = null;
    let bestConfidence = 0;
    let usedAttempt = 0;

    this.logger.log(`[parseWithRetry] START ${fname} | provider=${provider} | operation=${operation}`);

    // Attempt 1: For Gemini + PDF, send the raw PDF directly (native processing, best quality).
    // For OpenAI or image files, use standard preprocessing pipeline.
    try {
      const { images } = await this.readFile(filePath, 'normal', provider);
      this.logger.log(`[parseWithRetry] Attempt 1: ${fname} | provider=${provider} | preprocessing=normal | mimeTypes=${images.map(i => i.mimeType).join(',')}`);
      const content = await this.callVisionApi(images, prompt, provider, companyId, operation);
      bestResult = this.safeParseJson<T>(content, filePath);
      bestConfidence = (bestResult as any).confidence ?? 0;
      usedAttempt = 1;
      const lineItemCount = (bestResult as any).lineItems?.length ?? 'N/A';
      this.logger.log(`[parseWithRetry] Attempt 1 result: ${fname} | confidence=${bestConfidence.toFixed(2)} | lineItems=${lineItemCount}`);
      this.logRawLineItems(fname, bestResult, 1);
    } catch (err) {
      this.logger.warn(`OCR parse attempt 1 failed for ${fname}: ${err}`);
    }

    if (bestResult && bestConfidence >= 0.7) {
      this.logger.log(`[parseWithRetry] DONE ${fname} | usedAttempt=${usedAttempt} | finalConfidence=${bestConfidence.toFixed(2)}`);
      return bestResult;
    }

    // Attempt 2: Aggressive preprocessing + primary provider (PNG fallback for Gemini too)
    this.logger.log(`Low confidence (${bestConfidence.toFixed(2)}), retrying with aggressive preprocessing: ${fname}`);
    try {
      const { images } = await this.readFile(filePath, 'aggressive'); // Always PNG on retry
      this.logger.log(`[parseWithRetry] Attempt 2: ${fname} | provider=${provider} | preprocessing=aggressive | mimeTypes=${images.map(i => i.mimeType).join(',')}`);
      const content = await this.callVisionApi(images, prompt, provider, companyId, `${operation}_RETRY_AGG`);
      const result = this.safeParseJson<T>(content, filePath);
      const conf = (result as any).confidence ?? 0;
      const lineItemCount = (result as any).lineItems?.length ?? 'N/A';
      this.logger.log(`[parseWithRetry] Attempt 2 result: ${fname} | confidence=${conf.toFixed(2)} | lineItems=${lineItemCount}`);
      this.logRawLineItems(fname, result, 2);
      if (conf > bestConfidence) {
        bestResult = result;
        bestConfidence = conf;
        usedAttempt = 2;
      }
    } catch (err) {
      this.logger.warn(`OCR retry (aggressive) failed for ${fname}: ${err}`);
    }

    if (bestResult && bestConfidence >= 0.5) {
      this.logger.log(`[parseWithRetry] DONE ${fname} | usedAttempt=${usedAttempt} | finalConfidence=${bestConfidence.toFixed(2)}`);
      return bestResult;
    }

    // Attempt 3: Aggressive preprocessing + alternate provider (if configured).
    // Fine-tuned Gemini is an upgrade of GEMINI — fall back to base Gemini before OpenAI.
    const altProvider: OcrProviderType = provider === 'OPENAI'
      ? 'GEMINI'
      : provider === 'GEMINI_FINETUNED'
        ? 'GEMINI'
        : 'OPENAI';
    const altConfigured = altProvider === 'OPENAI'
      ? !!this.config.get('openai.apiKey')
      : !!this.config.get('gemini.apiKey');

    if (altConfigured) {
      this.logger.log(`Still low confidence (${bestConfidence.toFixed(2)}), trying alternate provider ${altProvider}: ${fname}`);
      try {
        const { images } = await this.readFile(filePath, 'aggressive');
        this.logger.log(`[parseWithRetry] Attempt 3: ${fname} | provider=${altProvider} (alternate) | preprocessing=aggressive`);
        const content = await this.callVisionApi(images, prompt, altProvider, companyId, `${operation}_RETRY_ALT`);
        const result = this.safeParseJson<T>(content, filePath);
        const conf = (result as any).confidence ?? 0;
        const lineItemCount = (result as any).lineItems?.length ?? 'N/A';
        this.logger.log(`[parseWithRetry] Attempt 3 result: ${fname} | confidence=${conf.toFixed(2)} | lineItems=${lineItemCount}`);
        this.logRawLineItems(fname, result, 3);
        if (conf > bestConfidence) {
          bestResult = result;
          bestConfidence = conf;
          usedAttempt = 3;
        }
      } catch (err) {
        this.logger.warn(`OCR retry (alt provider ${altProvider}) failed for ${fname}: ${err}`);
      }
    } else {
      this.logger.warn(`[parseWithRetry] Alternate provider ${altProvider} not configured — skipping attempt 3`);
    }

    if (bestResult) {
      this.logger.log(`[parseWithRetry] DONE ${fname} | usedAttempt=${usedAttempt} | finalConfidence=${bestConfidence.toFixed(2)}`);
      return bestResult;
    }
    throw new Error(`All OCR attempts failed for ${fname}`);
  }

  safeParseJson<T>(content: string, context: string): T {
    return safeParseJson<T>(content, context);
  }

  /**
   * Attempts one math-correction retry if validateMathematics finds significant errors.
   * Feeds the specific math warnings back to the AI as correction instructions.
   */
  async attemptMathCorrection<T extends { confidence: number; notes?: string | null; lineItems?: any[] }>(
    initialResult: T,
    filePath: string,
    companyId: string,
    prompt: string,
    operation: string,
  ): Promise<T> {
    const mathCheck = validateMathematics(initialResult);

    if (mathCheck.warnings.length === 0 || mathCheck.confidencePenalty < 0.1) {
      return initialResult;
    }

    // Only re-extract for per-line math errors (qty × price ≠ total).
    // Aggregate mismatches (sum ≠ subtotal, subtotal+VAT ≠ total) are often caused
    // by wrong subtotal/total values, not wrong line items. Re-extraction for these
    // risks column swaps (qty↔price) without fixing the actual issue.
    const hasPerLineErrors = mathCheck.warnings.some((w) => w.startsWith('Line '));
    if (!hasPerLineErrors) {
      this.logger.log(
        `Math: only aggregate mismatches (no per-line errors) in ${path.basename(filePath)} — skipping re-extraction to avoid column swap risk`,
      );
      return initialResult;
    }

    this.logger.log(
      `Math errors in ${path.basename(filePath)}, retrying: ${mathCheck.warnings.join('; ')}`,
    );

    const mathSuffix = mathCheck.warnings.map((w, i) => `${i + 1}. ${w}`).join('\n');
    const correctionPrompt = prompt +
      `\n\nMATH VALIDATION ERRORS (fix these arithmetic issues from previous attempt):\n${mathSuffix}\n\n` +
      `Re-read the document carefully and fix values so: quantity × unitPrice = totalPrice for each line, sum of line totals = subtotal, subtotal + VAT = total.\n` +
      `IMPORTANT: Do NOT swap quantity and price columns. Read values from the same columns as before. Only fix values that were misread from the document.`;

    try {
      const corrected = await this.parseWithRetry<T>(filePath, companyId, correctionPrompt, `${operation}_MATH_FIX`);
      const correctedMath = validateMathematics(corrected);

      if (correctedMath.confidencePenalty < mathCheck.confidencePenalty) {
        this.logger.log(
          `Math correction improved: penalty ${mathCheck.confidencePenalty} → ${correctedMath.confidencePenalty}`,
        );
        return corrected;
      }
      return initialResult;
    } catch (err) {
      this.logger.warn(`Math correction retry failed: ${err}`);
      return initialResult;
    }
  }
}
