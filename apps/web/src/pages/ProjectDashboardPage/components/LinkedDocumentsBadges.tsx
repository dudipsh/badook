import { useTranslation } from 'react-i18next';
import { Link, Package, Receipt } from 'lucide-react';
import { useStores } from '../../../lib/store-context';
import { BadgeOrDropdown } from './BadgeOrDropdown';
import { useLinkedDocuments } from './useLinkedDocuments';
import type { ItemGroup } from '../utils/groupItems';
import type { GroupByValue } from '../../../types/reconciliation';

interface LinkedDocumentsBadgesProps {
  group: ItemGroup;
  groupBy: GroupByValue;
}

export const LinkedDocumentsBadges = ({ group, groupBy }: LinkedDocumentsBadgesProps) => {
  const { t } = useTranslation('projects');
  const { projectDashboardStore } = useStores();
  const { uniquePOs, uniqueDCs, uniqueInvoices } = useLinkedDocuments(group.items);

  const handleSwitch = (docId: string, targetGroupBy: GroupByValue) => {
    projectDashboardStore.switchToDoc(docId, targetGroupBy);
  };

  const showPOs = (groupBy === 'deliveryNotes' || groupBy === 'invoices') && uniquePOs.length > 0;
  const showDCs = (groupBy === 'orders' || groupBy === 'invoices') && uniqueDCs.length > 0;
  const showInvoices = groupBy !== 'invoices' && uniqueInvoices.length > 0;

  return (
    <div className="flex items-center gap-2">
      {showPOs && (
        <>
          <span className="text-base-content/20">|</span>
          <BadgeOrDropdown
            items={uniquePOs}
            icon={<Link size={12} className="text-base-content/50" />}
            title={t('docView.linkedPoTitle')}
            dropdownTitle={t('docView.linkedPos')}
            label={t('docView.pos')}
            onSelect={(id) => handleSwitch(id, 'orders')}
          />
        </>
      )}
      {showDCs && (
        <>
          <span className="text-base-content/20">|</span>
          <BadgeOrDropdown
            items={uniqueDCs}
            icon={<Link size={12} className="text-base-content/50" />}
            title={t('docView.linkedDcTitle')}
            dropdownTitle={t('docView.linkedDcs')}
            label={t('docView.dcs')}
            onSelect={(id) => handleSwitch(id, 'deliveryNotes')}
          />
        </>
      )}
      {showInvoices && (
        <>
          <span className="text-base-content/20">|</span>
          <BadgeOrDropdown
            items={uniqueInvoices}
            icon={<Receipt size={12} className="text-accent opacity-50" />}
            title={t('docView.linkedInvoiceTitle')}
            dropdownTitle={t('docView.linkedInvoices')}
            label={t('docView.invoices')}
            onSelect={(id) => handleSwitch(id, 'invoices')}
          />
        </>
      )}
    </div>
  );
};
