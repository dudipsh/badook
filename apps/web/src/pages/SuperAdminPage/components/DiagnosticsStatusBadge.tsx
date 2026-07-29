import { CheckCircle2, XCircle } from 'lucide-react';

export const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
    ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
  }`}>
    {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
    {label}
  </span>
);
