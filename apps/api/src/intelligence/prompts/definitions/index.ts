export type AgentType = 'INTAKE' | 'EXTRACTION' | 'MATCHING';

export interface PromptDefinition {
  agentType: AgentType;
  promptKey: string;
  name: string;
  description: string;
  promptText: string;
}

import { TYPE_DETECTION_PROMPT } from './intake/type-detection.prompt';
import { MULTI_DOC_DETECTION_PROMPT } from './intake/multi-doc-detection.prompt';
import { DELIVERY_NOTE_PROMPT_DEF } from './extraction/delivery-note.prompt';
import { INVOICE_PROMPT_DEF } from './extraction/invoice.prompt';
import { PURCHASE_ORDER_PROMPT_DEF } from './extraction/purchase-order.prompt';
import { PURCHASE_ORDER_HEADER_PROMPT_DEF } from './extraction/purchase-order-header.prompt';
import { PURCHASE_ORDER_ITEMS_PROMPT_DEF } from './extraction/purchase-order-items.prompt';
import { VERIFICATION_PROMPT_DEF } from './extraction/verification.prompt';
import { SEMANTIC_MATCHING_PROMPT_DEF } from './matching/semantic-matching.prompt';

export const PROMPT_REGISTRY: PromptDefinition[] = [
  TYPE_DETECTION_PROMPT,
  MULTI_DOC_DETECTION_PROMPT,
  DELIVERY_NOTE_PROMPT_DEF,
  INVOICE_PROMPT_DEF,
  PURCHASE_ORDER_PROMPT_DEF,
  PURCHASE_ORDER_HEADER_PROMPT_DEF,
  PURCHASE_ORDER_ITEMS_PROMPT_DEF,
  VERIFICATION_PROMPT_DEF,
  SEMANTIC_MATCHING_PROMPT_DEF,
];

const PROMPT_MAP = new Map<string, PromptDefinition>();
for (const def of PROMPT_REGISTRY) {
  PROMPT_MAP.set(`${def.agentType}::${def.promptKey}`, def);
}

export function getPromptDefinition(agentType: AgentType, promptKey: string): PromptDefinition | undefined {
  return PROMPT_MAP.get(`${agentType}::${promptKey}`);
}
