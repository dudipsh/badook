export const GEMINI_MODEL = 'gemini-2.5-flash';

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'google' | 'vertex-ai';
  apiKeyEnv?: string;
  modelName?: string;
  description: string;
}

/**
 * Central model registry — add new models here.
 * Everything else (UI dropdown, available check, extraction routing) reads from this.
 */
export const MODEL_REGISTRY: ModelConfig[] = [
  {
    id: 'gemini',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    apiKeyEnv: 'GEMINI_API_KEY',
    description: 'Google Gemini - מהיר ומדויק',
  },
  {
    id: 'gemini-finetuned',
    name: 'Gemini Flash (מכוונן)',
    provider: 'vertex-ai',
    modelName: process.env.VERTEX_TUNED_MODEL || '',
    description: 'Gemini Flash מאומן על הדוגמאות שלנו',
  },
];

export interface AiModelInfo {
  id: string;
  name: string;
  provider: 'google' | 'vertex-ai';
  available: boolean;
  description?: string;
}

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  [GEMINI_MODEL]: { input: 0.075, output: 0.3 },
  'gemini-finetuned': { input: 0.15, output: 0.6 }, // Vertex AI tuned model — 2x base price
};
