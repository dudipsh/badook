import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ProjectVendor } from '../../../types/reconciliation';

interface VendorCardProps {
  vendor: ProjectVendor;
  isActive: boolean;
  onClick: () => void;
}

export const VendorCard = ({ vendor, isActive, onClick }: VendorCardProps) => {
  const { t } = useTranslation('projects');

  const countParts: string[] = [];
  if (vendor.purchaseOrderCount > 0) countParts.push(`${vendor.purchaseOrderCount} ${t('vendorList.purchaseOrders')}`);
  if (vendor.deliveryNoteCount > 0) countParts.push(`${vendor.deliveryNoteCount} ${t('vendorList.deliveryNotes', 'ת.מ')}`);
  if (vendor.invoiceCount > 0) countParts.push(`${vendor.invoiceCount} ${t('vendorList.invoices', 'חשבוניות')}`);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 cursor-pointer hover:-translate-y-[2px] hover:shadow-md text-right border group ${isActive ? 'bg-primary/10 border-primary/30 shadow-sm' : 'border-transparent hover:bg-base-200'
        }`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${isActive ? 'bg-primary/20 text-primary' : 'bg-base-100 border border-base-300 text-base-content'
          }`}>
          {vendor.initials}
        </div>
        <div className="truncate">
          <p className={`text-sm font-semibold truncate ${isActive ? 'text-primary' : 'text-base-content'}`} data-tooltip-id="vendor-name-tip" data-tooltip-content={vendor.name}>
            {vendor.name}
          </p>
          <p className="text-xs text-base-content/60 truncate">
            {countParts.join(' • ') || `0 ${t('vendorList.purchaseOrders')}`}
          </p>
        </div>
      </div>
      {vendor.discrepancyCount > 0 ? (
        <span className="badge badge-sm badge-error text-white shrink-0">
          {vendor.discrepancyCount}
        </span>
      ) : (
        <ChevronLeft size={16} className={`transition-colors shrink-0 ${isActive ? 'text-primary' : 'text-base-content/30'}`} />
      )}
    </button>
  );
}
