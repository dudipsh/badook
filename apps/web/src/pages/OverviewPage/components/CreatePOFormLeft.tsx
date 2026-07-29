import { useStores } from '../../../lib/store-context';
import type { useCreatePOForm } from './useCreatePOForm';
import { POOrderDetailsSection } from './POOrderDetailsSection';
import { POSupplierSection } from './POSupplierSection';
import { POLineItemsSection } from './POLineItemsSection';
import { POFinancialSummary } from './POFinancialSummary';
import { PODeliverySection } from './PODeliverySection';

interface CreatePOFormLeftProps {
  form: ReturnType<typeof useCreatePOForm>;
}

export const CreatePOFormLeft = ({ form }: CreatePOFormLeftProps) => {
  const { projectsStore } = useStores();

  return (
    <div className="w-1/2 overflow-y-auto border-r border-base-300" dir="rtl">
      <div className="p-6 space-y-5">
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-5">
          <POOrderDetailsSection
            projects={form.projects}
            projectId={form.projectId}
            setProjectId={form.setProjectId}
            onCreateProject={async (name, address) => {
              const project = await projectsStore.createProject({ name, address: address || null });
              form.setProjectId(project.id);
            }}
            poNumber={form.poNumber}
            deliveryDate={form.deliveryDate}
            setDeliveryDate={form.setDeliveryDate}
            paymentTerms={form.paymentTerms}
            setPaymentTerms={form.setPaymentTerms}
          />
        </div>

        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-5">
          <POSupplierSection
            vendorName={form.vendorName}
            setVendorName={form.setVendorName}
            vendorAddress={form.vendorAddress}
            setVendorAddress={form.setVendorAddress}
            vatNumber={form.vatNumber}
            setVatNumber={form.setVatNumber}
            withholdingTax={form.withholdingTax}
            setWithholdingTax={form.setWithholdingTax}
            onSupplierSelect={(supplier) => {
              form.setVendorName(supplier.name);
              if (supplier.address) form.setVendorAddress(supplier.address);
              if (supplier.businessId) form.setVatNumber(supplier.businessId);
            }}
          />
        </div>

        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-5">
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

        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-5">
          <PODeliverySection
            siteContact={form.siteContact}
            setSiteContact={form.setSiteContact}
            sitePhone={form.sitePhone}
            setSitePhone={form.setSitePhone}
            deliveryNotes={form.deliveryNotes}
            setDeliveryNotes={form.setDeliveryNotes}
          />
        </div>
      </div>
    </div>
  );
};
