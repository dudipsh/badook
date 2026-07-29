import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus, Trash2, Check, Megaphone } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  adminService,
  type SystemMessage,
  type SystemMessageLevel,
} from '../../../../services/admin.service';

const LEVELS: SystemMessageLevel[] = ['INFO', 'WARNING', 'CRITICAL'];

const levelBadge = (level: SystemMessageLevel) =>
  level === 'CRITICAL'
    ? 'bg-red-100 text-red-700'
    : level === 'WARNING'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-blue-100 text-blue-700';

const EMPTY = { title: '', body: '', level: 'INFO' as SystemMessageLevel, isActive: true };

export const SystemMessagesTab = () => {
  const { t } = useTranslation('settings');
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    adminService
      .listSystemMessages()
      .then(setMessages)
      .catch(() => toast.error(t('systemMessages.loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(load, [t]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      const created = await adminService.createSystemMessage(form);
      setMessages((prev) => [created, ...prev]);
      setForm(EMPTY);
      toast.success(t('systemMessages.created'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('systemMessages.createError'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (m: SystemMessage) => {
    setBusyId(m.id);
    try {
      const updated = await adminService.updateSystemMessage(m.id, { isActive: !m.isActive });
      setMessages((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch {
      toast.error(t('systemMessages.updateError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('systemMessages.deleteConfirm'))) return;
    setBusyId(id);
    try {
      await adminService.deleteSystemMessage(id);
      setMessages((prev) => prev.filter((x) => x.id !== id));
      toast.success(t('systemMessages.deleted'));
    } catch {
      toast.error(t('systemMessages.deleteError'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-gray-700" />
          {t('systemMessages.title')}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{t('systemMessages.subtitle')}</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">{t('systemMessages.addTitle')}</h3>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder={t('systemMessages.titleField')}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          dir="auto"
        />
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-20"
          placeholder={t('systemMessages.bodyField')}
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          dir="auto"
        />
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value as SystemMessageLevel })}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>{t(`systemMessages.levels.${l}`)}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            {t('systemMessages.activeNow')}
          </label>
          <button
            onClick={handleCreate}
            disabled={saving || !form.title.trim() || !form.body.trim()}
            className="ms-auto bg-primary text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {t('systemMessages.publish')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">{t('systemMessages.empty')}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {messages.map((m) => (
              <div key={m.id} className="flex items-start gap-3 px-4 py-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${levelBadge(m.level)}`}>
                  {t(`systemMessages.levels.${m.level}`)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-800">{m.title}</div>
                  <div className="text-sm text-gray-600 whitespace-pre-wrap">{m.body}</div>
                </div>
                <button
                  onClick={() => toggleActive(m)}
                  disabled={busyId === m.id}
                  className={`text-xs px-2 py-1 rounded shrink-0 ${m.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {m.isActive ? <span className="inline-flex items-center gap-1"><Check size={12} /> {t('systemMessages.active')}</span> : t('systemMessages.inactive')}
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  disabled={busyId === m.id}
                  className="text-red-500 hover:text-red-700 shrink-0 disabled:opacity-50"
                  title={t('systemMessages.delete')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
