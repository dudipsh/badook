interface NavItemProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
}

export const NavItem = ({ label, icon, active, onClick, badge }: NavItemProps) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${active
          ? 'bg-slate-500/20 text-primary-content font-medium'
          : 'text-base-content/70 hover:bg-base-200'
        }`}
    >
      <span className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </span>
      {badge}
    </button>
  );
}
