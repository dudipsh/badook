import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

interface NewProjectPlaceholderProps {
  onClick: () => void;
}

export const NewProjectPlaceholder = ({ onClick }: NewProjectPlaceholderProps) => {
  const { t } = useTranslation('projects');
  return (
    <button
      type="button"
      onClick={onClick}
      className="card rounded-[.5rem] bg-base-200/50 border-2 border-base-300 border-dashed hover:border-primary hover:bg-primary/5 transition-all h-full min-h-[250px] flex flex-col items-center justify-center p-6 group"
    >
      <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center mb-3 group-hover:bg-secondary/15 transition-colors">
        <Plus size={20} className="text-base-content/50 group-hover:text-secondary transition-colors" />
      </div>
      <p className="text-sm font-semibold text-base-content/70 group-hover:text-secondary transition-colors">{t('overview.newProject')}</p>
      <p className="text-xs text-base-content/50 mt-1">{t('overview.dragAndDrop')}</p>
    </button>
  );
};
