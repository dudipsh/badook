import { Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; bg: string }> = {
  PENDING: { icon: Clock, color: 'text-yellow-700', bg: 'bg-yellow-50' },
  RUNNING: { icon: Loader2, color: 'text-blue-700', bg: 'bg-blue-50' },
  COMPLETED: { icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50' },
  FAILED: { icon: XCircle, color: 'text-red-700', bg: 'bg-red-50' },
};

export const StatusBadge = ({ status }: { status: string }) => {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      <Icon className={`w-3.5 h-3.5 ${status === 'RUNNING' ? 'animate-spin' : ''}`} />
      {status}
    </span>
  );
};
