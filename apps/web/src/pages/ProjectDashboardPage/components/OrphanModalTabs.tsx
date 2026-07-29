import { useTranslation } from 'react-i18next';
import { FileText, Receipt, ShoppingCart } from 'lucide-react';

const TAB_KEYS = [
  { key: 'deliveryNotes' as const, labelKey: 'documents.deliveryNotes', icon: FileText },
  { key: 'purchaseOrders' as const, labelKey: 'documents.purchaseOrders', icon: ShoppingCart },
  { key: 'invoices' as const, labelKey: 'documents.invoices', icon: Receipt },
];

export type OrphanTabKey = (typeof TAB_KEYS)[number]['key'];

interface OrphanModalTabsProps {
  activeTab: OrphanTabKey;
  getTabCount: (key: OrphanTabKey) => number;
  onTabChange: (key: OrphanTabKey) => void;
}

export const OrphanModalTabs = ({ activeTab, getTabCount, onTabChange }: OrphanModalTabsProps) => {
  const { t } = useTranslation('projects');

  return (
    <div className="flex border-b border-base-300 px-6">
      {TAB_KEYS.map((tab) => {
        const count = getTabCount(tab.key);
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              isActive ? 'border-secondary text-secondary' : 'border-transparent text-base-content/50 hover:text-base-content'
            }`}
          >
            <tab.icon size={16} />
            {t(tab.labelKey)}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              isActive ? 'bg-secondary/20 text-secondary' : 'bg-base-200 text-base-content/50'
            }`}>{count}</span>
          </button>
        );
      })}
    </div>
  );
};
