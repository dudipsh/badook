import { X, FileText } from 'lucide-react';

interface DocumentViewerTitleBarProps {
  filename: string;
  onClose: () => void;
}

export const DocumentViewerTitleBar = ({ filename, onClose }: DocumentViewerTitleBarProps) => (
  <div
    className="flex items-center justify-between px-4 py-3 bg-base-100/95 backdrop-blur border-b border-base-300 shrink-0"
    onClick={(e) => e.stopPropagation()}
  >
    <div className="flex items-center gap-2.5 min-w-0">
      <FileText size={18} className="text-secondary shrink-0" />
      <span className="text-sm font-semibold text-base-content truncate">{filename}</span>
    </div>
    <button onClick={onClose} className="p-1.5 hover:bg-base-200 rounded-full transition-colors shrink-0">
      <X className="w-5 h-5 text-base-content/50" />
    </button>
  </div>
);
