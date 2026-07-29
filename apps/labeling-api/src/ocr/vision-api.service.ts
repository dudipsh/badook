import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';
import * as path from 'path';
import * as fs from 'fs';
import {
  preprocessImage,
  safeParseJson,
  callGemini,
  callGeminiFinetuned,
  type PreprocessLevel,
  type AiImage,
} from '@budapest/ai-core';
import { GEMINI_MODEL, MODEL_PRICING } from '../common/ai-models';

const AI_CALL_TIMEOUT_MS = 120_000;

@Injectable()
export class VisionApiService {
  private readonly logger = new Logger(VisionApiService.name);
  private readonly gemini: GoogleGenerativeAI;
  private vertexAI: VertexAI | null = null;

  constructor(private readonly config: ConfigService) {
    this.gemini = new GoogleGenerativeAI(this.config.get('GEMINI_API_KEY') || '');

    const projectId = this.config.get('GCP_PROJECT_ID');
    const location = this.config.get('GCP_LOCATION') || 'us-central1';
    if (projectId) {
      this.vertexAI = new VertexAI({ project: projectId, location });
      this.logger.log(`Vertex AI initialized: project=${projectId}, location=${location}`);
    }
  }

  async readFile(
    filePath: string,
    level: PreprocessLevel = 'normal',
  ): Promise<AiImage[]> {
    const ext = path.extname(filePath).toLowerCase();
    const buffer = fs.readFileSync(filePath);

    if (ext === '.pdf') {
      // Send PDF natively to Gemini
      this.logger.log(`Sending PDF natively to Gemini: ${path.basename(filePath)}`);
      return [{ base64: buffer.toString('base64'), mimeType: 'application/pdf' }];
    }

    // Non-PDF: preprocess
    const processed = await preprocessImage(buffer, level);
    return [{ base64: processed.toString('base64'), mimeType: 'image/png' }];
  }

  async readFileAsImage(
    filePath: string,
    level: PreprocessLevel = 'pdf-scanned',
  ): Promise<AiImage[]> {
    const ext = path.extname(filePath).toLowerCase();
    const buffer = fs.readFileSync(filePath);

    if (ext === '.pdf') {
      // Convert PDF pages to images using sharp/mupdf fallback
      this.logger.log(`Converting PDF to binarized PNG: ${path.basename(filePath)}`);
      try {
        const { fromBuffer } = await import('pdf2pic');
        const converter = fromBuffer(buffer, {
          density: 300,
          format: 'png',
          width: 2400,
          height: 3400,
        });
        const pages = await converter.bulk(-1, { responseType: 'buffer' });
        const results: AiImage[] = [];
        for (const page of pages) {
          if (page.buffer) {
            const processed = await preprocessImage(page.buffer, level);
            results.push({ base64: processed.toString('base64'), mimeType: 'image/png' });
          }
        }
        if (results.length > 0) return results;
      } catch (err) {
        this.logger.warn(`pdf2pic conversion failed, falling back to native PDF: ${err}`);
      }
      // Fallback: send native PDF
      return [{ base64: buffer.toString('base64'), mimeType: 'application/pdf' }];
    }

    const processed = await preprocessImage(buffer, level);
    return [{ base64: processed.toString('base64'), mimeType: 'image/png' }];
  }

  async callGemini(
    images: AiImage[],
    prompt: string,
  ): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
    return callGemini(this.gemini, images, prompt, {
      model: GEMINI_MODEL,
      timeoutMs: AI_CALL_TIMEOUT_MS,
    });
  }

  async callGeminiFinetuned(
    images: AiImage[],
    prompt: string,
  ): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
    const tunedModel = this.config.get<string>('VERTEX_TUNED_MODEL');
    if (!this.vertexAI || !tunedModel) {
      throw new Error('Vertex AI not configured. Set GCP_PROJECT_ID and VERTEX_TUNED_MODEL in .env.');
    }
    this.logger.log(`Calling fine-tuned Gemini (${tunedModel}) with ${images.length} images`);
    return callGeminiFinetuned(this.vertexAI, images, prompt, {
      tunedModel,
      timeoutMs: AI_CALL_TIMEOUT_MS,
    });
  }

  safeParseJson<T>(content: string, context: string): T {
    return safeParseJson<T>(content, context);
  }

  estimateCost(promptTokens: number, completionTokens: number): number {
    const pricing = MODEL_PRICING[GEMINI_MODEL];
    return (
      (promptTokens * pricing.input + completionTokens * pricing.output) /
      1_000_000
    );
  }
}
