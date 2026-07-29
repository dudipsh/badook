import { CheckCircle2, XCircle } from 'lucide-react';

export const DepStatus = ({ status }: { status: string }) => {
  const ok = status === 'OK';
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
      ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
    }`}>
      {ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
      <span className="font-mono break-all">{status}</span>
    </div>
  );
};
