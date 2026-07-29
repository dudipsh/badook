import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { VertexAI } from '@google-cloud/vertexai';

export interface AiImage {
  base64: string;
  mimeType: string;
}

export interface AiCallResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
}

export interface GeminiCallOptions {
  model: string;
  maxOutputTokens?: number;
  thinkingBudget?: number;
  timeoutMs?: number;
}

/**
 * Raw Gemini API call using the Generative AI SDK.
 * Returns cleaned JSON string (markdown fences stripped).
 */
export async function callGemini(
  client: GoogleGenerativeAI,
  images: AiImage[],
  prompt: string,
  options: GeminiCallOptions,
): Promise<AiCallResult> {
  const {
    model: modelName,
    maxOutputTokens = 16384,
    thinkingBudget = 2048,
    timeoutMs = 120_000,
  } = options;

  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      maxOutputTokens,
      temperature: 0,
      responseMimeType: 'application/json',
      // @ts-expect-error -- thinkingConfig not yet in SDK types
      thinkingConfig: { thinkingBudget },
    },
  });

  const contentPromise = model.generateContent([
    prompt + '\n\nReturn ONLY valid JSON, no markdown fences.',
    ...images.map(({ base64, mimeType }) => ({
      inlineData: { mimeType, data: base64 },
    })),
  ]);

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Gemini API call timed out after ${timeoutMs}ms`)),
      timeoutMs,
    ),
  );

  const result = await Promise.race([contentPromise, timeoutPromise]);
  const text = result.response.text();
  if (!text) throw new Error('Empty response from Gemini');

  const usage = result.response.usageMetadata;
  return {
    content: stripJsonFences(text),
    promptTokens: usage?.promptTokenCount ?? 0,
    completionTokens: usage?.candidatesTokenCount ?? 0,
  };
}

export interface VertexCallOptions {
  tunedModel: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

/**
 * Raw Vertex AI call to a fine-tuned Gemini model endpoint.
 */
export async function callGeminiFinetuned(
  client: VertexAI,
  images: AiImage[],
  prompt: string,
  options: VertexCallOptions,
): Promise<AiCallResult> {
  const { tunedModel, maxOutputTokens = 16384, timeoutMs = 120_000 } = options;

  const model = client.getGenerativeModel({
    model: tunedModel,
    generationConfig: {
      maxOutputTokens,
      temperature: 0,
      responseMimeType: 'application/json',
    },
  });

  const parts: any[] = [
    { text: prompt + '\n\nReturn ONLY valid JSON, no markdown fences.' },
    ...images.map(({ base64, mimeType }) => ({
      inlineData: { mimeType, data: base64 },
    })),
  ];

  const contentPromise = model.generateContent({
    contents: [{ role: 'user', parts }],
  });
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Fine-tuned Gemini call timed out after ${timeoutMs}ms`)),
      timeoutMs,
    ),
  );

  const result = await Promise.race([contentPromise, timeoutPromise]);
  const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Empty response from fine-tuned Gemini');

  const usage = result.response?.usageMetadata;
  return {
    content: stripJsonFences(text),
    promptTokens: usage?.promptTokenCount ?? 0,
    completionTokens: usage?.candidatesTokenCount ?? 0,
  };
}

function stripJsonFences(text: string): string {
  return text
    .replace(/^```(?:json)?\n?/g, '')
    .replace(/\n?```$/g, '')
    .trim();
}
