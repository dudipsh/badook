import { useTranslation } from 'react-i18next';
import { POSectionTitle } from './POSectionTitle';

interface PODeliverySectionProps {
  siteContact: string;
  setSiteContact: (contact: string) => void;
  sitePhone: string;
  setSitePhone: (phone: string) => void;
  deliveryNotes: string;
  setDeliveryNotes: (notes: string) => void;
}

export const PODeliverySection = ({
  siteContact,
  setSiteContact,
  sitePhone,
  setSitePhone,
  deliveryNotes,
  setDeliveryNotes,
}: PODeliverySectionProps) => {
  const { t } = useTranslation('projects');

  return (
    <>
      <POSectionTitle icon="🚚" title={t('createPO.shippingAndNotes')} />
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-base-content/60 mb-1.5">{t('createPO.siteContact')}</label>
            <input
              type="text"
              value={siteContact}
              onChange={(e) => setSiteContact(e.target.value)}
              placeholder={t('createPO.fullName')}
              className="w-full px-3 py-2.5 border border-base-300 rounded-lg text-sm placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-content/60 mb-1.5">{t('createPO.phone')}</label>
            <input
              type="tel"
              value={sitePhone}
              onChange={(e) => setSitePhone(e.target.value)}
              placeholder={t('createPO.phonePlaceholder')}
              className="w-full px-3 py-2.5 border border-base-300 rounded-lg text-sm placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary/50"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-base-content/60 mb-1.5">{t('createPO.shippingInstructions')}</label>
          <textarea
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            rows={3}
            placeholder={t('createPO.notesPlaceholder')}
            className="w-full px-3 py-2.5 border border-base-300 rounded-lg text-sm placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary/50 resize-none"
          />
        </div>
      </div>
    </>
  );
};
