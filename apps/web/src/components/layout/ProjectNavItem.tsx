import { Building2, ChevronLeft } from 'lucide-react';

interface ProjectNavItemProps {
  name: string;
  isActive: boolean;
  onClick: () => void;
}

export const ProjectNavItem = ({ name, isActive, onClick }: ProjectNavItemProps) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all text-right group ${isActive
          ? 'bg-slate-500/20 text-primary-content font-medium'
          : 'text-base-content/60 hover:bg-base-200'
        }`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <Building2 size={16} className={isActive ? 'text-primary-content/70' : 'text-base-content/40'} />
        <span className="truncate max-w-[120px]">{name}</span>
      </div>
      <ChevronLeft
        size={14}
        className={`flex-shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
      />
    </button>
  );
};
