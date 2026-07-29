import { useTranslation } from 'react-i18next';
import { Eye, AlertCircle, Plus, Trash2 } from 'lucide-react';
import type { TriageDoc } from './OrphanTriagePanel';
import i18n from '../../../i18n';

interface OrphanDocumentCardProps {
  doc: {
    id: string;
    supplierName: string;
    originalFileUrl?: string | null;
    totalAmount?: number | null;
  };
  docNumber: string | null;
  docDate: string | null;
  isSelected: boolean;
  onToggleSelection: () => void;
  onCreateProject: () => void;
  onTriage: () => void;
  onViewDocument: () => void;
  onDelete?: () => void;
}

export const OrphanDocumentCard = ({
  doc,
  docNumber,
  docDate,
  isSelected,
  onToggleSelection,
  onCreateProject,
  onTriage,
  onViewDocument,
  onDelete,
}: OrphanDocumentCardProps) => {
  const { t } = useTranslation('projects');
  return (
    <label
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        isSelected ? 'border-secondary/50 bg-secondary/10' : 'border-base-300 hover:border-base-300 hover:bg-base-200'
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelection}
        className="w-4 h-4 rounded border-base-300 text-secondary focus:ring-secondary"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {(!doc.supplierName || doc.supplierName.includes('Unknown')) && (
            <span className="text-xs bg-error/15 text-error px-2 py-0.5 rounded-full font-medium">
              {t('orphan.unlinked')}
            </span>
          )}
          {docNumber && (
            <span className="text-sm font-medium text-base-content">{docNumber}</span>
          )}
          <span className="text-sm text-base-content/50">{doc.supplierName}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-base-content/40">
          {docDate && <span>{new Date(docDate).toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US')}</span>}
          {doc.totalAmount != null && (
            <span>{doc.totalAmount.toLocaleString(i18n.language === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'ILS' })}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCreateProject();
          }}
          className="text-base-content/40 hover:text-success transition-colors p-1"
          title={t('orphan.createFromDoc')}
        >
          <Plus size={16} />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTriage();
          }}
          className="text-base-content/40 hover:text-primary transition-colors p-1"
          title={t('orphan.manualAssign')}
        >
          <AlertCircle size={16} />
        </button>
        {doc.originalFileUrl && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onViewDocument();
            }}
            className="text-base-content/40 hover:text-info transition-colors p-1"
            title={t('orphan.viewDocument')}
          >
            <Eye size={16} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            className="text-base-content/40 hover:text-error transition-colors p-1"
            title={t('orphan.deleteDocument')}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </label>
  );
}
