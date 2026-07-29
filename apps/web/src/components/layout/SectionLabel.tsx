interface SectionLabelProps {
  text: string;
  className?: string;
}

export const SectionLabel = ({ text, className = '' }: SectionLabelProps) => {
  return (
    <div className={`px-3 mb-2 text-xs font-semibold text-base-content/50 uppercase tracking-wider ${className}`}>
      {text}
    </div>
  );
};
