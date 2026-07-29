import type { PromptDefinition } from '../index';
import { loadPromptWithSharedRules } from '../../loader';

export const PURCHASE_ORDER_ITEMS_PROMPT_DEF: PromptDefinition = {
  agentType: 'EXTRACTION',
  promptKey: 'purchase-order-items',
  name: 'חילוץ פריטי הזמנת רכש',
  description: 'חילוץ שורות פריטים מהזמנת רכש: תיאורים, כמויות, מחירים',
  promptText: loadPromptWithSharedRules('extraction/purchase-order-items.md'),
};
