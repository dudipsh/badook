import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Bot, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import { PromptCard } from './PromptCard';

const AGENT_TYPES = ['INTAKE', 'EXTRACTION', 'MATCHING'] as const;

export const PromptsTab = observer(() => {
  const { adminStore } = useStores();
  const { t } = useTranslation('settings');

  useEffect(() => { adminStore.fetchPrompts(); }, [adminStore]);

  const grouped = AGENT_TYPES.map((agentType) => ({
    agentType,
    name: t(`prompts.agents.${agentType}.name`),
    description: t(`prompts.agents.${agentType}.description`),
    prompts: adminStore.prompts.filter((p) => p.agentType === agentType),
  }));

  return (
    <div className="bg-white rounded-xl border p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Bot className="w-5 h-5 text-gray-700" />
        <h2 className="text-lg font-semibold text-gray-900">{t('prompts.title')}</h2>
      </div>
      <p className="text-sm text-gray-500">{t('prompts.description')}</p>
      {adminStore.promptsLoading && adminStore.prompts.length === 0 ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        grouped.map((group) => (
          <div key={group.agentType} className="space-y-3">
            <div className="border-b pb-2">
              <h3 className="font-semibold text-gray-800">{group.name}</h3>
              <p className="text-xs text-gray-500">{group.description}</p>
            </div>
            <div className="space-y-2">
              {group.prompts.map((prompt) => <PromptCard key={`${prompt.agentType}-${prompt.promptKey}`} prompt={prompt} />)}
              {group.prompts.length === 0 && <p className="text-sm text-gray-400 py-2">{t('prompts.noPrompts')}</p>}
            </div>
          </div>
        ))
      )}
    </div>
  );
});
