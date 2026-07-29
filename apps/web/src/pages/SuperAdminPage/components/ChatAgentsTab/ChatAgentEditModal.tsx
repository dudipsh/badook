import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStores } from '../../../../lib/store-context';
import type { ChatAgent, ChatAgentInput, ChatProvider } from '../../../../services/admin.service';

interface Props {
  agent: ChatAgent | null;
  onClose: () => void;
}

const MODELS_BY_PROVIDER: Record<ChatProvider, string[]> = {
  GEMINI: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  OPENAI: ['gpt-4o-mini', 'gpt-4o'],
};

export const ChatAgentEditModal = ({ agent, onClose }: Props) => {
  const { t } = useTranslation('chat');
  const { adminStore } = useStores();

  const [form, setForm] = useState<ChatAgentInput>({
    name: agent?.name ?? '',
    description: agent?.description ?? '',
    systemPrompt: agent?.systemPrompt ?? '',
    provider: agent?.provider ?? 'GEMINI',
    model: agent?.model ?? 'gemini-2.5-flash',
    temperature: agent?.temperature ?? 0.7,
    maxTokens: agent?.maxTokens ?? 1500,
    hasTools: agent?.hasTools ?? false,
    isEnabled: agent?.isEnabled ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.systemPrompt.trim()) return;
    setSaving(true);
    try {
      if (agent) {
        await adminStore.updateChatAgent(agent.id, form);
      } else {
        await adminStore.createChatAgent(form);
      }
      onClose();
    } catch {
      toast.error(t('admin.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof ChatAgentInput>(key: K, value: ChatAgentInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleProviderChange = (provider: ChatProvider) => {
    setForm((prev) => ({
      ...prev,
      provider,
      model: MODELS_BY_PROVIDER[provider][0],
    }));
  };

  const currentProvider: ChatProvider = (form.provider as ChatProvider) ?? 'GEMINI';
  const modelsForProvider = MODELS_BY_PROVIDER[currentProvider];

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-base-100 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-base-300 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles size={20} className="text-primary" />
            </div>
            <h3 className="text-lg font-bold text-base-content">
              {agent ? t('admin.edit') : t('admin.create')}
            </h3>
          </div>
          <button onClick={onClose} className="text-base-content/40 hover:text-base-content/60 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-base-content mb-2">
              {t('admin.fields.name')}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder={t('admin.fields.namePlaceholder')}
              required
              className="w-full px-4 py-2.5 border border-base-300 rounded-lg text-sm bg-base-100 text-base-content placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content mb-2">
              {t('admin.fields.description')}
            </label>
            <input
              type="text"
              value={form.description ?? ''}
              onChange={(e) => update('description', e.target.value)}
              placeholder={t('admin.fields.descriptionPlaceholder')}
              className="w-full px-4 py-2.5 border border-base-300 rounded-lg text-sm bg-base-100 text-base-content placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content mb-2">
              {t('admin.fields.systemPrompt')}
            </label>
            <textarea
              value={form.systemPrompt}
              onChange={(e) => update('systemPrompt', e.target.value)}
              placeholder={t('admin.fields.systemPromptPlaceholder')}
              required
              rows={8}
              className="w-full px-4 py-2.5 border border-base-300 rounded-lg text-sm bg-base-100 text-base-content placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 font-mono leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-base-content mb-2">
                {t('admin.fields.provider')}
              </label>
              <select
                value={currentProvider}
                onChange={(e) => handleProviderChange(e.target.value as ChatProvider)}
                className="w-full px-3 py-2.5 border border-base-300 rounded-lg text-sm bg-base-100 text-base-content focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              >
                <option value="GEMINI">Gemini</option>
                <option value="OPENAI">OpenAI</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-base-content mb-2">
                {t('admin.fields.model')}
              </label>
              <select
                value={form.model}
                onChange={(e) => update('model', e.target.value)}
                className="w-full px-3 py-2.5 border border-base-300 rounded-lg text-sm bg-base-100 text-base-content focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              >
                {modelsForProvider.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-base-content mb-2">
                {t('admin.fields.temperature')}
              </label>
              <input
                type="number"
                value={form.temperature}
                onChange={(e) => update('temperature', Number(e.target.value))}
                min={0}
                max={2}
                step={0.1}
                className="w-full px-3 py-2.5 border border-base-300 rounded-lg text-sm bg-base-100 text-base-content focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-base-content mb-2">
                {t('admin.fields.maxTokens')}
              </label>
              <input
                type="number"
                value={form.maxTokens}
                onChange={(e) => update('maxTokens', Number(e.target.value))}
                min={100}
                max={8000}
                step={100}
                className="w-full px-3 py-2.5 border border-base-300 rounded-lg text-sm bg-base-100 text-base-content focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hasTools ?? false}
                onChange={(e) => update('hasTools', e.target.checked)}
                className="checkbox checkbox-primary checkbox-sm"
              />
              <span className="text-sm text-base-content">{t('admin.fields.hasTools')}</span>
              <span className="text-xs text-base-content/50">{t('admin.fields.hasToolsHint')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isEnabled ?? true}
                onChange={(e) => update('isEnabled', e.target.checked)}
                className="checkbox checkbox-primary checkbox-sm"
              />
              <span className="text-sm text-base-content">{t('admin.fields.isEnabled')}</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-base-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-base-content/60 hover:text-base-content transition-colors"
            >
              {t('admin.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim() || !form.systemPrompt.trim()}
              className="inline-flex items-center gap-2 bg-primary text-primary-content px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? t('admin.saving') : t('admin.save')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};
