import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, MessageSquare, Coins, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  aiManagementService,
  type AISettings,
  type AISettingsInput,
  type AIModelEntry,
  type AIUsageSnapshot,
} from '../../../../services/aiManagement.service';
import { AISettingsCard } from './AISettingsCard';

const UsageTile = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
    <div className="text-secondary">{icon}</div>
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900" dir="ltr">{value}</p>
    </div>
  </div>
);

export const CompanyAITab = () => {
  const { t } = useTranslation('settings');
  const { companyId } = useParams<{ companyId: string }>();

  const [settings, setSettings] = useState<AISettings | null>(null);
  const [usage, setUsage] = useState<AIUsageSnapshot | null>(null);
  const [models, setModels] = useState<AIModelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([aiManagementService.get(companyId), aiManagementService.listModels()])
      .then(([data, modelList]) => {
        setSettings(data.settings);
        setUsage(data.usage);
        setModels(modelList);
      })
      .catch(() => toast.error(t('aiManagement.loadError')))
      .finally(() => setLoading(false));
  }, [companyId, t]);

  const handleSave = async (patch: AISettingsInput) => {
    if (!companyId) return;
    setSaving(true);
    try {
      const updated = await aiManagementService.update(companyId, patch);
      setSettings(updated);
      toast.success(t('aiManagement.saved'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('aiManagement.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <UsageTile
          icon={<MessageSquare size={18} />}
          label={t('aiManagement.queries')}
          value={`${usage?.queriesUsed ?? 0} / ${settings.monthlyQueryQuota}`}
        />
        <UsageTile
          icon={<Cpu size={18} />}
          label={t('aiManagement.tokens')}
          value={`${(usage?.tokensIn ?? 0) + (usage?.tokensOut ?? 0)}`}
        />
        <UsageTile
          icon={<Coins size={18} />}
          label={t('aiManagement.cost')}
          value={`$${(usage?.costUsd ?? 0).toFixed(4)}`}
        />
      </div>
      <AISettingsCard settings={settings} models={models} saving={saving} onSave={handleSave} />
    </div>
  );
};
