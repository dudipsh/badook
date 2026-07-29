import { useTranslation } from 'react-i18next';
import { Database } from 'lucide-react';
import toast from 'react-hot-toast';

const ERP_SYSTEMS = [
  { id: 'priority', nameKey: 'integrations.erp.priority.name', descKey: 'integrations.erp.priority.desc' },
  { id: 'sap', nameKey: 'integrations.erp.sap.name', descKey: 'integrations.erp.sap.desc' },
  { id: 'hashavshevet', nameKey: 'integrations.erp.hashavshevet.name', descKey: 'integrations.erp.hashavshevet.desc' },
] as const;

export const ErpIntegrationTab = () => {
  const { t } = useTranslation('settings');

  const handleConnect = () => {
    toast(t('integrations.erp.comingSoon'), { icon: 'ℹ️' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-base-content">{t('integrations.erp.title')}</h3>
        <p className="text-sm text-base-content/60 mt-1">{t('integrations.erp.desc')}</p>
      </div>

      <div className="space-y-3">
        {ERP_SYSTEMS.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-4 p-4 rounded-xl border border-base-200 hover:bg-base-200/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-base-200/50 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5 text-base-content/60" />
              </div>
              <div>
                <div className="text-sm font-bold">{t(item.nameKey)}</div>
                <p className="text-xs text-base-content/50">{t(item.descKey)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="badge badge-sm badge-ghost opacity-50">{t('integrations.erp.disconnected')}</span>
              <button className="btn btn-sm border-base-300" onClick={handleConnect}>
                {t('integrations.erp.connect')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
