import { useTranslation } from 'react-i18next';

interface ProjectStatusBadgeProps {
  isArchived?: boolean;
}

export const ProjectStatusBadge = ({ isArchived }: ProjectStatusBadgeProps) => {
  const { t } = useTranslation('projects');

  if (isArchived) {
    return (
      <span className="inline-flex items-center gap-1 border border-base-300 text-base-content/50 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
        {t('overview.archive')}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 border border-success/40 bg-success/5 text-success text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
      {t('overview.active')}
    </span>
  );
};
