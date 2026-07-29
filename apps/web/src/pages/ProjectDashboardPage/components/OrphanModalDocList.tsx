import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OrphanDocumentCard } from './OrphanDocumentCard';

interface OrphanDoc {
  id: string;
  supplierName: string;
  originalFileUrl: string | null;
  [key: string]: any;
}

interface OrphanModalDocListProps {
  loading: boolean;
  documents: OrphanDoc[];
  selectedIds: Set<string>;
  getDocNumber: (doc: OrphanDoc) => string | null;
  getDocDate: (doc: OrphanDoc) => string | null;
  onToggleSelection: (id: string) => void;
  onCreateProject: (docId: string) => void;
  onTriage: (doc: OrphanDoc) => void;
  onViewDocument: (doc: OrphanDoc) => void;
  onDelete: (docId: string) => void;
}

export const OrphanModalDocList = ({
  loading, documents, selectedIds, getDocNumber, getDocDate,
  onToggleSelection, onCreateProject, onTriage, onViewDocument, onDelete,
}: OrphanModalDocListProps) => {
  const { t } = useTranslation('projects');

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-base-content/40" /></div>;
  }

  if (documents.length === 0) {
    return <div className="text-center py-12 text-base-content/40 text-sm">{t('orphanModal.noUnassignedOfType')}</div>;
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <OrphanDocumentCard
          key={doc.id}
          doc={doc}
          docNumber={getDocNumber(doc)}
          docDate={getDocDate(doc)}
          isSelected={selectedIds.has(doc.id)}
          onToggleSelection={() => onToggleSelection(doc.id)}
          onCreateProject={() => onCreateProject(doc.id)}
          onTriage={() => onTriage(doc)}
          onViewDocument={() => onViewDocument(doc)}
          onDelete={() => onDelete(doc.id)}
        />
      ))}
    </div>
  );
};
