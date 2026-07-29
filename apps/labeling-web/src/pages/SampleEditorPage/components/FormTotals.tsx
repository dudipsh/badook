import { useTranslation } from 'react-i18next';

interface FormTotalsProps {
  data: Record<string, unknown>;
  onChange: (field: string, value: string) => void;
  geminiData?: Record<string, unknown> | null;
}

const FormTotals = ({ data, onChange, geminiData }: FormTotalsProps) => {
  const { t } = useTranslation();

  const isChanged = (field: string): boolean => {
    if (!geminiData) return false;
    return String(data[field] ?? '') !== String(geminiData[field] ?? '');
  };

  const fieldClass = (field: string) =>
    `input input-bordered input-sm w-full ${isChanged(field) ? 'border-warning bg-warning/5' : ''}`;

  const fields = [
    { key: 'subtotal', label: t('form.subtotal') },
    { key: 'vatRate', label: t('form.vatRate') },
    { key: 'vatAmount', label: t('form.vatAmount') },
    { key: 'totalAmount', label: t('form.totalAmount') },
  ];

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm border-b border-base-300 pb-2">{t('form.totals')}</h3>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((field) => (
          <div key={field.key} className="form-control">
            <label className="label py-0.5">
              <span className="label-text text-xs">{field.label}</span>
            </label>
            <input
              className={fieldClass(field.key)}
              type="number"
              step="0.01"
              value={data[field.key] != null ? String(data[field.key]) : ''}
              onChange={(e) => onChange(field.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="form-control">
        <label className="label py-0.5">
          <span className="label-text text-xs">{t('form.notes')}</span>
        </label>
        <textarea
          className={`textarea textarea-bordered textarea-sm w-full ${isChanged('notes') ? 'border-warning bg-warning/5' : ''}`}
          rows={2}
          value={String(data['notes'] ?? '')}
          onChange={(e) => onChange('notes', e.target.value)}
        />
      </div>
    </div>
  );
};

export default FormTotals;
