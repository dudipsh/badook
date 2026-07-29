import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus } from 'lucide-react';
import { suppliersService, type Supplier } from '../../../services/suppliers.service';

interface SupplierAutocompleteProps {
  value: string;
  onChange: (name: string) => void;
  onSupplierSelect: (supplier: Supplier) => void;
}

export const SupplierAutocomplete = ({ value, onChange, onSupplierSelect }: SupplierAutocompleteProps) => {
  const { t } = useTranslation('projects');
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    suppliersService.getAll().then(setSuppliers).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = value.trim()
    ? suppliers.filter((s) => s.name.toLowerCase().includes(value.trim().toLowerCase()))
    : suppliers;

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={t('createPO.supplierSearchPlaceholder')}
        className="w-full px-3 py-2.5 border border-base-300 rounded-lg text-sm placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
      />
      {open && (filtered.length > 0 || value.trim()) && (
        <div className="absolute z-10 mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onSupplierSelect(s); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-base-200 transition-colors text-right"
            >
              <span className="text-base-content">{s.name}</span>
              {s.name === value && <Check size={14} className="text-primary shrink-0" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2.5 text-sm text-base-content/40">{t('createPO.noSuppliersFound')}</div>
          )}
          {value.trim() && !suppliers.some((s) => s.name === value.trim()) && (
            <>
              {filtered.length > 0 && <div className="border-t border-base-300" />}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-primary/10 transition-colors font-medium"
              >
                <Plus size={14} />
                {t('createPO.createNewSupplier')}: {value.trim()}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
