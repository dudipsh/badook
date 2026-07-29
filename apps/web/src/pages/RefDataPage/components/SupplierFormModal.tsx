import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { refDataApi, type RefSupplier } from '../api';

interface SupplierFormModalProps {
  supplier: RefSupplier | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}

export const SupplierFormModal = ({ supplier, categories, onClose, onSaved }: SupplierFormModalProps) => {
  const { t } = useTranslation('ref-data');
  const { t: tc } = useTranslation('common');
  const isEdit = !!supplier;

  const [name, setName] = useState(supplier?.name ?? '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(supplier?.categories ?? []);
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [address, setAddress] = useState(supplier?.address ?? '');
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const addCategory = (cat: string) => {
    const trimmed = cat.trim();
    if (trimmed && !selectedCategories.includes(trimmed)) {
      setSelectedCategories([...selectedCategories, trimmed]);
    }
    setNewCategory('');
  };

  const removeCategory = (cat: string) => {
    setSelectedCategories(selectedCategories.filter((c) => c !== cat));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const dto = {
        name: name.trim(),
        categories: selectedCategories,
        phone: phone.trim() || null,
        address: address.trim() || null,
      };

      if (isEdit) {
        await refDataApi.updateSupplier(supplier.id, dto);
      } else {
        await refDataApi.createSupplier(dto);
      }
      toast.success(tc('save'));
      onSaved();
    } catch {
      toast.error(tc('status.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {isEdit ? t('suppliers.editSupplier') : t('suppliers.addSupplier')}
          </h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label text-sm font-medium">{t('suppliers.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input input-bordered w-full"
              required
            />
          </div>

          <div>
            <label className="label text-sm font-medium">{t('suppliers.categories')}</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {selectedCategories.map((c) => (
                <span key={c} className="badge badge-sm gap-1">
                  {c}
                  <button type="button" onClick={() => removeCategory(c)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                list="supplier-categories"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addCategory(newCategory); }
                }}
                className="input input-bordered input-sm flex-1"
                placeholder="הוסף קטגוריה..."
              />
              <button type="button" onClick={() => addCategory(newCategory)} className="btn btn-sm btn-ghost">
                {tc('add')}
              </button>
              <datalist id="supplier-categories">
                {categories.filter((c) => !selectedCategories.includes(c)).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-sm font-medium">{t('suppliers.phone')}</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input input-bordered w-full"
                dir="ltr"
              />
            </div>
            <div>
              <label className="label text-sm font-medium">{t('suppliers.address')}</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">{tc('cancel')}</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? tc('loading') : tc('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
