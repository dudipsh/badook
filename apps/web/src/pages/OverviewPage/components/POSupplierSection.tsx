import { useTranslation } from 'react-i18next';
import { POSectionTitle } from './POSectionTitle';
import { SupplierAutocomplete } from './SupplierAutocomplete';

interface POSupplierSectionProps {
  vendorName: string;
  setVendorName: (name: string) => void;
  vendorAddress: string;
  setVendorAddress: (address: string) => void;
  vatNumber: string;
  setVatNumber: (vat: string) => void;
  withholdingTax: string;
  setWithholdingTax: (tax: string) => void;
  onSupplierSelect: (supplier: { name: string; address?: string; businessId?: string }) => void;
}

export const POSupplierSection = ({
  vendorName,
  setVendorName,
  vendorAddress,
  setVendorAddress,
  vatNumber,
  setVatNumber,
  withholdingTax,
  setWithholdingTax,
  onSupplierSelect,
}: POSupplierSectionProps) => {
  const { t } = useTranslation('projects');

  return (
    <>
      <POSectionTitle icon="🏢" title={t('createPO.supplierDetails')} />
      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-base-content/60 mb-1.5">{t('createPO.supplierName')}</label>
          <SupplierAutocomplete
            value={vendorName}
            onChange={setVendorName}
            onSupplierSelect={(supplier) => {
              onSupplierSelect({
                name: supplier.name,
                address: supplier.address ?? undefined,
                businessId: supplier.businessId ?? undefined,
              });
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-base-content/60 mb-1.5">{t('createPO.address')}</label>
          <input
            type="text"
            value={vendorAddress}
            onChange={(e) => setVendorAddress(e.target.value)}
            placeholder={t('createPO.addressPlaceholder')}
            className="w-full px-3 py-2.5 border border-base-300 rounded-lg text-sm placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary/50"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-base-content/60 mb-1.5">{t('createPO.vatId')}</label>
            <input
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              placeholder="000000000"
              className="w-full px-3 py-2.5 border border-base-300 rounded-lg text-sm placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-content/60 mb-1.5">{t('createPO.deductionFile')}</label>
            <input
              type="text"
              value={withholdingTax}
              onChange={(e) => setWithholdingTax(e.target.value)}
              placeholder="000000000"
              className="w-full px-3 py-2.5 border border-base-300 rounded-lg text-sm placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary/50"
            />
          </div>
        </div>
      </div>
    </>
  );
};
