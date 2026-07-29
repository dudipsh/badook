import { POSupplierSection } from '../../OverviewPage/components/POSupplierSection';
import { POLineItemsSection } from '../../OverviewPage/components/POLineItemsSection';
import { POFinancialSummary } from '../../OverviewPage/components/POFinancialSummary';
import { UploadOrderDetailsSection } from './UploadOrderDetailsSection';
import type { useUploadDocumentForm } from '../hooks/useUploadDocumentForm';

interface Props {
  form: ReturnType<typeof useUploadDocumentForm>;
}

const CARD = 'bg-base-100 rounded-xl shadow-sm border border-base-300 p-5';

export const UploadFormLeft = ({ form }: Props) => (
  <div className="w-1/2 overflow-y-auto border-r border-base-300" dir="rtl">
    <div className="p-6 space-y-5">
      <div className={CARD}>
        <UploadOrderDetailsSection form={form} />
      </div>

      <div className={CARD}>
        <POSupplierSection
          vendorName={form.vendorName}
          setVendorName={form.setVendorName}
          vendorAddress={form.vendorAddress}
          setVendorAddress={form.setVendorAddress}
          vatNumber={form.vatNumber}
          setVatNumber={form.setVatNumber}
          withholdingTax={form.withholdingTax}
          setWithholdingTax={form.setWithholdingTax}
          onSupplierSelect={(s) => {
            form.setVendorName(s.name);
            if (s.address) form.setVendorAddress(s.address);
            if (s.businessId) form.setVatNumber(s.businessId);
          }}
        />
      </div>

      <div className={CARD}>
        <POLineItemsSection
          lineItems={form.lineItems}
          onUpdate={form.updateLineItem}
          onAdd={form.addLineItem}
          onRemove={form.removeLineItem}
        />
      </div>

      <POFinancialSummary
        subtotal={form.subtotal}
        vatRate={form.vatRate}
        vatAmount={form.vatAmount}
        grandTotal={form.grandTotal}
      />
    </div>
  </div>
);
