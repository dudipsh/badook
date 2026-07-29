import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApiUsageLoggerService } from '../../common/services/api-usage-logger.service';
import { GEMINI_MODEL, OPENAI_MODEL } from '../../common/ai-models';
import { PromptsService } from '../../intelligence/prompts/prompts.service';

export interface LineItemRef {
  index: number;
  description: string;
  catalogNumber: string | null;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface ItemMatch {
  po: number | null;
  dn: number | null;
  inv: number | null;
  confidence: number;
}

export interface MatchResult {
  matches: ItemMatch[];
}

@Injectable()
export class SemanticMatchingService {
  private readonly logger = new Logger(SemanticMatchingService.name);
  private readonly openai: OpenAI;
  private readonly gemini: GoogleGenerativeAI;

  constructor(
    private readonly config: ConfigService,
    private readonly usageLogger: ApiUsageLoggerService,
    private readonly prompts: PromptsService,
  ) {
    this.openai = new OpenAI({ apiKey: this.config.get('openai.apiKey') });
    this.gemini = new GoogleGenerativeAI(this.config.get('gemini.apiKey') || '');
  }

  async matchLineItems(
    poItems: LineItemRef[],
    dnItems: LineItemRef[],
    invItems: LineItemRef[],
    provider: 'OPENAI' | 'GEMINI',
    feedbackExamples?: { descriptionA: string; descriptionB: string }[],
    companyId?: string,
  ): Promise<MatchResult> {
    if (poItems.length === 0 && dnItems.length === 0 && invItems.length === 0) {
      return { matches: [] };
    }

    const template = this.prompts.getPrompt('MATCHING', 'semantic-matching') || null;
    const prompt = this.buildPrompt(poItems, dnItems, invItems, feedbackExamples, template);
    this.logger.log(`AI matching: ${poItems.length} PO + ${dnItems.length} DN + ${invItems.length} INV items via ${provider} (${feedbackExamples?.length || 0} learned mappings)`);

    const aiStart = Date.now();
    const response = await this.callTextApi(prompt, provider, companyId);
    this.logger.log(`⏱️ [AI TIMING] matchLineItems API call: ${Date.now() - aiStart}ms (provider=${provider})`);
    return this.parseResult(response, poItems, dnItems, invItems);
  }

  async matchLineItemsSecondRound(
    poItems: LineItemRef[],
    dnItems: LineItemRef[],
    invItems: LineItemRef[],
    provider: 'OPENAI' | 'GEMINI',
    alreadyMatched: { po?: string; dn?: string; inv?: string }[],
    feedbackExamples?: { descriptionA: string; descriptionB: string }[],
    companyId?: string,
  ): Promise<MatchResult> {
    if (poItems.length === 0 || (dnItems.length === 0 && invItems.length === 0)) {
      return { matches: [] };
    }

    const prompt = this.buildSecondRoundPrompt(poItems, dnItems, invItems, alreadyMatched, feedbackExamples);
    this.logger.log(`AI second-round matching: ${poItems.length} PO + ${dnItems.length} DN + ${invItems.length} INV orphans via ${provider}`);

    const aiStart = Date.now();
    const response = await this.callTextApi(prompt, provider, companyId);
    this.logger.log(`⏱️ [AI TIMING] matchLineItemsSecondRound API call: ${Date.now() - aiStart}ms (provider=${provider})`);
    return this.parseResult(response, poItems, dnItems, invItems);
  }

  private buildSecondRoundPrompt(
    poItems: LineItemRef[],
    dnItems: LineItemRef[],
    invItems: LineItemRef[],
    alreadyMatched: { po?: string; dn?: string; inv?: string }[],
    feedbackExamples?: { descriptionA: string; descriptionB: string }[],
  ): string {
    const poFormatted = this.formatItems(poItems);
    const dnFormatted = this.formatItems(dnItems);
    const invFormatted = this.formatItems(invItems);
    const learnedMappings = this.buildLearnedMappings(feedbackExamples);

    const matchedContext = alreadyMatched.length > 0
      ? `\nALREADY MATCHED (for context — these items are accounted for, focus on the REMAINING items below):\n${alreadyMatched.slice(0, 15).map((m, i) => `${i + 1}. PO: "${m.po || '-'}" ↔ DN: "${m.dn || '-'}" ↔ INV: "${m.inv || '-'}"`).join('\n')}\n`
      : '';

    return `You are an expert at matching line items between Israeli construction/building supply documents.

CONTEXT: This is a SECOND ROUND of matching. A first round already matched the obvious items.
The items below are the REMAINING UNMATCHED orphans. Since the easy matches are done, these items
likely have VERY different descriptions between PO and DN/Invoice but refer to the SAME product.

CRITICAL INSTRUCTIONS:
1. These are LEFTOVER items — they MUST correspond to each other (the easy matches were already made)
2. Use PROCESS OF ELIMINATION — if only a few PO items and DN items remain, they almost certainly match
3. Match by ANY shared signal: similar quantities, similar totals, any shared keyword, same product category
4. Be VERY aggressive — a low-confidence match (0.3) is MUCH better than leaving items orphaned
5. Construction materials are often described completely differently between buyer and supplier
6. Hebrew abbreviations, brand names, and model numbers may differ significantly
${matchedContext}${learnedMappings}
Remaining Unmatched Purchase Order Items (0-indexed):
${poFormatted}

Remaining Unmatched Delivery Note Items (0-indexed):
${dnFormatted}

Remaining Unmatched Invoice Items (0-indexed):
${invFormatted}

Return ONLY valid JSON (no markdown, no explanation):
{
  "matches": [
    {"po": 0, "dn": null, "inv": 0, "confidence": 0.5}
  ]
}

Rules:
- Match items that refer to the same product, even if described VERY differently
- Use null when an item has no counterpart
- confidence: 0.0-1.0 — even 0.3 is acceptable in this second round
- Each index should appear at most once
- Try to match EVERY remaining item — these are leftovers that SHOULD have matches
- When in doubt, MATCH rather than leave orphaned`;
  }

