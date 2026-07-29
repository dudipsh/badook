import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export const StatusBadge = ({ status }: { status: 'passed' | 'failed' | 'error' }) => {
  const config = {
    passed: { icon: CheckCircle2, bg: 'bg-green-100', text: 'text-green-700', label: 'עבר' },
    failed: { icon: XCircle, bg: 'bg-red-100', text: 'text-red-700', label: 'נכשל' },
    error: { icon: AlertCircle, bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'שגיאה' },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <config.icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};
