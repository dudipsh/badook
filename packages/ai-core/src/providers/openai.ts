import type OpenAI from 'openai';
import type { AiImage, AiCallResult } from './gemini';

export interface OpenAiCallOptions {
  model: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface OpenAiCallResult extends AiCallResult {
  truncated: boolean;
}

/**
 * Raw OpenAI vision API call. Returns JSON string + truncation flag.
 */
export async function callOpenAI(
  client: OpenAI,
  images: AiImage[],
  prompt: string,
  options: OpenAiCallOptions,
): Promise<OpenAiCallResult> {
  const { model, maxTokens = 16384, timeoutMs = 120_000 } = options;

  const imageContent = images.map(({ base64, mimeType }) =>
    mimeType === 'application/pdf'
      ? {
          type: 'file' as const,
          file: {
            filename: 'document.pdf',
            file_data: `data:application/pdf;base64,${base64}`,
          },
        }
      : {
          type: 'image_url' as const,
          image_url: {
            url: `data:${mimeType};base64,${base64}`,
            detail: 'high' as const,
          },
        },
  );

  const response = await client.chat.completions.create(
    {
      model,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }, ...(imageContent as any[])],
        },
      ],
      max_tokens: maxTokens,
      temperature: 0,
      response_format: { type: 'json_object' },
    },
    { timeout: timeoutMs, signal: AbortSignal.timeout(timeoutMs) },
  );

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI');

  return {
    content,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    truncated: response.choices[0]?.finish_reason === 'length',
  };
}
