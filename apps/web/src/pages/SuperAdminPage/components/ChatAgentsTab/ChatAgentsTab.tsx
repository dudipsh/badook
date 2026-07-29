import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Sparkles, Plus, Loader2, Trash2, Pencil, Star, StarOff, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useStores } from '../../../../lib/store-context';
import type { ChatAgent } from '../../../../services/admin.service';
import { ChatAgentEditModal } from './ChatAgentEditModal';

export const ChatAgentsTab = observer(() => {
  const { adminStore } = useStores();
  const { t } = useTranslation('chat');
  const [editing, setEditing] = useState<ChatAgent | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void adminStore.fetchChatAgents();
  }, [adminStore]);

  const handleSetDefault = async (agent: ChatAgent) => {
    try {
      await adminStore.setDefaultChatAgent(agent.id);
    } catch {
      toast.error(t('admin.errors.setDefaultFailed'));
    }
  };

  const handleDelete = async (agent: ChatAgent) => {
    if (!window.confirm(t('admin.deleteConfirm', { name: agent.name }))) return;
    try {
      await adminStore.deleteChatAgent(agent.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('admin.errors.deleteFailed'));
    }
  };

  const isLoading = adminStore.chatAgentsLoading && adminStore.chatAgents.length === 0;

  return (
    <div className="bg-base-100 rounded-xl border border-base-300 p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-base-content">{t('admin.title')}</h2>
            <p className="text-sm text-base-content/60 mt-1 max-w-2xl">{t('admin.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-content px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus size={16} />
          {t('admin.create')}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-base-content/40" />
        </div>
      ) : adminStore.chatAgents.length === 0 ? (
        <div className="text-center py-12 text-sm text-base-content/40">{t('admin.noAgents')}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {adminStore.chatAgents.map((agent) => (
            <div
              key={agent.id}
              className={`border rounded-xl p-4 bg-base-100 transition-shadow hover:shadow-md ${
                agent.isDefault ? 'border-primary/40 ring-1 ring-primary/20' : 'border-base-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base-content truncate">{agent.name}</h3>
                    {agent.isDefault && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
                        <Star className="w-3 h-3 fill-current" />
                        {t('admin.default')}
                      </span>
                    )}
                    {agent.hasTools && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-success bg-success/10 px-2 py-0.5 rounded">
                        <Wrench className="w-3 h-3" />
                        {t('admin.dataAccess')}
                      </span>
                    )}
                    {!agent.isEnabled && (
                      <span className="text-[11px] font-bold uppercase tracking-wider text-base-content/40 bg-base-200 px-2 py-0.5 rounded">
                        {t('admin.disabled')}
                      </span>
                    )}
                  </div>
                  {agent.description && (
                    <p className="text-xs text-base-content/60 mt-1">{agent.description}</p>
                  )}
                </div>
              </div>

              <p className="text-sm text-base-content/80 line-clamp-3 whitespace-pre-wrap mt-3 mb-3 font-mono text-[12px] bg-base-200/40 rounded p-2">
                {agent.systemPrompt}
              </p>

              <div className="flex items-center gap-3 text-[11px] text-base-content/50 mb-3 font-mono">
                <span className="font-semibold uppercase tracking-wider">{agent.provider}</span>
                <span>•</span>
                <span>{agent.model}</span>
                <span>•</span>
                <span>T={agent.temperature}</span>
                <span>•</span>
                <span>{agent.maxTokens} tok</span>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-base-200">
                {!agent.isDefault && (
                  <button
                    onClick={() => handleSetDefault(agent)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-base-content/60 hover:text-primary transition-colors px-2 py-1 rounded hover:bg-base-200"
                  >
                    <StarOff className="w-3.5 h-3.5" />
                    {t('admin.setDefault')}
                  </button>
                )}
                <button
                  onClick={() => setEditing(agent)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-base-content/60 hover:text-base-content transition-colors px-2 py-1 rounded hover:bg-base-200"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {t('admin.edit')}
                </button>
                {!agent.isDefault && (
                  <button
                    onClick={() => handleDelete(agent)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-base-content/40 hover:text-error transition-colors px-2 py-1 rounded hover:bg-base-200 ms-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('admin.delete')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ChatAgentEditModal
          agent={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
});
