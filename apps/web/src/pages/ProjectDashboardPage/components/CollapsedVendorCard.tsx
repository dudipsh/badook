import type { ProjectVendor } from '../../../types/reconciliation';

interface CollapsedVendorCardProps {
  vendor: ProjectVendor;
  isActive: boolean;
  onClick: () => void;
}

export const CollapsedVendorCard = ({ vendor, isActive, onClick }: CollapsedVendorCardProps) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-center p-2 rounded-lg transition-all duration-200 cursor-pointer hover:-translate-y-[2px] hover:shadow-md relative ${
        isActive ? 'bg-primary/10 border border-primary/30 shadow-sm' : 'border border-transparent hover:bg-base-200'
      }`}
      data-tooltip-id="vendor-name-tip"
      data-tooltip-content={vendor.name}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
        isActive ? 'bg-primary/20 text-primary' : 'bg-base-100 border border-base-300 text-base-content'
      }`}>
        {vendor.initials}
      </div>
      {vendor.discrepancyCount > 0 && (
        <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] bg-error text-error-content text-[9px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm ring-2 ring-base-100">
          {vendor.discrepancyCount}
        </span>
      )}
    </button>
  );
};
