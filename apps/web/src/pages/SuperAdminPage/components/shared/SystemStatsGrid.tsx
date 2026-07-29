import { FileText, ClipboardList, Receipt, Building2, GitCompare, Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SystemStats } from '../../../../services/admin.service';

const STAT_CARDS = [
  { key: 'deliveryNotes', labelKey: 'systemStats.deliveryNotes', icon: FileText, color: 'text-blue-600 bg-blue-50' },
  { key: 'purchaseOrders', labelKey: 'systemStats.purchaseOrders', icon: ClipboardList, color: 'text-purple-600 bg-purple-50' },
  { key: 'invoices', labelKey: 'systemStats.invoices', icon: Receipt, color: 'text-green-600 bg-green-50' },
  { key: 'suppliers', labelKey: 'systemStats.suppliers', icon: Building2, color: 'text-orange-600 bg-orange-50' },
  { key: 'matches', labelKey: 'systemStats.matches', icon: GitCompare, color: 'text-purple-600 bg-purple-50' },
  { key: 'feedbacks', labelKey: 'systemStats.feedbacks', icon: Brain, color: 'text-pink-600 bg-pink-50' },
] as const;

export const SystemStatsGrid = ({ stats }: { stats: SystemStats | null }) => {
  const { t } = useTranslation('settings');
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {STAT_CARDS.map((card) => (
        <div key={card.key} className="bg-white rounded-xl border p-4 flex flex-col items-center gap-2">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
            <card.icon className="w-5 h-5" />
          </div>
          <span className="text-2xl font-bold text-gray-900">{stats[card.key]}</span>
          <span className="text-sm text-gray-500">{t(card.labelKey)}</span>
        </div>
      ))}
    </div>
  );
}
