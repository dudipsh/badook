import { Eye, Calendar } from 'lucide-react';
import type { DeliveryHistoryEntry } from '../../../types/reconciliation';

interface DeliveryNoteCardProps {
  entry: DeliveryHistoryEntry;
  unitLabel: string;
  onClick: () => void;
}

export const DeliveryNoteCard = ({ entry, unitLabel, onClick }: DeliveryNoteCardProps) => (
  <div
    className="flex items-center justify-between p-3 bg-base-200 border border-base-300 rounded-lg cursor-pointer hover:border-success/40 hover:bg-success/5 transition-colors"
    onClick={onClick}
  >
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-base-content">{entry.noteNumber || entry.deliveryNoteId.slice(0, 8)}</span>
        {entry.fileUrl && <Eye size={14} className="text-success opacity-60" />}
      </div>
      <div className="flex items-center gap-3 mt-1">
        {entry.date && (
          <span className="text-xs text-base-content/40 flex items-center gap-1">
            <Calendar size={10} /> {new Date(entry.date).toLocaleDateString()}
          </span>
        )}
        <span className="text-xs font-medium text-base-content/60">{entry.quantity} {unitLabel}</span>
      </div>
    </div>
    <span className="text-xs font-semibold text-success uppercase">DC</span>
  </div>
);
