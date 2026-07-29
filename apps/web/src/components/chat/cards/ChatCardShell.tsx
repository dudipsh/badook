import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X, LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Accent = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

const ACCENT_CHIP: Record<Accent, string> = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  info: 'bg-info/10 text-info',
};

interface Props {
  title: string;
  subtitle?: string;
  Icon: LucideIcon;
  accent?: Accent;
  onDismiss: () => void;
  children: ReactNode;
}

export const ChatCardShell = ({ title, subtitle, Icon, accent = 'primary', onDismiss, children }: Props) => {
  const { t } = useTranslation('chat');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-md rounded-2xl border border-base-200 bg-base-100 shadow-[0_4px_24px_rgb(0,0,0,0.06)] overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ACCENT_CHIP[accent]}`}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-[15px] text-base-content leading-tight truncate">{title}</h4>
          {subtitle && (
            <p className="text-[12px] text-base-content/50 font-medium truncate mt-0.5">{subtitle}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label={t('close')}
          className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:bg-base-200 hover:text-base-content transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-4 pb-4">{children}</div>
    </motion.div>
  );
};
