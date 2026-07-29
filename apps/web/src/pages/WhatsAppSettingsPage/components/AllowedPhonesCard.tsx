import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Phone, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';

export const AllowedPhonesCard = observer(() => {
  const { whatsappStore } = useStores();
  const { t } = useTranslation('settings');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (!cleaned || cleaned.length < 10 || cleaned.length > 15) {
      toast.error(t('whatsapp.allowlist.invalidPhone'));
      return;
    }
    setAdding(true);
    try {
      await whatsappStore.addAllowedPhone(cleaned, contactName || undefined);
      setPhoneNumber('');
      setContactName('');
      toast.success(t('whatsapp.allowlist.phoneAdded'));
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (typeof msg === 'string' && msg.includes('Unique constraint')) {
        toast.error(t('whatsapp.allowlist.phoneExists'));
      } else {
        toast.error(t('whatsapp.allowlist.addError'));
      }
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await whatsappStore.updateAllowedPhone(id, { isActive: !isActive });
    } catch {
      toast.error(t('whatsapp.allowlist.updateError'));
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await whatsappStore.removeAllowedPhone(id);
      toast.success(t('whatsapp.allowlist.phoneRemoved'));
    } catch {
      toast.error(t('whatsapp.allowlist.removeError'));
    }
  };

  return (
    <div className="bg-base-100 rounded-xl border border-base-300 p-6">
      <div className="flex items-center gap-2 mb-2">
        <Phone className="w-5 h-5 text-success" />
        <h3 className="text-lg font-semibold">{t('whatsapp.allowlist.title')}</h3>
      </div>
      <p className="text-sm text-base-content/50 mb-4">{t('whatsapp.allowlist.description')}</p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder={t('whatsapp.allowlist.phonePlaceholder')}
          className="flex-1 px-3 py-2 border border-base-300 rounded-lg text-sm"
          dir="ltr"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <input
          type="text"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder={t('whatsapp.allowlist.namePlaceholder')}
          className="flex-1 px-3 py-2 border border-base-300 rounded-lg text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !phoneNumber.trim()}
          className="btn btn-success btn-sm gap-1.5"
        >
          <Plus className="w-4 h-4" />
          {t('common:add')}
        </button>
      </div>

      {whatsappStore.allowedPhones.length > 0 ? (
        <div className="border border-base-300 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-base-200 border-b border-base-300">
                <th className="text-right py-2 px-4 font-medium text-base-content/60">{t('whatsapp.allowlist.phone')}</th>
                <th className="text-right py-2 px-4 font-medium text-base-content/60">{t('whatsapp.allowlist.name')}</th>
                <th className="text-right py-2 px-4 font-medium text-base-content/60">{t('whatsapp.allowlist.status')}</th>
                <th className="py-2 px-4 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {whatsappStore.allowedPhones.map((phone) => (
                <tr key={phone.id} className="border-b border-base-300 last:border-0">
                  <td className="py-2 px-4 font-mono" dir="ltr">{phone.phoneNumber}</td>
                  <td className="py-2 px-4">{phone.contactName || '—'}</td>
                  <td className="py-2 px-4">
                    <button
                      onClick={() => handleToggle(phone.id, phone.isActive)}
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        phone.isActive
                          ? 'bg-success/15 text-success'
                          : 'bg-error/15 text-error'
                      }`}
                    >
                      {phone.isActive ? t('whatsapp.allowlist.active') : t('whatsapp.allowlist.inactive')}
                    </button>
                  </td>
                  <td className="py-2 px-4">
                    <button
                      onClick={() => handleRemove(phone.id)}
                      className="text-error/60 hover:text-error transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-base-content/40 text-center py-4">{t('whatsapp.allowlist.noPhones')}</p>
      )}
    </div>
  );
});
