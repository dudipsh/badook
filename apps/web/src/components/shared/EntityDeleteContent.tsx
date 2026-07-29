import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

interface EntityDeleteContentProps {
  entityName: string;
}

export const EntityDeleteContent = ({ entityName }: EntityDeleteContentProps) => {
  const { t } = useTranslation('projects');

  return (
    <div className="space-y-4">
      <div className="alert bg-error/10 text-error border-error/20 shadow-sm rounded-xl">
        <AlertTriangle className="w-5 h-5" />
        <div className="text-sm font-medium">
          {t('entityActions.deleteIrreversible')}
        </div>
      </div>
      <p className="text-sm opacity-80 rtl:text-right ltr:text-left" dir="auto">
        {t('entityActions.deleteWarning', { entityName })}
      </p>
    </div>
  );
};
