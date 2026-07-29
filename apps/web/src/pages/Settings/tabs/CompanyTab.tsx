import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

export const CompanyTab = () => {
  const { t } = useTranslation('settings');
  const [companyName, setCompanyName] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [address, setAddress] = useState('');
  const [vatRate, setVatRate] = useState('17');
  const [baseCurrency, setBaseCurrency] = useState('ILS');

  const handleSave = () => {
    toast.success(t('company.savedPlaceholder'));
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="border-b border-base-200 pb-4 mb-6">
        <h2 className="text-xl font-bold text-base-content">{t('company.tabTitle')}</h2>
        <p className="text-sm text-base-content/60 mt-1">{t('company.tabSubtitle')}</p>
      </div>

      <div className="flex items-center gap-6 p-6 bg-base-200/30 rounded-2xl border border-base-200 border-dashed">
        <div className="w-24 h-24 rounded-full bg-base-300 border-2 border-base-200 flex items-center justify-center text-xl font-bold text-base-content/30 shadow-inner shrink-0">
          {(companyName?.[0] || 'B').toUpperCase()}
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-base">{t('company.logo')}</h3>
          <p className="text-sm text-base-content/60">{t('company.logoDesc')}</p>
          <button className="btn btn-sm btn-ghost">{t('company.replaceLogo')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="form-control">
          <label className="label py-1">
            <span className="label-text text-xs font-medium text-base-content/50">{t('company.companyName')}</span>
          </label>
          <input
            type="text"
            className="input border-none bg-base-200/50 hover:bg-base-200 focus:bg-base-100 focus:outline outline-1 outline-primary/30 transition-all input-sm w-full"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            dir="auto"
          />
        </div>
        <div className="form-control">
          <label className="label py-1">
            <span className="label-text text-xs font-medium text-base-content/50">{t('company.businessId')}</span>
          </label>
          <input
            type="text"
            className="input border-none bg-base-200/50 hover:bg-base-200 focus:bg-base-100 focus:outline outline-1 outline-primary/30 transition-all input-sm w-full font-mono"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            dir="auto"
          />
        </div>
      </div>

      <div className="form-control">
        <label className="label py-1">
          <span className="label-text text-xs font-medium text-base-content/50">{t('company.address')}</span>
        </label>
        <input
          type="text"
          className="input border-none bg-base-200/50 hover:bg-base-200 focus:bg-base-100 focus:outline outline-1 outline-primary/30 transition-all input-sm w-full"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          dir="auto"
        />
      </div>

      <div className="divider text-base-content/40 text-sm">{t('company.financialSection')}</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="form-control">
          <label className="label py-1">
            <span className="label-text text-xs font-medium text-base-content/50">{t('company.vatRate')}</span>
          </label>
          <select
            className="select border-none bg-base-200/50 hover:bg-base-200 focus:bg-base-100 focus:outline outline-1 outline-primary/30 transition-all select-sm"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            dir="auto"
          >
            <option value="18">{t('company.vat18')}</option>
            <option value="17">{t('company.vat17')}</option>
            <option value="16">{t('company.vat16')}</option>
            <option value="0">{t('company.vatNone')}</option>
          </select>
          <label className="label">
            <span className="label-text-alt text-base-content/60">{t('company.vatHint')}</span>
          </label>
        </div>
        <div className="form-control">
          <label className="label py-1">
            <span className="label-text text-xs font-medium text-base-content/50">{t('company.baseCurrency')}</span>
          </label>
          <select
            className="select border-none bg-base-200/50 hover:bg-base-200 focus:bg-base-100 focus:outline outline-1 outline-primary/30 transition-all select-sm"
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value)}
          >
            <option value="ILS">{t('company.currencyILS')}</option>
            <option value="USD">{t('company.currencyUSD')}</option>
            <option value="EUR">{t('company.currencyEUR')}</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button className="btn btn-primary btn-sm" onClick={handleSave}>
          {t('company.save')}
        </button>
      </div>
    </div>
  );
};
