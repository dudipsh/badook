import type { PromptDefinition } from '../index';
import { loadTemplate } from '../../loader';

export const PURCHASE_ORDER_HEADER_PROMPT_DEF: PromptDefinition = {
  agentType: 'EXTRACTION',
  promptKey: 'purchase-order-header',
  name: 'חילוץ כותרת הזמנת רכש',
  description: 'חילוץ שדות כותרת מהזמנת רכש: ספק, כתובת, פרויקט, תאריכים',
  promptText: loadTemplate('extraction/purchase-order-header.md'),
};
