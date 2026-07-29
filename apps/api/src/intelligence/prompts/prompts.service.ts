import { Injectable, Logger } from '@nestjs/common';
import { PROMPT_REGISTRY, getPromptDefinition, type AgentType } from './definitions';

@Injectable()
export class PromptsService {
  private readonly logger = new Logger(PromptsService.name);

  getPrompt(agentType: AgentType, promptKey: string): string {
    const def = getPromptDefinition(agentType, promptKey);
    if (!def) {
      this.logger.warn(`Prompt not found: ${agentType}/${promptKey}`);
      return '';
    }
    return def.promptText;
  }

  getAllPrompts() {
    return PROMPT_REGISTRY.map((def) => ({
      agentType: def.agentType,
      promptKey: def.promptKey,
      name: def.name,
      description: def.description,
      promptText: def.promptText,
    }));
  }
}
