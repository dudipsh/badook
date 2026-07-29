import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { refDataApi, type RefProduct } from '../api';
import { Pagination } from './Pagination';
import { ProductFormModal } from './ProductFormModal';

const LIMIT = 30;

export const ProductsTab = () => {
  const { t } = useTranslation('ref-data');
  const { t: tc } = useTranslation('common');

  const [items, setItems] = useState<RefProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<RefProduct | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const load = useCallback(async (p = page, s = search, c = category) => {
    setLoading(true);
    try {
      const result = await refDataApi.listProducts({ page: p, limit: LIMIT, search: s || undefined, category: c || undefined });
      setItems(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, search, category]);

  useEffect(() => {
    load(page, search, category);
  }, [page, search, category]);

  useEffect(() => {
    refDataApi.productCategories().then(setCategories).catch(() => {});
  }, []);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setPage(1);
  };

  const handleDelete = async (item: RefProduct) => {
    if (!confirm(t('products.deleteConfirm'))) return;
    try {
      await refDataApi.deleteProduct(item.id);
      toast.success(tc('delete'));
      load(page, search, category);
    } catch {
      toast.error(tc('status.failed'));
    }
  };

  const handleSaved = () => {
    setShowAddModal(false);
    setEditingItem(null);
    load(page, search, category);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={tc('search')}
            className="input input-bordered input-sm w-full ps-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="select select-bordered select-sm"
        >
          <option value="">{t('products.allCategories')}</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm gap-1">
          <Plus className="w-4 h-4" />
          {t('products.addProduct')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-500">
                <th className="py-3 px-4 text-start font-medium">{t('products.name')}</th>
                <th className="py-3 px-4 text-start font-medium">{t('products.category')}</th>
                <th className="py-3 px-4 text-start font-medium">{t('products.unit')}</th>
                <th className="py-3 px-4 text-start font-medium">{t('products.avgPrice')}</th>
                <th className="py-3 px-4 text-start font-medium">{t('products.variants')}</th>
                <th className="py-3 px-4 text-center font-medium w-24">{tc('edit')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">{tc('loading')}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">{t('products.noProducts')}</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-4 font-medium">{item.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="badge badge-sm badge-ghost">{item.category}</span>
                    </td>
                    <td className="py-2.5 px-4">{item.unit}</td>
                    <td className="py-2.5 px-4" dir="ltr">
                      {item.avgPrice > 0 ? `${item.avgPrice.toLocaleString()} ₪` : '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      {item.variants.length > 0 ? (
                        <span className="text-gray-500 text-xs">{item.variants.join(', ')}</span>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setEditingItem(item)} className="btn btn-ghost btn-xs">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(item)} className="btn btn-ghost btn-xs text-error">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="border-t px-4">
            <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Modals */}
      {(showAddModal || editingItem) && (
        <ProductFormModal
          product={editingItem}
          categories={categories}
          onClose={() => { setShowAddModal(false); setEditingItem(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};
