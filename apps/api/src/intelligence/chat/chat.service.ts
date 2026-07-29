import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { GoogleGenerativeAI, FunctionCall, Part } from '@google/generative-ai';
import { Observable } from 'rxjs';
import { ChatAgent, ChatAttachment, ChatAttachmentType, ChatProvider, ChatRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { ChatCard, ChatCardKind, ChatMessageScope, ChatStreamEvent } from './chat.types';
import { ChatToolContext, ChatToolsService } from './chat-tools.service';
import { CHAT_TOOL_DECLARATIONS } from './chat-tools.definitions';
import { AiSettingsService } from '../ai-management/ai-settings.service';
import { AiQuotaService } from '../ai-management/ai-quota.service';
import { resolveChatGeminiModel } from '../ai-management/ai-models.catalog';

const MAX_TOOL_ITERATIONS = 5;

const TOOL_CARD_KINDS: Record<string, ChatCardKind> = {
  get_company_overview: 'company_overview',
  get_project_summary: 'project_summary',
  list_projects: 'project_list',
  list_suppliers: 'supplier_list',
  list_discrepancies: 'discrepancy_list',
  aggregate_item_supply: 'item_supply_summary',
  list_item_documents: 'item_documents',
};

/** A single streamed delta — either a text token or a rich card surfaced from a tool. */
type StreamDelta = { type: 'text'; text: string } | { type: 'card'; card: ChatCard };

// flash-lite has thinking OFF by default, so a tiny output budget yields a clean
// title. gemini-2.5-flash (a thinking model) burned the whole budget on hidden
// reasoning and returned a one-letter fragment (e.g. "ה").
const TITLE_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_TITLE = 'שיחה חדשה';

// Appended to the data agent's system prompt at runtime so it holds in prod
// regardless of the (DB-stored, super-admin-editable) prompt. Tools return raw
// record ids the model needs to chain calls — but it must never echo them.
const TOOL_DISPLAY_GUARDRAILS =
  '\n\nחשוב: מזהים פנימיים (id/cuid) של פרויקטים, מסמכים, ספקים וכו\' הם לשימושך הפנימי בלבד כדי לקרוא לכלים. לעולם אל תציג אותם למשתמש — הצג שמות וכותרות ידידותיים בלבד.';
// Markdown is rendered client-side; nudge the model to use it + lead with the
// number when answering quantity/price questions.
const FORMATTING_GUIDELINES =
  '\n\nעיצוב תשובות: השתמש ב-Markdown — הדגשות, רשימות וטבלאות קצרות כשמציגים נתונים. ' +
  'בשאלות כמות/מחיר פתח במשפט תשובה ישיר עם המספר המודגש, ואז פירוט קצר. ' +
  'אל תשכפל בטקסט נתונים שכבר מופיעים בכרטיס שצורף.';
const VISION_FALLBACK_MODEL_OPENAI = 'gpt-4o-mini';
const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const ALLOWED_AUDIO_MIMES = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/mp3', 'audio/wav']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

interface OpenAiUserContent {
  role: 'user';
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
  >;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly openai: OpenAI;
  private readonly openaiApiKey: string;
  private readonly gemini: GoogleGenerativeAI;
  private readonly geminiApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tools: ChatToolsService,
    private readonly aiSettings: AiSettingsService,
    private readonly aiQuota: AiQuotaService,
    config: ConfigService,
  ) {
    this.openaiApiKey = config.get<string>('openai.apiKey') ?? '';
    this.openai = new OpenAI({ apiKey: this.openaiApiKey });
    this.geminiApiKey = config.get<string>('gemini.apiKey') ?? '';
    this.gemini = new GoogleGenerativeAI(this.geminiApiKey);
  }

  async listConversations(companyId: string, userId: string) {
    return this.prisma.chatConversation.findMany({
      where: { companyId, userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async createConversation(companyId: string, userId: string, title?: string) {
    return this.prisma.chatConversation.create({
      data: { companyId, userId, title: title || DEFAULT_TITLE },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async deleteConversation(companyId: string, userId: string, id: string) {
    const conv = await this.assertOwnership(id, companyId, userId);
    await this.prisma.chatConversation.delete({ where: { id: conv.id } });
  }

  async listMessages(companyId: string, userId: string, conversationId: string) {
    await this.assertOwnership(conversationId, companyId, userId);
    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        attachments: {
          select: { id: true, type: true, mimeType: true, sizeBytes: true },
        },
      },
    });
    return messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      attachments: m.attachments,
    }));
  }

  async createAttachment(
    companyId: string,
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    if (!ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
      throw new BadRequestException('סוג קובץ לא נתמך. רק תמונות (PNG, JPG, WEBP).');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('הקובץ גדול מדי (מקסימום 10MB).');
    }
    const safeName = `chat-${Date.now()}-${file.originalname.replace(/[^\w.\-]/g, '_')}`;
    const storageKey = await this.storage.upload(file.buffer, safeName, companyId);
    const attachment = await this.prisma.chatAttachment.create({
      data: {
        companyId,
        userId,
        type: ChatAttachmentType.IMAGE,
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
      select: { id: true, mimeType: true, sizeBytes: true },
    });
    return attachment;
  }

  async getAttachmentBuffer(companyId: string, userId: string, attachmentId: string) {
    const att = await this.prisma.chatAttachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, companyId: true, userId: true, storageKey: true, mimeType: true },
    });
    if (!att) throw new NotFoundException('קובץ לא נמצא');
    if (att.companyId !== companyId || att.userId !== userId) {
      throw new ForbiddenException('אין הרשאה לקובץ זה');
    }
    const buffer = await this.storage.getBuffer(att.storageKey);
    return { buffer, mimeType: att.mimeType };
  }

  async transcribeAudio(file: { buffer: Buffer; originalname: string; mimetype: string; size: number }) {
    if (!ALLOWED_AUDIO_MIMES.has(file.mimetype)) {
      throw new BadRequestException('פורמט אודיו לא נתמך.');
    }
    if (file.size > MAX_AUDIO_BYTES) {
      throw new BadRequestException('ההקלטה גדולה מדי (מקסימום 25MB).');
    }
    if (!this.openaiApiKey) {
      throw new BadRequestException('שירות תמלול לא מוגדר.');
    }

    const formData = new FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype });
    formData.append('file', blob, file.originalname || 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'he');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.openaiApiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Whisper failed ${res.status}: ${text}`);
      throw new BadRequestException('תמלול נכשל. נסה שוב.');
    }

    const json = (await res.json()) as { text?: string };
    return { text: (json.text ?? '').trim() };
  }

  streamReply(
    companyId: string,
    userId: string,
    conversationId: string,
    userContent: string,
    attachmentIds: string[] = [],
    scope?: ChatMessageScope,
  ): Observable<ChatStreamEvent> {
    return new Observable<ChatStreamEvent>((subscriber) => {
      let cancelled = false;

      (async () => {
        try {
          const conv = await this.assertOwnership(conversationId, companyId, userId);
          const agent = await this.getDefaultAgent();

          const attachments = await this.loadAttachmentsForSend(
            attachmentIds,
            companyId,
            userId,
          );

          // Per-company AI control: gate on enabled, pick the model + output
          // budget from the company's settings. Gemini-only in Phase 1 — other
          // providers are left untouched (their token limits differ).
          const settings = await this.aiSettings.getOrCreate(companyId);
          if (!settings.enabled) {
            subscriber.next({ type: 'error', message: 'שירות ה-AI מושבת עבור חברה זו' });
            subscriber.complete();
            return;
          }
          const isGemini = agent.provider === ChatProvider.GEMINI;
          const selectedModel = isGemini
            ? resolveChatGeminiModel(
                attachments.length > 0 && settings.fileModel
                  ? settings.fileModel
                  : settings.defaultModel,
              )
            : agent.model;
          const effectiveAgent: ChatAgent = isGemini
            ? { ...agent, model: selectedModel, maxTokens: settings.maxOutputTokens }
            : agent;

          const scopeContext = await this.buildScopeContext(companyId, scope);

          const userMessage = await this.prisma.chatMessage.create({
            data: { conversationId, role: ChatRole.USER, content: userContent },
            select: { id: true },
          });

          if (attachments.length > 0) {
            await this.prisma.chatAttachment.updateMany({
              where: { id: { in: attachments.map((a) => a.id) } },
              data: { messageId: userMessage.id },
            });
          }

          const history = await this.prisma.chatMessage.findMany({
            where: { conversationId, id: { not: userMessage.id } },
            orderBy: { createdAt: 'asc' },
            select: { role: true, content: true },
          });

          const tokens = this.streamFromProvider(
            effectiveAgent,
            history,
            scopeContext ? `${userContent}${scopeContext.promptSuffix}` : userContent,
            attachments,
            { companyId, userId, scope: scopeContext?.scope },
          );

          let buffer = '';

          for await (const delta of tokens) {
            if (cancelled) break;
            if (delta.type === 'card') {
              subscriber.next({ type: 'card', card: delta.card });
            } else if (delta.text) {
              buffer += delta.text;
              subscriber.next({ type: 'chunk', content: delta.text });
            }
          }

          if (cancelled) {
            subscriber.complete();
            return;
          }

          const saved = await this.prisma.chatMessage.create({
            data: {
              conversationId,
              role: ChatRole.ASSISTANT,
              content: buffer,
            },
            select: { id: true },
          });

          // Soft usage tracking — token counts estimated from text, fire-and-forget.
          const estTokensIn = Math.ceil(
            (userContent.length + history.reduce((n, m) => n + m.content.length, 0)) / 4,
          );
          const estTokensOut = Math.ceil(buffer.length / 4);
          void this.aiQuota.consume(companyId, {
            model: selectedModel,
            tokensIn: estTokensIn,
            tokensOut: estTokensOut,
          });

          let finalTitle: string | undefined;
          if (conv.title === DEFAULT_TITLE) {
            finalTitle = await this.generateTitle(userContent).catch(() => undefined);
          }

          await this.prisma.chatConversation.update({
            where: { id: conversationId },
            data: {
              updatedAt: new Date(),
              ...(finalTitle ? { title: finalTitle } : {}),
            },
          });

          subscriber.next({ type: 'done', messageId: saved.id, title: finalTitle });
          subscriber.complete();
        } catch (err: any) {
          this.logger.error(`Chat stream failed: ${err?.message ?? err}`, err?.stack);
          subscriber.next({ type: 'error', message: this.humanizeError(err) });
          subscriber.complete();
        }
      })();

      return () => {
        cancelled = true;
      };
    });
  }

  private async *streamFromProvider(
    agent: ChatAgent,
    history: { role: ChatRole; content: string }[],
    userContent: string,
    attachments: ChatAttachment[],
    ctx: ChatToolContext,
  ): AsyncIterable<StreamDelta> {
    if (agent.provider === ChatProvider.GEMINI) {
      yield* this.streamGemini(agent, history, userContent, attachments, ctx);
    } else {
      yield* this.streamOpenAi(agent, history, userContent, attachments);
    }
  }

  private async *streamOpenAi(
    agent: ChatAgent,
    history: { role: ChatRole; content: string }[],
    userContent: string,
    attachments: ChatAttachment[],
  ): AsyncIterable<StreamDelta> {
    const systemPrompt = agent.hasTools
      ? agent.systemPrompt + TOOL_DISPLAY_GUARDRAILS + FORMATTING_GUIDELINES
      : agent.systemPrompt + FORMATTING_GUIDELINES;
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role: m.role === ChatRole.USER ? 'user' : 'assistant',
        content: m.content,
      })),
      await this.buildUserMessageWithAttachments(userContent, attachments),
    ];

    const model = attachments.length > 0 ? this.ensureOpenAiVisionModel(agent.model) : agent.model;

    const completion = await this.openai.chat.completions.create({
      model,
      messages,
      stream: true,
      max_tokens: agent.maxTokens,
      temperature: agent.temperature,
    });

    for await (const part of completion) {
      const delta = part.choices?.[0]?.delta?.content;
      if (delta) yield { type: 'text', text: delta };
    }
  }

  private async *streamGemini(
    agent: ChatAgent,
    history: { role: ChatRole; content: string }[],
    userContent: string,
    attachments: ChatAttachment[],
    ctx: ChatToolContext,
  ): AsyncIterable<StreamDelta> {
    if (!this.geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }
    const model = this.gemini.getGenerativeModel({
      model: agent.model,
      systemInstruction: agent.hasTools
        ? agent.systemPrompt + TOOL_DISPLAY_GUARDRAILS + FORMATTING_GUIDELINES
        : agent.systemPrompt + FORMATTING_GUIDELINES,
      generationConfig: {
        maxOutputTokens: agent.maxTokens,
        temperature: agent.temperature,
      },
      ...(agent.hasTools
        ? { tools: [{ functionDeclarations: CHAT_TOOL_DECLARATIONS }] }
        : {}),
    });

    const chat = model.startChat({
      history: history.map((m) => ({
        role: m.role === ChatRole.USER ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    });

    const initialParts: Part[] = [{ text: userContent }];
    for (const a of attachments) {
      const buffer = await this.storage.getBuffer(a.storageKey);
      initialParts.push({
        inlineData: { mimeType: a.mimeType, data: buffer.toString('base64') },
      });
    }

    let nextParts: Part[] = initialParts;
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const result = await chat.sendMessageStream(nextParts);
      const collectedCalls: FunctionCall[] = [];

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield { type: 'text', text };
        const calls = chunk.functionCalls();
        if (calls?.length) collectedCalls.push(...calls);
      }

      if (collectedCalls.length === 0) return;

      this.logger.log(
        `Gemini tool calls (iter ${iteration + 1}): ${collectedCalls.map((c) => c.name).join(', ')}`,
      );

      const executed = await Promise.all(
        collectedCalls.map(async (call) => ({
          call,
          response: await this.tools.execute(call.name, call.args ?? {}, ctx),
        })),
      );

      nextParts = [];
      for (let i = 0; i < executed.length; i++) {
        const { call, response } = executed[i];
        const card = this.toCard(call.name, response, `${iteration}-${i}`);
        if (card) yield { type: 'card', card };
        nextParts.push({
          functionResponse: { name: call.name, response: { content: response } },
        } as Part);
      }
    }

    this.logger.warn(`Hit MAX_TOOL_ITERATIONS=${MAX_TOOL_ITERATIONS}; stopping tool loop`);
  }

  /** Maps a tool result into a renderable card. Returns null for unknown tools or error results. */
  private toCard(name: string, response: unknown, idSuffix: string): ChatCard | null {
    const kind = TOOL_CARD_KINDS[name];
    if (!kind) return null;
    if (!response || typeof response !== 'object' || 'error' in response) return null;
    return { id: `card-${name}-${idSuffix}`, kind, data: response } as ChatCard;
  }

  /**
   * Turns the UI scope into (a) a prompt suffix so the model knows a filter is
   * active, and (b) a sanitized scope object used as tool-arg defaults. The
   * suffix is NOT persisted — only the raw user text is saved.
   */
  private async buildScopeContext(companyId: string, scope?: ChatMessageScope) {
    if (!scope) return null;
    const clean: ChatMessageScope = {
      ...(typeof scope.projectId === 'string' && scope.projectId
        ? { projectId: scope.projectId }
        : {}),
      ...(typeof scope.supplierId === 'string' && scope.supplierId
        ? { supplierId: scope.supplierId }
        : {}),
      ...(typeof scope.dateFrom === 'string' && scope.dateFrom
        ? { dateFrom: scope.dateFrom }
        : {}),
      ...(typeof scope.dateTo === 'string' && scope.dateTo ? { dateTo: scope.dateTo } : {}),
    };
    if (Object.keys(clean).length === 0) return null;
    const [project, supplier] = await Promise.all([
      clean.projectId
        ? this.prisma.project.findFirst({
            where: { id: clean.projectId, companyId },
            select: { name: true },
          })
        : Promise.resolve(null),
      clean.supplierId
        ? this.prisma.supplier.findFirst({
            where: { id: clean.supplierId, companyId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);
    const parts = [
      project ? `פרויקט: ${project.name}` : null,
      supplier ? `ספק: ${supplier.name}` : null,
      clean.dateFrom || clean.dateTo
        ? `תאריכים: ${clean.dateFrom ?? '...'} עד ${clean.dateTo ?? 'היום'}`
        : null,
    ].filter(Boolean);
    if (parts.length === 0) return null;
    return {
      scope: clean,
      promptSuffix: `\n\n[סינון פעיל בממשק: ${parts.join(' | ')}. החל אותו בקריאות לכלים, אלא אם המשתמש ביקש מפורשות אחרת.]`,
    };
  }

  private async loadAttachmentsForSend(
    attachmentIds: string[],
    companyId: string,
    userId: string,
  ): Promise<ChatAttachment[]> {
    if (attachmentIds.length === 0) return [];
    const records = await this.prisma.chatAttachment.findMany({
      where: { id: { in: attachmentIds } },
    });
    if (records.length !== attachmentIds.length) {
      throw new BadRequestException('קובץ מצורף לא נמצא.');
    }
    for (const a of records) {
      if (a.companyId !== companyId || a.userId !== userId) {
        throw new ForbiddenException('אין הרשאה לקובץ זה.');
      }
      if (a.messageId) {
        throw new BadRequestException('קובץ זה כבר שויך להודעה אחרת.');
      }
    }
    return records;
  }

  private async buildUserMessageWithAttachments(
    text: string,
    attachments: ChatAttachment[],
  ): Promise<OpenAiUserContent | { role: 'user'; content: string }> {
    if (attachments.length === 0) {
      return { role: 'user', content: text };
    }
    const parts: OpenAiUserContent['content'] = [{ type: 'text', text }];
    for (const a of attachments) {
      const buffer = await this.storage.getBuffer(a.storageKey);
      const b64 = buffer.toString('base64');
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${a.mimeType};base64,${b64}`, detail: 'auto' },
      });
    }
    return { role: 'user', content: parts };
  }

  private ensureOpenAiVisionModel(model: string): string {
    if (model === 'gpt-4o-mini' || model.startsWith('gpt-4o') || model.startsWith('gpt-4-vision')) {
      return model;
    }
    this.logger.warn(`Agent model ${model} may not support vision; falling back to ${VISION_FALLBACK_MODEL_OPENAI}`);
    return VISION_FALLBACK_MODEL_OPENAI;
  }

  private humanizeError(err: any): string {
    const status = err?.status ?? err?.response?.status;
    const message = typeof err?.message === 'string' ? err.message : '';
    if (status === 429 || /quota|rate.?limit/i.test(message)) {
      return 'מכסת הספק אזלה. פנה לסופר-אדמין לטעינת אשראי או החלפת סוכן.';
    }
    if (status === 401 || status === 403 || /api.?key/i.test(message)) {
      return 'מפתח ה-API לא תקף. פנה לסופר-אדמין.';
    }
    if (message.includes('No default chat agent') || message.includes('סוכן ברירת מחדל')) {
      return 'לא הוגדר סוכן ברירת מחדל. פנה לסופר-אדמין.';
    }
    if (message.includes('Gemini API key not configured')) {
      return 'מפתח Gemini לא מוגדר. פנה לסופר-אדמין.';
    }
    return 'שגיאה ביצירת תשובה. נסה שוב.';
  }

  private async getDefaultAgent(): Promise<ChatAgent> {
    const agent = await this.prisma.chatAgent.findFirst({
      where: { isDefault: true, isEnabled: true },
    });
    if (!agent) {
      throw new Error('לא הוגדר סוכן ברירת מחדל. פנה לסופר-אדמין.');
    }
    return agent;
  }

  private async assertOwnership(id: string, companyId: string, userId: string) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id },
      select: { id: true, companyId: true, userId: true, title: true },
    });
    if (!conv) throw new NotFoundException('שיחה לא נמצאה');
    if (conv.companyId !== companyId || conv.userId !== userId) {
      throw new ForbiddenException('אין הרשאה לגשת לשיחה זו');
    }
    return conv;
  }

  private async generateTitle(firstPrompt: string): Promise<string> {
    if (!this.geminiApiKey) return DEFAULT_TITLE;
    try {
      const model = this.gemini.getGenerativeModel({
        model: TITLE_MODEL,
        systemInstruction:
          'צור כותרת קצרה ועניינית בעברית (עד 6 מילים) לשיחה הבאה. החזר רק את הכותרת, ללא מירכאות וללא סימני פיסוק מיותרים.',
        generationConfig: { maxOutputTokens: 64, temperature: 0.3 },
      });
      const res = await model.generateContent(firstPrompt);
      const raw = res.response.text().trim();
      const cleaned = raw.replace(/^["'״׳]+|["'״׳]+$/g, '').slice(0, 80);
      // Guard against a degenerate one-character/empty title — fall back to a
      // trimmed slice of the user's first message rather than a stub.
      if (cleaned.length >= 2) return cleaned;
      return firstPrompt.trim().slice(0, 40) || DEFAULT_TITLE;
    } catch {
      return DEFAULT_TITLE;
    }
  }
}
