import { Eye } from 'lucide-react';

const HOVER_COLORS = {
  purple: { border: 'hover:border-secondary/50', bg: 'hover:bg-secondary/5', text: 'text-secondary' },
  emerald: { border: 'hover:border-success/40', bg: 'hover:bg-success/5', text: 'text-success' },
  blue: { border: 'hover:border-info/40', bg: 'hover:bg-info/5', text: 'text-info' },
} as const;

interface DocumentCardProps {
  name: string;
  type: string;
  hoverColor: keyof typeof HOVER_COLORS;
  hasFile: boolean;
  onClick: () => void;
}

export const DocumentCard = ({ name, type, hoverColor, hasFile, onClick }: DocumentCardProps) => {
  const colors = HOVER_COLORS[hoverColor];
  return (
    <div
      className={`flex items-center justify-between p-3 bg-base-200 border border-base-300 rounded-lg ${hasFile ? `cursor-pointer ${colors.border} ${colors.bg}` : ''} transition-colors`}
      onClick={hasFile ? onClick : undefined}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-semibold text-base-content truncate">{name}</span>
        {hasFile && <Eye size={14} className={`${colors.text} opacity-60 hover:opacity-100 transition-opacity shrink-0`} />}
      </div>
      <span className={`text-xs font-semibold ${colors.text} uppercase shrink-0 ml-2`}>{type}</span>
    </div>
  );
};
