import { useTranslation } from 'react-i18next';
import type { DocumentType } from '@/types/sample.types';

interface FormHeaderProps {
  data: Record<string, unknown>;
  documentType: DocumentType;
  onChange: (field: string, value: string) => void;
  geminiData?: Record<string, unknown> | null;
}

const FormHeader = ({ data, documentType, onChange, geminiData }: FormHeaderProps) => {
  const { t } = useTranslation();

  const isChanged = (field: string): boolean => {
    if (!geminiData) return false;
    return String(data[field] ?? '') !== String(geminiData[field] ?? '');
  };

  const fieldClass = (field: string) =>
    `input input-bordered input-sm w-full ${isChanged(field) ? 'border-warning bg-warning/5' : ''}`;

  const getDocNumberField = (): { key: string; label: string } => {
    switch (documentType) {
      case 'DELIVERY_NOTE':
        return { key: 'noteNumber', label: t('form.documentNumber') };
      case 'INVOICE':
        return { key: 'invoiceNumber', label: t('form.documentNumber') };
      case 'PURCHASE_ORDER':
        return { key: 'poNumber', label: t('form.documentNumber') };
    }
  };

  const getDateFields = (): { key: string; label: string }[] => {
    switch (documentType) {
      case 'DELIVERY_NOTE':
        return [
          { key: 'deliveryDate', label: t('form.deliveryDate') },
        ];
      case 'INVOICE':
        return [
          { key: 'invoiceDate', label: t('form.documentDate') },
          { key: 'dueDate', label: t('form.dueDate') },
        ];
      case 'PURCHASE_ORDER':
        return [
          { key: 'orderDate', label: t('form.orderDate') },
          { key: 'expectedDelivery', label: t('form.expectedDelivery') },
        ];
    }
  };

  const docNumber = getDocNumberField();
  const dateFields = getDateFields();

  const extraFields: { key: string; label: string }[] = [];
  if (documentType === 'DELIVERY_NOTE' || documentType === 'PURCHASE_ORDER') {
    extraFields.push({ key: 'deliveryAddress', label: t('form.deliveryAddress') });
    extraFields.push({ key: 'projectName', label: t('form.projectName') });
  }
  if (documentType === 'DELIVERY_NOTE' || documentType === 'INVOICE') {
    extraFields.push({ key: 'poReference', label: t('form.poReference') });
  }
  if (documentType === 'INVOICE') {
    extraFields.push({ key: 'deliveryNoteReferences', label: t('form.deliveryNoteReferences') });
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm border-b border-base-300 pb-2">{t('form.headerInfo')}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="form-control">
          <label className="label py-0.5">
            <span className="label-text text-xs">{docNumber.label}</span>
          </label>
          <input
            className={fieldClass(docNumber.key)}
            value={String(data[docNumber.key] ?? '')}
            onChange={(e) => onChange(docNumber.key, e.target.value)}
          />
        </div>
        {dateFields.map((field) => (
          <div key={field.key} className="form-control">
            <label className="label py-0.5">
              <span className="label-text text-xs">{field.label}</span>
            </label>
            <input
              className={fieldClass(field.key)}
              value={String(data[field.key] ?? '')}
              onChange={(e) => onChange(field.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <h3 className="font-semibold text-sm border-b border-base-300 pb-2">{t('form.supplierInfo')}</h3>
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: 'supplierName', label: t('form.supplierName') },
          { key: 'supplierBusinessId', label: t('form.supplierBusinessId') },
          { key: 'supplierAddress', label: t('form.supplierAddress') },
          { key: 'supplierPhone', label: t('form.supplierPhone') },
        ].map((field) => (
          <div key={field.key} className="form-control">
            <label className="label py-0.5">
              <span className="label-text text-xs">{field.label}</span>
            </label>
            <input
              className={fieldClass(field.key)}
              value={String(data[field.key] ?? '')}
              onChange={(e) => onChange(field.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <h3 className="font-semibold text-sm border-b border-base-300 pb-2">{t('form.customerInfo')}</h3>
      <div className="form-control">
        <label className="label py-0.5">
          <span className="label-text text-xs">{t('form.customerName')}</span>
        </label>
        <input
          className={fieldClass('customerName')}
          value={String(data['customerName'] ?? '')}
          onChange={(e) => onChange('customerName', e.target.value)}
        />
      </div>

      {extraFields.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {extraFields.map((field) => (
            <div key={field.key} className="form-control">
              <label className="label py-0.5">
                <span className="label-text text-xs">{field.label}</span>
              </label>
              <input
                className={fieldClass(field.key)}
                value={
                  Array.isArray(data[field.key])
                    ? (data[field.key] as string[]).join(', ')
                    : String(data[field.key] ?? '')
                }
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FormHeader;