  private formatItems(items: LineItemRef[]): string {
    return items.length === 0
      ? '(none)'
      : items.map((it) => {
          const parts = [`qty: ${it.quantity}`];
          if (it.catalogNumber) parts.push(`cat: ${it.catalogNumber}`);
          if (it.unitPrice != null) parts.push(`unit: ${it.unitPrice}`);
          if (it.totalPrice != null) parts.push(`total: ${it.totalPrice}`);
          return `${it.index}. "${it.description}" (${parts.join(', ')})`;
        }).join('\n');
  }

  private buildLearnedMappings(feedbackExamples?: { descriptionA: string; descriptionB: string }[]): string {
    if (!feedbackExamples || feedbackExamples.length === 0) return '';
    return `\nLEARNED MAPPINGS (confirmed by this customer — these products are the SAME, use as ground truth):\n${feedbackExamples.map((ex, i) => `${i + 1}. "${ex.descriptionA}" = "${ex.descriptionB}"`).join('\n')}\n\nApply these mappings when you see matching or similar descriptions. They take priority over your own judgment.\n`;
  }

  private buildPrompt(
    poItems: LineItemRef[],
    dnItems: LineItemRef[],
    invItems: LineItemRef[],
    feedbackExamples?: { descriptionA: string; descriptionB: string }[],
    template?: string | null,
  ): string {
    const poFormatted = this.formatItems(poItems);
    const dnFormatted = this.formatItems(dnItems);
    const invFormatted = this.formatItems(invItems);
    const learnedMappings = this.buildLearnedMappings(feedbackExamples);

    if (template) {
      return template
        .replace('{{LEARNED_MAPPINGS}}', learnedMappings)
        .replace('{{PO_ITEMS}}', poFormatted)
        .replace('{{DN_ITEMS}}', dnFormatted)
        .replace('{{INV_ITEMS}}', invFormatted);
    }

    // Fallback: inline prompt (should not happen if PromptsService defaults are set)
    return `You are an expert at matching line items between Israeli construction/building supply documents (purchase order, delivery note, invoice).

CRITICAL: The SAME product is often described VERY differently between the buyer's purchase order and the supplier's invoice/delivery note. Examples:
- "מברשת לניקוי אסלה+ תושבת" (PO) = "מברשת תלויה נמוקס גיזה שחור" (Invoice) — same toilet brush
- "מראה זכוכית + מסגרת (לגדלים שונים)" (PO) = "מראה-מסגרת פרופיל 02 אלומיניום גודל 50/90 ס"מ" (Invoice) — same mirror
- "פח נירוסטה 5 ליטר תלוי" (PO) = "פח פדל 5 ל TIGER שחור" (Invoice) — same trash can
- "Chute לשאיבה פלג שחור ניירוסטה" (PO) = "Chute לאשפה - פלנג שטוח- נירוסטה" (Invoice) — same chute
- "גוף תאורה לפס צבירה דגם LED S Zenit" (PO) = "ספוט לפס צבירה Zenit S - 11W" (DN) = "ספוט שקוע לד Zehir S" (INV) — same light fixture
- "כוסות פלסטיק חד פעמי לשתייה קרה (3000 יח' בקרטון) קרטון כוסות" (PO) = "קרטון כוסות לשתיה קרה 3000" (DN) — same cups, different description style

CATALOG NUMBERS: The SAME product often has DIFFERENT catalog numbers across PO, DN, and Invoice because the buyer, distributor, and manufacturer each use their own numbering system. For example:
- PO: "5547900007" / DN: "9018" — same cold cups, completely different catalog systems
- PO: "2737700040" / DN: "S10S100-WWSC1830 H14" / INV: "S10S100-NW-W-SC1830II" — all the same spotlight
- PO: "2737700039" / DN: "ML3545-15W-3000K" / INV: "MI_3545-15W-3000K" — all the same LED profile
Do NOT assume that different catalog numbers mean different products. Focus on descriptions, quantities, and product category.

UNIT OF MEASURE DIFFERENCES: The SAME product can have DIFFERENT units across documents. For example:
- PO orders 50 "שרוולים" (sleeves) but DN delivers 2 "קרטונים" (cartons) — if each carton contains 25 sleeves, they're the same delivery
- PO orders 1 "קופה" (crate) but DN delivers 1 "קרטון" (box) — same product, different unit name
When quantities differ significantly but TOTAL AMOUNTS are similar (within ~20%), they're likely the same product with different counting units.

Matching strategies (use ALL of them, be AGGRESSIVE about matching — it's better to match with lower confidence than to leave items as orphans):
1. Same or similar TOTAL AMOUNT (unit price × quantity) is a very strong signal — if totals are within 20%, assume same product
2. Same QUANTITY is a strong signal — items with matching quantities across PO/DN/INV are very likely the same product
3. Same product CATEGORY + shared keywords (כוסות↔כוסות, קרה↔קרה, חמה↔חמה, ספוט↔ספוט, פרופיל↔פרופיל) → likely MATCH
4. Same catalog number → definite MATCH, but different catalog numbers do NOT mean different products
5. Similar technical specs (wattage, color temp, dimensions, pack size like "3000") confirm the match
6. If quantities differ but are within 10% of each other AND descriptions share any significant keyword → assume it's the same product
${learnedMappings}
Purchase Order Items (0-indexed):
${poFormatted}

Delivery Note Items (0-indexed):
${dnFormatted}

Invoice Items (0-indexed):
${invFormatted}

Return ONLY valid JSON (no markdown, no explanation):
{
  "matches": [
    {"po": 0, "dn": null, "inv": 3, "confidence": 0.85}
  ]
}

Rules:
- Match items that refer to the same product, even if described VERY differently
- Use null when an item has no counterpart in a document list (or if the list is empty)
- confidence: 0.0-1.0 indicating match certainty
- Each index should appear at most once across all matches
- Try to match EVERY item — only leave items unmatched if truly no counterpart exists
- When quantities match and product categories are similar, prefer matching over not matching`;
  }

