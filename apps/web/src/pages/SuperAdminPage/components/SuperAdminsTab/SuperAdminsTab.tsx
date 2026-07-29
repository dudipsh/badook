import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus, Trash2, ShieldCheck, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStores } from '../../../../lib/store-context';
import { adminService, type SuperAdmin } from '../../../../services/admin.service';

export const SuperAdminsTab = observer(() => {
  const { t } = useTranslation('settings');
  const { authStore } = useStores();
  const [admins, setAdmins] = useState<SuperAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    adminService
      .listSuperAdmins()
      .then(setAdmins)
      .catch(() => toast.error(t('superAdmins.loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(load, [t]);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      const created = await adminService.createSuperAdmin(form);
      setAdmins((prev) => {
        const without = prev.filter((a) => a.id !== created.id);
        return [...without, created];
      });
      setForm({ name: '', email: '' });
      toast.success(t('superAdmins.added'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('superAdmins.createError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('superAdmins.deleteConfirm'))) return;
    setDeletingId(id);
    try {
      await adminService.deleteSuperAdmin(id);
      setAdmins((prev) => prev.filter((a) => a.id !== id));
      toast.success(t('superAdmins.deleted'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('superAdmins.deleteError'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-gray-700" />
          {t('superAdmins.title')}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{t('superAdmins.subtitle')}</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('superAdmins.addTitle')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
          <input
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder={t('superAdmins.name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            placeholder="name@example.com"
            type="email"
            dir="ltr"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <button
            onClick={handleAdd}
            disabled={saving || !form.name.trim() || !form.email.trim()}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {t('superAdmins.add')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : admins.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">{t('superAdmins.empty')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-start ps-5 py-3">{t('superAdmins.name')}</th>
                <th className="text-start py-3">{t('superAdmins.email')}</th>
                <th className="text-start py-3">{t('superAdmins.status')}</th>
                <th className="w-16 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => {
                const isSelf = a.id === authStore.user?.id;
                return (
                  <tr key={a.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="ps-5 py-3 font-medium text-gray-800">
                      {a.name}
                      {isSelf && <span className="ms-2 text-[10px] text-gray-400">({t('superAdmins.you')})</span>}
                    </td>
                    <td className="py-3 text-gray-600 font-mono" dir="ltr">{a.email}</td>
                    <td className="py-3">
                      {a.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700"><Check size={12} /> {t('superAdmins.active')}</span>
                      ) : (
                        <span className="text-xs text-gray-400">{t('superAdmins.inactive')}</span>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      {!isSelf && (
                        <button
                          onClick={() => handleDelete(a.id)}
                          disabled={deletingId === a.id}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                          title={t('superAdmins.delete')}
                        >
                          {deletingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
});
