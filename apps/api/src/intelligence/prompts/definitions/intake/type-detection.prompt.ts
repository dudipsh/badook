import type { PromptDefinition } from '../index';
import { loadTemplate } from '../../loader';

export const TYPE_DETECTION_PROMPT: PromptDefinition = {
  agentType: 'INTAKE',
  promptKey: 'type-detection',
  name: 'זיהוי סוג מסמך',
  description: 'מזהה את סוג המסמך: תעודת משלוח, חשבונית, או הזמנת רכש',
  promptText: loadTemplate('intake/type-detection.md'),
};
