import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ReportCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'success' | 'primary' | 'secondary' | 'accent';
  onClick: () => void;
}

export const ReportCard = ({ icon, title, description, color, onClick }: ReportCardProps) => {
  const { t } = useTranslation('reports');

  const colorClasses = {
    success: {
      border: 'hover:border-success',
      iconBg: 'bg-success/10 text-success',
      title: 'group-hover:text-success',
      footer: 'group-hover:bg-success/5',
      text: 'group-hover:text-success',
    },
    primary: {
      border: 'hover:border-primary',
      iconBg: 'bg-primary/10 text-primary',
      title: 'group-hover:text-primary',
      footer: 'group-hover:bg-primary/5',
      text: 'group-hover:text-primary',
    },
    secondary: {
      border: 'hover:border-primary',
      iconBg: 'bg-secondary/10 text-secondary',
      title: 'group-hover:text-primary',
      footer: 'group-hover:bg-primary/5',
      text: 'group-hover:text-primary',
    },
    accent: {
      border: 'hover:border-primary',
      iconBg: 'bg-accent/10 text-accent',
      title: 'group-hover:text-primary',
      footer: 'group-hover:bg-primary/5',
      text: 'group-hover:text-primary',
    },
  };

  const c = colorClasses[color];

  return (
    <div
      className={`group card bg-base-100 shadow-sm hover:shadow-xl ${c.border} transition-all duration-200 overflow-hidden cursor-pointer border border-base-300`}
      onClick={onClick}
    >
      <div className="card-body p-6">
        <div className="flex justify-between items-start mb-1">
          <div className={`w-11 h-11 rounded-xl ${c.iconBg} flex items-center justify-center group-hover:scale-105 transition-transform`}>
            {icon}
          </div>
        </div>
        <h3 className={`card-title text-lg font-bold ${c.title} transition-colors mt-2`}>
          {title}
        </h3>
        <p className="opacity-60 text-sm mt-2 mb-4">
          {description}
        </p>

        <div className={`mt-auto px-6 py-3 -mx-6 -mb-6 bg-base-200/50 border-t border-base-300 flex justify-between items-center ${c.footer} transition-colors`}>
          <span className={`text-sm font-semibold opacity-60 ${c.text} transition-colors`}>
            {t('openBuilder')}
          </span>
          <ArrowRight className={`w-4 h-4 opacity-60 ${c.text} -translate-x-2 group-hover:translate-x-0 transition-transform rtl:rotate-180 flex-shrink-0`} />
        </div>
      </div>
    </div>
  );
};
