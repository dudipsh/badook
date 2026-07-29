import { useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../lib/store-context';
import { OrphanDocsTable } from './components/OrphanDocsTable';
import { DocumentViewerModal } from '../../components/shared/DocumentViewerModal';
import { UploadDocumentModal } from '../ProjectDashboardPage/components/UploadDocumentModal';

export type OrphanTab = 'pending' | 'resolved' | 'blocked';

const VALID_TABS: OrphanTab[] = ['pending', 'resolved', 'blocked'];

export const OrphanedDocsPage = observer(() => {
  const { orphanStore, gmailStore } = useStores();
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();

  const activeTab: OrphanTab = VALID_TABS.includes(tab as OrphanTab)
    ? (tab as OrphanTab)
    : 'pending';

  useEffect(() => {
    if (!VALID_TABS.includes(tab as OrphanTab)) {
      navigate('/orphaned-docs/pending', { replace: true });
    }
  }, [tab, navigate]);

  useEffect(() => {
    orphanStore.loadDocs();
    gmailStore.fetchBlockedRules();
  }, [orphanStore, gmailStore]);

  const handleTabChange = useCallback((newTab: OrphanTab) => {
    navigate(`/orphaned-docs/${newTab}`);
  }, [navigate]);

  const handleIntakeClose = useCallback(() => {
    orphanStore.closeIntakeModal();
  }, [orphanStore]);

  const handleIntakeSuccess = useCallback(() => {
    if (orphanStore.intakeDoc) {
      orphanStore.removeDocFromList(orphanStore.intakeDoc.id);
    }
    orphanStore.closeIntakeModal();
  }, [orphanStore]);

  if (orphanStore.loading && orphanStore.docs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <OrphanDocsTable activeTab={activeTab} onTabChange={handleTabChange} />

      <DocumentViewerModal
        filePath={orphanStore.viewerFilePath}
        onClose={() => orphanStore.closeDocument()}
      />

      {orphanStore.intakeDoc && orphanStore.intakeDocType && (
        <UploadDocumentModal
          isOpen={true}
          onClose={handleIntakeClose}
          docType={orphanStore.intakeDocType}
          orphanDoc={orphanStore.intakeDoc}
          showProjectSelector
          onOrphanSuccess={handleIntakeSuccess}
        />
      )}
    </div>
  );
});
