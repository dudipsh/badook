import { useState } from 'react';
import { Settings, Save, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CompanySettings } from '../../../../services/admin.service';
import toast from 'react-hot-toast';
import { ResetConfirmModal } from '../../../../components/shared/ResetConfirmModal';

interface CompanySettingsSectionProps {
  settings: CompanySettings | null;
  onSave: (dto: Partial<CompanySettings>) => Promise<void>;
  autoFixesEnabled?: boolean;
  onAutoFixesChange?: (enabled: boolean) => Promise<void>;
}

export const CompanySettingsSection = ({ settings, onSave, autoFixesEnabled, onAutoFixesChange }: CompanySettingsSectionProps) => {
  const [maxSize, setMaxSize] = useState<number | ''>(settings?.maxUploadSizeMb ?? 20);
  const [vatRate, setVatRate] = useState<number | ''>(settings?.defaultVatRate ?? 18);
  const [saving, setSaving] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const { t } = useTranslation('settings');

  const handleSave = async () => {
    if (!maxSize || maxSize < 1) return;
    setSaving(true);
    try {
      await onSave({ maxUploadSizeMb: maxSize, defaultVatRate: vatRate || 0 });
      toast.success(t('companySettings.settingsUpdated'));
    } catch {
      toast.error(t('companySettings.settingsUpdateError'));
    } finally {
      setSaving(false);
    }
  };

  const handleAutoFixesToggle = async (enabled: boolean) => {
    if (!onAutoFixesChange) return;
    try {
      await onAutoFixesChange(enabled);
      toast.success(t('companySettings.settingsUpdated'));
    } catch {
      toast.error(t('companySettings.settingsUpdateError'));
    }
  };

  return (
    <div className="bg-white rounded-xl border p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Settings className="w-5 h-5" />
        {t('companySettings.title')}
      </h2>
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('companySettings.maxFileSize')}</label>
          <input type="number" min={1} max={500} className="w-32 border rounded-lg px-3 py-2 text-sm"
            value={maxSize} onChange={(e) => setMaxSize(e.target.value ? parseInt(e.target.value, 10) : '')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('companySettings.defaultVatRate')}</label>
          <div className="flex items-center gap-1">
            <input type="number" min={0} max={100} step={0.5} className="w-24 border rounded-lg px-3 py-2 text-sm"
              value={vatRate} onChange={(e) => setVatRate(e.target.value ? parseFloat(e.target.value) : '')} />
            <span className="text-sm text-gray-500">%</span>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving || !maxSize} className="flex items-center gap-1 px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary disabled:opacity-50">
          <Save className="w-4 h-4" />
          {t('common:save')}
        </button>
      </div>
      <p className="text-xs text-gray-500">{t('companySettings.fileSizeNote')}</p>

      {onAutoFixesChange && (
        <>
          <hr className="border-gray-200" />
          <div className="flex items-start gap-3">
            <label className="relative inline-flex items-center cursor-pointer mt-0.5">
              <input
                type="checkbox"
                checked={autoFixesEnabled ?? true}
                onChange={(e) => handleAutoFixesToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </label>
            <div>
              <p className="text-sm font-medium text-gray-900">{t('ocr.autoFixes')}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('ocr.autoFixesDescription')}</p>
            </div>
          </div>
        </>
      )}

      <hr className="border-gray-200" />

      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-1">{t('companySettings.resetData')}</h3>
        <p className="text-xs text-gray-500 mb-3">{t('companySettings.resetDataDescription')}</p>
        <button onClick={() => setShowReset(true)} className="flex items-center gap-1 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">
          <Trash2 className="w-4 h-4" />
          {t('companySettings.resetDataButton')}
        </button>
      </div>

      {showReset && <ResetConfirmModal onClose={() => setShowReset(false)} />}
    </div>
  );
}
