/** Central AI model identifiers — change here to update everywhere */
export const GEMINI_MODEL = 'gemini-2.5-flash';
export const OPENAI_MODEL = 'gpt-4o';

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  [OPENAI_MODEL]: { input: 2.5, output: 10 },
  [GEMINI_MODEL]: { input: 0.075, output: 0.3 },
};

export type OcrProviderType = 'OPENAI' | 'GEMINI' | 'GEMINI_FINETUNED';
