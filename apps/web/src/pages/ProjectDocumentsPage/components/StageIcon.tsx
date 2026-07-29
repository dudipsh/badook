import { Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react';

export const StageIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'running': return <Loader2 size={16} className="animate-spin text-info" />;
    case 'done': return <CheckCircle2 size={16} className="text-success" />;
    case 'failed': return <XCircle size={16} className="text-error" />;
    default: return <Circle size={16} className="text-base-content/30" />;
  }
};
