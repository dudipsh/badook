import { useState, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { MapPin, Inbox, MoreHorizontal, GitMerge, Archive, Trash2, Edit2 } from 'lucide-react';
import { useStores } from '../../../lib/store-context';
import { IconCardButton } from '../../../components/ui/IconCardButton';
import type { Project } from '../../../services/projects.service';

interface ProjectHeaderProps {
  project: Project;
  isArchived: boolean;
  onAction: (type: 'EDIT' | 'MERGE' | 'ARCHIVE' | 'DELETE') => void;
}

export const ProjectHeader = observer(({ project, isArchived, onAction }: ProjectHeaderProps) => {
  const { t } = useTranslation('projects');
  const navigate = useNavigate();
  const { id } = useParams();
  const { projectDashboardStore } = useStores();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { stats } = projectDashboardStore;
  const docCount = stats
    ? stats.purchaseOrderCount + stats.invoiceCount + stats.deliveryCertCount
    : 0;
  const docCountLabel = docCount >= 1000 ? `${Math.floor(docCount / 1000)}k` : docCount;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleAction = (type: 'EDIT' | 'MERGE' | 'ARCHIVE' | 'DELETE') => {
    setMenuOpen(false);
    onAction(type);
  };

  return (
    <div className="shrink-0 flex justify-between items-start mb-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold text-base-content">{project.name}</h1>
        {project.address && project.address !== project.name && (
          <div className="flex items-center gap-2 mt-2 opacity-60 text-sm">
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="truncate">{project.address}</span>
          </div>
        )}
      </div>

      <div className="flex gap-3 shrink-0">
        {/* Document Inbox Button */}
        <IconCardButton
          icon={Inbox}
          label={t('header.documentInbox', 'תיבת מסמכים')}
          count={docCount > 0 ? docCountLabel : null}
          onClick={() => navigate(`/projects/${id}/documents`)}
        />

        {/* Project Actions Dropdown (...) */}
        <div ref={menuRef} className="relative">
          <IconCardButton
            icon={MoreHorizontal}
            iconOnly
            onClick={() => setMenuOpen(!menuOpen)}
          />
          {menuOpen && (
            <ul className="absolute left-0 top-full mt-1 bg-base-100 border border-base-200 rounded-box shadow-lg z-[100] w-52 menu p-2 font-medium">
              <li>
                <button onClick={() => handleAction('EDIT')} className="flex justify-between w-full text-start">
                  <span>{t('editProject.title')}</span>
                  <Edit2 className="w-4 h-4 opacity-70" />
                </button>
              </li>
              <li>
                <button onClick={() => handleAction('MERGE')} className="flex justify-between w-full text-start">
                  <span>{t('common.merge')}</span>
                  <GitMerge className="w-4 h-4 opacity-70" />
                </button>
              </li>
              {!isArchived && (
                <li>
                  <button onClick={() => handleAction('ARCHIVE')} className="flex justify-between w-full text-start">
                    <span>{t('common.archive')}</span>
                    <Archive className="w-4 h-4 opacity-70" />
                  </button>
                </li>
              )}
              <li className="text-error mt-1 border-t border-base-200 pt-1">
                <button onClick={() => handleAction('DELETE')} className="hover:bg-error/10 flex justify-between w-full text-start">
                  <span>{t('common.delete')}</span>
                  <Trash2 className="w-4 h-4 opacity-70" />
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
});
