import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, Sparkles } from 'lucide-react';
import type { AISettings, AISettingsInput, AIModelEntry } from '../../../../services/aiManagement.service';

interface Props {
  settings: AISettings;
  models: AIModelEntry[];
  saving: boolean;
  onSave: (patch: AISettingsInput) => void;
}

const NumberField = ({
  label,
  value,
  min,
  max,
  onSave,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onSave: (v: number) => void;
}) => {
  const { t } = useTranslation('settings');
  const [draft, setDraft] = useState(String(value));
  // Re-sync after the parent persists a new value (per-field save).
  useEffect(() => { setDraft(String(value)); }, [value]);
  const changed = draft !== String(value) && draft.trim() !== '';
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          dir="ltr"
        />
        <button
          onClick={() => onSave(Math.max(min, Math.min(max, Number(draft))))}
          disabled={!changed}
          className="text-xs bg-primary text-white px-2.5 py-1.5 rounded-lg disabled:opacity-40 flex items-center gap-1"
        >
          <Check size={12} /> {t('aiManagement.save')}
        </button>
      </div>
    </div>
  );
};

const ModelSelect = ({
  label,
  hint,
  value,
  models,
  allowEmpty,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  models: AIModelEntry[];
  allowEmpty?: boolean;
  onChange: (v: string) => void;
}) => {
  const { t } = useTranslation('settings');
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        {allowEmpty && <option value="">{t('aiManagement.useDefault')}</option>}
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} · ${m.inPerM}/${m.outPerM}
          </option>
        ))}
      </select>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
};

export const AISettingsCard = ({ settings, models, saving, onSave }: Props) => {
  const { t } = useTranslation('settings');

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t('aiManagement.title')}</h3>
            <p className="text-xs text-gray-500">{t('aiManagement.subtitle')}</p>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          {saving && <Loader2 size={14} className="animate-spin text-gray-400" />}
          <span className="text-xs font-medium text-gray-600">{t('aiManagement.enabled')}</span>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => onSave({ enabled: e.target.checked })}
            className="w-4 h-4 accent-purple-600"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ModelSelect
          label={t('aiManagement.defaultModel')}
          value={settings.defaultModel}
          models={models}
          onChange={(v) => onSave({ defaultModel: v })}
        />
        <ModelSelect
          label={t('aiManagement.fileModel')}
          hint={t('aiManagement.fileModelHint')}
          value={settings.fileModel || ''}
          models={models.filter((m) => m.vision)}
          allowEmpty
          onChange={(v) => onSave({ fileModel: v })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NumberField label={t('aiManagement.maxOutputTokens')} value={settings.maxOutputTokens} min={256} max={65536} onSave={(v) => onSave({ maxOutputTokens: v })} />
        <NumberField label={t('aiManagement.thinkingBudget')} value={settings.thinkingBudget} min={0} max={65536} onSave={(v) => onSave({ thinkingBudget: v })} />
        <NumberField label={t('aiManagement.maxContextTokens')} value={settings.maxContextTokens} min={1000} max={1000000} onSave={(v) => onSave({ maxContextTokens: v })} />
        <NumberField label={t('aiManagement.monthlyQueryQuota')} value={settings.monthlyQueryQuota} min={0} max={1000000} onSave={(v) => onSave({ monthlyQueryQuota: v })} />
        <NumberField label={t('aiManagement.maxAttachmentsPerMessage')} value={settings.maxAttachmentsPerMessage} min={1} max={20} onSave={(v) => onSave({ maxAttachmentsPerMessage: v })} />
        <NumberField label={t('aiManagement.maxAttachmentSizeMb')} value={settings.maxAttachmentSizeMb} min={1} max={50} onSave={(v) => onSave({ maxAttachmentSizeMb: v })} />
      </div>

      <label className="flex items-center gap-2 cursor-pointer pt-1">
        <input
          type="checkbox"
          checked={settings.autoFilterLargeFiles}
          onChange={(e) => onSave({ autoFilterLargeFiles: e.target.checked })}
          className="w-4 h-4 accent-purple-600"
        />
        <span className="text-sm text-gray-700">{t('aiManagement.autoFilterLargeFiles')}</span>
      </label>
    </div>
  );
};
