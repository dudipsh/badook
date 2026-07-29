import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { refDataApi, type RefProduct } from '../api';

interface ProductFormModalProps {
  product: RefProduct | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}

export const ProductFormModal = ({ product, categories, onClose, onSaved }: ProductFormModalProps) => {
  const { t } = useTranslation('ref-data');
  const { t: tc } = useTranslation('common');
  const isEdit = !!product;

  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [unit, setUnit] = useState(product?.unit ?? 'יח\'');
  const [avgPrice, setAvgPrice] = useState(product?.avgPrice?.toString() ?? '');
  const [variants, setVariants] = useState(product?.variants?.join(', ') ?? '');
  const [saving, setSaving] = useState(false);

  const UNITS = ['יח\'', 'מ"א', 'מ"ר', 'מ"ק', 'טון', 'ק"ג', 'ליטר', 'שק', 'גליל', 'פח', 'לוח', 'קופסה', 'שפופרת', 'סט', 'זוג', 'משטח'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !category.trim()) return;

    setSaving(true);
    try {
      const dto = {
        name: name.trim(),
        category: category.trim(),
        unit,
        avgPrice: parseFloat(avgPrice) || 0,
        variants: variants ? variants.split(',').map((v) => v.trim()).filter(Boolean) : [],
        commonVendors: product?.commonVendors ?? [],
      };

      if (isEdit) {
        await refDataApi.updateProduct(product.id, dto);
      } else {
        await refDataApi.createProduct(dto);
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
            {isEdit ? t('products.editProduct') : t('products.addProduct')}
          </h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label text-sm font-medium">{t('products.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input input-bordered w-full"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-sm font-medium">{t('products.category')}</label>
              <input
                list="product-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input input-bordered w-full"
                required
              />
              <datalist id="product-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="label text-sm font-medium">{t('products.unit')}</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="select select-bordered w-full">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label text-sm font-medium">{t('products.avgPrice')} (₪)</label>
            <input
              type="number"
              value={avgPrice}
              onChange={(e) => setAvgPrice(e.target.value)}
              className="input input-bordered w-full"
              dir="ltr"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="label text-sm font-medium">{t('products.variants')}</label>
            <input
              type="text"
              value={variants}
              onChange={(e) => setVariants(e.target.value)}
              className="input input-bordered w-full"
              placeholder="Ø8, Ø10, Ø12"
            />
            <p className="text-xs text-gray-400 mt-1">מופרדים בפסיקים</p>
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
