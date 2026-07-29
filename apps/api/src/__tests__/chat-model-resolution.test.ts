import { describe, it, expect } from 'vitest';
import {
  resolveChatGeminiModel,
  DEFAULT_CHAT_GEMINI_MODEL,
} from '../intelligence/ai-management/ai-models.catalog';

describe('resolveChatGeminiModel', () => {
  it('passes through real published chat models unchanged', () => {
    expect(resolveChatGeminiModel('gemini-2.5-flash')).toBe('gemini-2.5-flash');
    expect(resolveChatGeminiModel('gemini-2.5-flash-lite')).toBe('gemini-2.5-flash-lite');
    expect(resolveChatGeminiModel('gemini-2.5-pro')).toBe('gemini-2.5-pro');
  });

  // Production bug: a company's chat model was 'gemini-finetuned' (a Vertex
  // document-extraction tune, not a real public id). The chat's API-key Gemini
  // SDK 404'd on it, surfacing only the generic "שגיאה ביצירת תשובה" error.
  it('falls back to the base chat model for the fine-tuned alias', () => {
    expect(resolveChatGeminiModel('gemini-finetuned')).toBe(DEFAULT_CHAT_GEMINI_MODEL);
    expect(resolveChatGeminiModel('gemini-finetuned')).not.toBe('gemini-finetuned');
  });

  it('falls back for any unknown id', () => {
    expect(resolveChatGeminiModel('made-up-model')).toBe(DEFAULT_CHAT_GEMINI_MODEL);
  });
});
