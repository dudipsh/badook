interface Props {
  label: string;
  value: string | number;
  hint?: string;
}

export const CardStatTile = ({ label, value, hint }: Props) => (
  <div className="rounded-xl bg-base-200/50 px-3 py-2.5 flex flex-col gap-0.5">
    <span className="text-[20px] font-bold text-base-content leading-none tabular-nums">{value}</span>
    <span className="text-[11px] text-base-content/50 font-medium leading-tight">{label}</span>
    {hint && <span className="text-[10px] text-base-content/40 leading-tight">{hint}</span>}
  </div>
);
