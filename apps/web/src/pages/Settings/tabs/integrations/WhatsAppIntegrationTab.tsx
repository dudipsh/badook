import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { useStores } from '../../../../lib/store-context';
import { AllowedPhonesCard } from '../../../WhatsAppSettingsPage/components/AllowedPhonesCard';

export const WhatsAppIntegrationTab = observer(() => {
  const { t } = useTranslation('settings');
  const { whatsappStore } = useStores();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    whatsappStore.fetchSettings();
    whatsappStore.fetchAllowedPhones();
  }, []);

  const whatsappNumber = whatsappStore.settings.whatsappNumber;
  const normalizePhone = (phone: string) => phone.replace(/[^0-9]/g, '');
  const inviteLink = whatsappNumber
    ? `https://wa.me/${normalizePhone(whatsappNumber)}?text=Join`
    : null;

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success(t('integrations.whatsapp.linkCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('integrations.whatsapp.copyError'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center shrink-0">
          <MessageSquare className="w-5 h-5 text-success" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-base-content">{t('integrations.whatsapp.title')}</h3>
          <p className="text-sm text-base-content/60 mt-1">{t('integrations.whatsapp.desc')}</p>
        </div>
      </div>

      {inviteLink ? (
        <div className="bg-base-100 rounded-xl border border-base-300 p-6 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="inline-flex items-center justify-center w-48 h-48 bg-base-200 border-2 border-dashed border-base-300 rounded-xl">
              <QRCodeSVG value={inviteLink} size={176} />
            </div>
            <p className="text-sm text-base-content/50 text-center max-w-md">
              {t('integrations.whatsapp.qrDescription')}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
              {t('integrations.whatsapp.directLink')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-1 px-3 py-2 bg-base-200 border border-base-300 rounded-lg text-sm text-base-content"
                dir="ltr"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2 border border-base-300 hover:bg-base-200 text-base-content text-sm font-medium rounded-lg transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                {copied ? t('integrations.whatsapp.copied') : t('integrations.whatsapp.copyLink')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-base-100 rounded-xl border border-base-300 p-6 text-sm text-base-content/40 text-center">
          {t('integrations.whatsapp.noPhoneConfigured')}
        </div>
      )}

      <AllowedPhonesCard />
    </div>
  );
});
