import type { PromptDefinition } from '../index';
import { loadPromptWithSharedRules } from '../../loader';

export const DELIVERY_NOTE_PROMPT_DEF: PromptDefinition = {
  agentType: 'EXTRACTION',
  promptKey: 'delivery-note',
  name: 'חילוץ תעודת משלוח',
  description: 'חילוץ נתונים מתעודת משלוח: ספק, פריטים, כמויות, מחירים',
  promptText: loadPromptWithSharedRules('extraction/delivery-note.md'),
};
