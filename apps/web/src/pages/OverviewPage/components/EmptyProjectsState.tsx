import { useTranslation } from 'react-i18next';
import { Plus, Archive } from 'lucide-react';

interface EmptyProjectsStateProps {
  isArchived: boolean;
}

export const EmptyProjectsState = ({ isArchived }: EmptyProjectsStateProps) => {
  const { t } = useTranslation('projects');
  return (
    <div className="bg-base-100 rounded-[.5rem] border border-dashed border-base-300 p-12 sm:p-16 text-center ">
      <div className="w-16 h-16 mx-auto bg-base-200 rounded-full flex items-center justify-center mb-4">
        {isArchived ? <Archive size={24} className="text-base-content/40" /> : <Plus size={24} className="text-base-content/40" />}
      </div>
      <h2 className="text-lg font-bold text-base-content mb-2">{isArchived ? t('overview.noArchivedProjects') : t('overview.noProjects')}</h2>
      <p className="text-sm text-base-content/60">{isArchived ? t('overview.noArchivedDescription') : t('overview.noProjectsDescription')}</p>
    </div>
  );
};
