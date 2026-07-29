interface DetailRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  valueClassName?: string;
}

export const DetailRow = ({ label, value, highlight, valueClassName }: DetailRowProps) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-base-content/50">{label}</span>
    <span className={`text-xs ${highlight ? 'font-bold text-base-content' : valueClassName || 'font-medium text-base-content'}`}>
      {value}
    </span>
  </div>
);
