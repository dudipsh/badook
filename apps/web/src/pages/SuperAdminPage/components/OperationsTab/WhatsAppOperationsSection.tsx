import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Send, Loader2, Check, X, MessageSquare } from 'lucide-react';
import { useStores } from '../../../../lib/store-context';
import { WhatsAppLogsTable } from '../../../WhatsAppSettingsPage/components/WhatsAppLogsTable';

export const WhatsAppOperationsSection = observer(() => {
  const { t } = useTranslation('settings');
  const { whatsappStore } = useStores();
  const [testPhone, setTestPhone] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendTest = async () => {
    const cleaned = testPhone.replace(/\D/g, '');
    if (!cleaned || cleaned.length < 10) {
      toast.error(t('whatsapp.testInvalidPhone'));
      return;
    }
    setSending(true);
    try {
      await whatsappStore.sendTest(cleaned);
      toast.success(t('whatsapp.testSent'));
    } catch {
      toast.error(t('whatsapp.testError'));
    } finally {
      setSending(false);
    }
  };

  const { settings } = whatsappStore;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-base-content">{t('operations.whatsappSectionTitle')}</h3>

      <div className="bg-white rounded-xl border border-base-300 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${settings.connected ? 'bg-green-100' : 'bg-base-200'}`}>
            <MessageSquare className={`w-5 h-5 ${settings.connected ? 'text-green-600' : 'text-base-content/40'}`} />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-base-content">{t('whatsapp.providerTitle')}</h4>
            <p className="text-sm text-base-content/50">
              {settings.connected ? (
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="w-3.5 h-3.5" />
                  {t('whatsapp.connected')}
                  {settings.whatsappNumber && ` — ${settings.whatsappNumber}`}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-base-content/40">
                  <X className="w-3.5 h-3.5" />
                  {t('whatsapp.notConnected')}
                </span>
              )}
            </p>
          </div>
        </div>
        <p className="text-xs text-base-content/50 mt-2">
          {t('whatsapp.twilioConfigNote')}
        </p>
      </div>

      {settings.connected && (
        <div className="bg-white rounded-xl border border-base-300 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-5 h-5 text-blue-500" />
            <h4 className="text-lg font-semibold">{t('whatsapp.testTitle')}</h4>
          </div>
          <p className="text-sm text-base-content/50 mb-4">{t('whatsapp.testDescription')}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+972501234567"
              className="flex-1 max-w-xs px-3 py-2 border border-base-300 rounded-lg text-sm"
              dir="ltr"
              onKeyDown={(e) => e.key === 'Enter' && handleSendTest()}
            />
            <button
              onClick={handleSendTest}
              disabled={sending || !testPhone.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {t('whatsapp.sendTestButton')}
            </button>
          </div>
        </div>
      )}

      <WhatsAppLogsTable
        logs={whatsappStore.logs}
        loading={whatsappStore.loading}
      />
    </div>
  );
});
