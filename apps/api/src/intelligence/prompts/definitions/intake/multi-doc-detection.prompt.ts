import type { PromptDefinition } from '../index';
import { loadTemplate } from '../../loader';

export const MULTI_DOC_DETECTION_PROMPT: PromptDefinition = {
  agentType: 'INTAKE',
  promptKey: 'multi-doc-detection',
  name: 'זיהוי מסמכים מרובים',
  description: 'מזהה ומפצל מסמכים נפרדים בתוך PDF אחד — מותאם לתעשיית הבנייה',
  promptText: loadTemplate('intake/multi-doc-detection.md'),
};
