// Single source of truth for the AI model catalog the super admin can pick from
// (per-company AI settings) and for cost estimation. Gemini-only in Phase 1.
export interface AIModelEntry {
  id: string;
  label: string;
  inPerM: number; // USD per 1M input tokens
  outPerM: number; // USD per 1M output tokens
  vision: boolean;
  finetuned?: boolean;
}

export const AI_MODEL_CATALOG: AIModelEntry[] = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', inPerM: 0.075, outPerM: 0.3, vision: true },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', inPerM: 0.04, outPerM: 0.15, vision: true },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', inPerM: 1.25, outPerM: 5.0, vision: true },
  { id: 'gemini-finetuned', label: 'Gemini (Fine-tuned Badook)', inPerM: 0.075, outPerM: 0.3, vision: true, finetuned: true },
];

export function findModel(id: string): AIModelEntry | undefined {
  return AI_MODEL_CATALOG.find((m) => m.id === id);
}

// The conversational chat calls Gemini through the public API-key SDK, which can
// only serve real published model ids. The fine-tuned catalog entry is a Vertex
// document-extraction model (served elsewhere via the Vertex SDK) and is not a
// real public id — passing it to the API-key SDK 404s. Chat is general-purpose
// anyway, so fall back to the base chat model for any fine-tuned/unknown id.
export const DEFAULT_CHAT_GEMINI_MODEL = 'gemini-2.5-flash';

export function resolveChatGeminiModel(id: string): string {
  const entry = findModel(id);
  if (!entry || entry.finetuned) return DEFAULT_CHAT_GEMINI_MODEL;
  return id;
}

export function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const entry = findModel(model);
  if (!entry) return 0;
  return (tokensIn / 1_000_000) * entry.inPerM + (tokensOut / 1_000_000) * entry.outPerM;
}
