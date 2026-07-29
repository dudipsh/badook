import type { PromptDefinition } from '../index';
import { loadPromptWithSharedRules } from '../../loader';

export const PURCHASE_ORDER_PROMPT_DEF: PromptDefinition = {
  agentType: 'EXTRACTION',
  promptKey: 'purchase-order',
  name: 'חילוץ הזמנת רכש',
  description: 'חילוץ נתונים מהזמנת רכש: ספק, פריטים, כמויות, מחירים',
  promptText: loadPromptWithSharedRules('extraction/purchase-order.md'),
};
