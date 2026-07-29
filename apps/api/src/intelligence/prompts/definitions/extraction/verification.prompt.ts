import type { PromptDefinition } from '../index';
import { loadTemplate } from '../../loader';

export const VERIFICATION_PROMPT_DEF: PromptDefinition = {
  agentType: 'EXTRACTION',
  promptKey: 'verification',
  name: 'אימות חילוץ',
  description: 'אימות נתונים שחולצו מול המסמך המקורי',
  promptText: loadTemplate('extraction/verification.md'),
};
