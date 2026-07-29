import { useTranslation } from 'react-i18next';
import { CreditCard, Mail, Receipt, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export const BillingTab = () => {
  const { t } = useTranslation('settings');

  const handlePlaceholder = () => {
    toast(t('billing.comingSoon'), { icon: 'ℹ️' });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-base-200 pb-6 mb-2">
        <h2 className="text-2xl font-bold text-base-content">{t('billing.tabTitle')}</h2>
        <p className="text-sm text-base-content/60 mt-2">{t('billing.tabSubtitle')}</p>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-gradient-to-bl from-primary/5 via-base-100 to-base-100 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="badge badge-ghost font-bold text-xs px-3 py-2.5">{t('billing.planNotSet')}</span>
              <h3 className="text-base font-bold">{t('billing.currentPlan')}</h3>
            </div>
            <p className="text-xs text-base-content/50 mt-1">{t('billing.planNotSetDesc')}</p>
          </div>
          <button className="btn btn-sm btn-ghost border border-base-200" onClick={handlePlaceholder}>
            {t('billing.choosePlan')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-base-200 border-dashed p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-8 rounded-lg bg-base-200/60 flex items-center justify-center border border-base-300">
              <CreditCard className="w-5 h-5 text-base-content/40" />
            </div>
            <div>
              <div className="text-sm font-bold">{t('billing.noPaymentMethod')}</div>
              <div className="text-xs text-base-content/40">{t('billing.noPaymentMethodDesc')}</div>
            </div>
          </div>
          <button className="btn btn-sm btn-ghost border border-base-200 gap-1.5" onClick={handlePlaceholder}>
            <Plus className="w-4 h-4" />
            {t('billing.addPaymentMethod')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-base-200 border-dashed p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-8 rounded-lg bg-base-200/60 flex items-center justify-center border border-base-300">
              <Mail className="w-5 h-5 text-base-content/40" />
            </div>
            <div>
              <div className="text-sm font-bold">{t('billing.noBillingEmail')}</div>
              <div className="text-xs text-base-content/40">{t('billing.billingEmailDesc')}</div>
            </div>
          </div>
          <button className="btn btn-sm btn-ghost border border-base-200" onClick={handlePlaceholder}>
            {t('billing.setBillingEmail')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-base-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-base-200/30 border-b border-base-200">
          <h3 className="text-sm font-bold">{t('billing.invoiceHistory')}</h3>
        </div>
        <div className="flex flex-col items-center justify-center text-center py-12 opacity-60">
          <Receipt className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-semibold">{t('billing.noInvoices')}</p>
          <p className="text-xs text-base-content/50 mt-1 max-w-xs">{t('billing.noInvoicesDesc')}</p>
        </div>
      </div>
    </div>
  );
};
