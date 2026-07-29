import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import FormHeader from './FormHeader';
import FormLineItems, { emptyLineItem } from './FormLineItems';
import FormTotals from './FormTotals';
import type { Sample, LineItem, Extraction } from '@/types/sample.types';

interface ExtractionFormProps {
  sample: Sample;
}

export interface ExtractionFormRef {
  getFormData: () => Record<string, unknown>;
}

const cloneExtraction = (extraction: Extraction | null): Record<string, unknown> => {
  if (!extraction) return {};
  return JSON.parse(JSON.stringify(extraction));
};

const cloneLineItems = (extraction: Extraction | null): LineItem[] => {
  if (!extraction?.lineItems) return [];
  return JSON.parse(JSON.stringify(extraction.lineItems));
};

const ExtractionForm = forwardRef<ExtractionFormRef, ExtractionFormProps>(({ sample }, ref) => {
  const sourceExtraction = sample.groundTruth ?? sample.geminiExtraction;
  const geminiExtraction = sample.geminiExtraction;

  const [formData, setFormData] = useState<Record<string, unknown>>(() => cloneExtraction(sourceExtraction));
  const [lineItems, setLineItems] = useState<LineItem[]>(() => cloneLineItems(sourceExtraction));

  useEffect(() => {
    const source = sample.groundTruth ?? sample.geminiExtraction;
    setFormData(cloneExtraction(source));
    setLineItems(cloneLineItems(source));
  }, [sample.id, sample.updatedAt]);

  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleLineItemChange = useCallback(
    (index: number, field: keyof LineItem, value: string | number | null) => {
      setLineItems((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    [],
  );

  const handleAddLineItem = useCallback(() => {
    setLineItems((prev) => [...prev, { ...emptyLineItem }]);
  }, []);

  const handleRemoveLineItem = useCallback((index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  useImperativeHandle(ref, () => ({
    getFormData: () => {
      const totalsFields = ['subtotal', 'vatRate', 'vatAmount', 'totalAmount'];
      const result = { ...formData };
      totalsFields.forEach((field) => {
        const val = result[field];
        if (typeof val === 'string') {
          result[field] = val === '' ? null : parseFloat(val);
        }
      });
      result.lineItems = lineItems;
      return result;
    },
  }));

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
      <FormHeader
        data={formData}
        documentType={sample.documentType}
        onChange={handleFieldChange}
        geminiData={geminiExtraction as Record<string, unknown> | null}
      />
      <div className="divider my-0" />
      <FormLineItems
        lineItems={lineItems}
        onChange={handleLineItemChange}
        onAdd={handleAddLineItem}
        onRemove={handleRemoveLineItem}
        geminiLineItems={geminiExtraction?.lineItems ?? null}
      />
      <div className="divider my-0" />
      <FormTotals
        data={formData}
        onChange={handleFieldChange}
        geminiData={geminiExtraction as Record<string, unknown> | null}
      />
    </div>
  );
});

ExtractionForm.displayName = 'ExtractionForm';

export default ExtractionForm;
