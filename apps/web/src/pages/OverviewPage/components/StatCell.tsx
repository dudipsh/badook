interface StatCellProps {
  label: string;
  value: string;
}

export const StatCell = ({ label, value }: StatCellProps) => (
  <div>
    <p className="text-xs text-base-content/50 uppercase font-bold tracking-wider mb-0.5">{label}</p>
    <p className="text-base font-bold font-mono tabular-nums text-base-content break-all">{value}</p>
  </div>
);
