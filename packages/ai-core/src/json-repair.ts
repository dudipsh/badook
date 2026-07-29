import * as path from 'path';
import { jsonrepair } from 'jsonrepair';

/**
 * Attempt to parse a JSON string, applying progressive repair strategies
 * when the input is malformed (e.g. markdown fences, truncated brackets,
 * unescaped Hebrew gershayim like בע"מ).
 */
export const safeParseJson = <T>(content: string, context: string): T => {
  try {
    return JSON.parse(content) as T;
  } catch {
    /* continue */
  }

  let cleaned = content
    .trim()
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?\s*```$/i, '');

  const firstBrace = cleaned.indexOf('{');
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);

  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace >= 0 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.slice(0, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    /* continue */
  }

  try {
    return JSON.parse(jsonrepair(cleaned)) as T;
  } catch {
    /* continue */
  }

  try {
    return JSON.parse(jsonrepair(content)) as T;
  } catch (err) {
    throw new Error(
      `Failed to parse AI response for ${path.basename(context)}: ${err}`,
    );
  }
};