  private async callTextApi(prompt: string, provider: 'OPENAI' | 'GEMINI', companyId?: string): Promise<string> {
    const result = provider === 'GEMINI'
      ? await this.callGeminiText(prompt)
      : await this.callOpenAiText(prompt);

    if (companyId) {
      const model = provider === 'GEMINI' ? GEMINI_MODEL : OPENAI_MODEL;
      this.usageLogger.logUsage({
        companyId,
        provider,
        model,
        operation: 'AI_MATCHING',
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      });
    }

    return result.content;
  }

  private async callOpenAiText(prompt: string): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
    const response = await this.openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');
    return {
      content,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    };
  }

  private async callGeminiText(prompt: string): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
    const model = this.gemini.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0,
        // @ts-expect-error -- thinkingConfig not yet in SDK types
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const result = await model.generateContent(
      prompt + '\n\nReturn ONLY valid JSON, no markdown fences.',
    );
    const text = result.response.text();
    if (!text) throw new Error('Empty response from Gemini');
    const usage = result.response.usageMetadata;
    return {
      content: text.replace(/^```(?:json)?\n?/g, '').replace(/\n?```$/g, '').trim(),
      promptTokens: usage?.promptTokenCount ?? 0,
      completionTokens: usage?.candidatesTokenCount ?? 0,
    };
  }

  private parseResult(
    response: string,
    poItems: LineItemRef[],
    dnItems: LineItemRef[],
    invItems: LineItemRef[],
  ): MatchResult {
    let parsed: any;
    try {
      const cleaned = response.replace(/^```(?:json)?\n?/g, '').replace(/\n?```$/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (err) {
      this.logger.error(`Failed to parse AI matching response: ${err}`);
      return { matches: [] };
    }
    const matches: ItemMatch[] = [];

    const usedPo = new Set<number>();
    const usedDn = new Set<number>();
    const usedInv = new Set<number>();

    for (const m of parsed.matches || []) {
      const po = typeof m.po === 'number' ? m.po : null;
      const dn = typeof m.dn === 'number' ? m.dn : null;
      const inv = typeof m.inv === 'number' ? m.inv : null;
      const confidence = typeof m.confidence === 'number' ? m.confidence : 0.5;

      // Validate indices are within bounds and not already used
      if (po !== null && (po < 0 || po >= poItems.length || usedPo.has(po))) continue;
      if (dn !== null && (dn < 0 || dn >= dnItems.length || usedDn.has(dn))) continue;
      if (inv !== null && (inv < 0 || inv >= invItems.length || usedInv.has(inv))) continue;

      // Need at least 1 non-null to be a valid match (single items are valid — the counterpart may be missing)
      const nonNull = [po, dn, inv].filter((v) => v !== null).length;
      if (nonNull === 0) continue;

      if (po !== null) usedPo.add(po);
      if (dn !== null) usedDn.add(dn);
      if (inv !== null) usedInv.add(inv);

      matches.push({ po, dn, inv, confidence });
    }

    return { matches };
  }
}
