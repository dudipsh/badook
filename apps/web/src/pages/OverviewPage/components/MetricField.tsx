export const MetricField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-xs text-base-content/50 px-1 mb-1">{label}</div>
    {children}
  </div>
);
