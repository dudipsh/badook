interface POSectionTitleProps {
  icon: string;
  title: string;
  className?: string;
}

export const POSectionTitle = ({ icon, title, className = '' }: POSectionTitleProps) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-base">{icon}</span>
      <h3 className="text-sm font-bold text-base-content/50 uppercase tracking-wider">{title}</h3>
    </div>
  );
};
