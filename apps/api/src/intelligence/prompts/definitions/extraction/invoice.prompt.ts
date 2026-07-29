import type { PromptDefinition } from '../index';
import { loadPromptWithSharedRules } from '../../loader';

export const INVOICE_PROMPT_DEF: PromptDefinition = {
  agentType: 'EXTRACTION',
  promptKey: 'invoice',
  name: 'חילוץ חשבונית',
  description: 'חילוץ נתונים מחשבונית: ספק, פריטים, כמויות, מחירים, מע"מ',
  promptText: loadPromptWithSharedRules('extraction/invoice.md'),
};
