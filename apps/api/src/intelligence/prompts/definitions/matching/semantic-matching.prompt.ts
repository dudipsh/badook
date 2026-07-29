import type { PromptDefinition } from '../index';
import { loadTemplate } from '../../loader';

export const SEMANTIC_MATCHING_PROMPT_DEF: PromptDefinition = {
  agentType: 'MATCHING',
  promptKey: 'semantic-matching',
  name: 'התאמה סמנטית',
  description: 'התאמת פריטים בין מסמכים שונים (הזמנה, תעודת משלוח, חשבונית)',
  promptText: loadTemplate('matching/semantic-matching.md'),
};
