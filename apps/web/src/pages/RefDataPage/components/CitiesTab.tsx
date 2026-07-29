import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { refDataApi, type RefCity } from '../api';
import { Pagination } from './Pagination';
import { CityFormModal } from './CityFormModal';

const LIMIT = 50;

export const CitiesTab = () => {
  const { t } = useTranslation('ref-data');
  const { t: tc } = useTranslation('common');

  const [items, setItems] = useState<RefCity[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('');
  const [districts, setDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<RefCity | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const load = useCallback(async (p = page, s = search, d = district) => {
    setLoading(true);
    try {
      const result = await refDataApi.listCities({ page: p, limit: LIMIT, search: s || undefined, category: d || undefined });
      setItems(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, search, district]);

  useEffect(() => {
    load(page, search, district);
  }, [page, search, district]);

  useEffect(() => {
    refDataApi.cityDistricts().then(setDistricts).catch(() => {});
  }, []);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleDistrictChange = (value: string) => {
    setDistrict(value);
    setPage(1);
  };

  const handleDelete = async (item: RefCity) => {
    if (!confirm(`למחוק את ${item.name}?`)) return;
    try {
      await refDataApi.deleteCity(item.id);
      toast.success(tc('delete'));
      load(page, search, district);
    } catch {
      toast.error(tc('status.failed'));
    }
  };

  const handleSaved = () => {
    setShowAddModal(false);
    setEditingItem(null);
    load(page, search, district);
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
          value={district}
          onChange={(e) => handleDistrictChange(e.target.value)}
          className="select select-bordered select-sm"
        >
          <option value="">{t('cities.allDistricts')}</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm gap-1">
          <Plus className="w-4 h-4" />
          {tc('add')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-500">
                <th className="py-3 px-4 text-start font-medium">{t('cities.code')}</th>
                <th className="py-3 px-4 text-start font-medium">{t('cities.name')}</th>
                <th className="py-3 px-4 text-start font-medium">{t('cities.englishName')}</th>
                <th className="py-3 px-4 text-start font-medium">{t('cities.district')}</th>
                <th className="py-3 px-4 text-start font-medium">{t('cities.council')}</th>
                <th className="py-3 px-4 text-center font-medium w-24">{tc('edit')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">{tc('loading')}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">{t('cities.noCities')}</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-4 text-gray-500 tabular-nums" dir="ltr">{item.code}</td>
                    <td className="py-2.5 px-4 font-medium">{item.name}</td>
                    <td className="py-2.5 px-4 text-gray-600" dir="ltr">{item.englishName || '—'}</td>
                    <td className="py-2.5 px-4">
                      {item.district ? <span className="badge badge-sm badge-ghost">{item.district}</span> : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600">{item.council || '—'}</td>
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
        <CityFormModal
          city={editingItem}
          onClose={() => { setShowAddModal(false); setEditingItem(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};
