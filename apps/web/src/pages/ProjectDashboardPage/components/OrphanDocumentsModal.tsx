import { useEffect, useRef, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import toast from 'react-hot-toast';
import { OrphanTriagePanel, type TriageDoc } from './OrphanTriagePanel';
import { CreateProjectDialog } from './CreateProjectDialog';
import { OrphanModalHeader } from './OrphanModalHeader';
import { OrphanModalTabs } from './OrphanModalTabs';
import { OrphanModalDocList } from './OrphanModalDocList';
import { OrphanModalFooter } from './OrphanModalFooter';

export const OrphanDocumentsModal = observer(() => {
  const { projectDashboardStore: store, gmailStore, projectsStore } = useStores();
  const { t } = useTranslation('projects');
  const [triageDoc, setTriageDoc] = useState<TriageDoc | null>(null);
  const [createProjectDoc, setCreateProjectDoc] = useState<{ id: string; docType: string } | null>(null);
  const isScanning = gmailStore.scanning;
  const prevLinkingRef = useRef(store.orphanLinking);

  useEffect(() => {
    const wasLinking = prevLinkingRef.current;
    prevLinkingRef.current = store.orphanLinking;
    if (wasLinking && !store.orphanLinking) projectsStore.fetchProjects();
  }, [store.orphanLinking, projectsStore]);

  const activeTab = store.orphanActiveTab;

  const handleDelete = useCallback(async (docId: string) => {
    if (!confirm(t('orphanModal.confirmDelete'))) return;
    try { await store.deleteOrphanDocument(docId, activeTab); toast.success(t('orphanModal.deleteSuccess')); }
    catch { toast.error(t('orphanModal.deleteError')); }
  }, [store, activeTab, t]);

  if (!store.orphanModalOpen) return null;

  const docs = store.orphanDocuments;
  const activeDocuments = docs ? docs[activeTab] : [];
  const getTabCount = (key: typeof activeTab) => docs ? docs[key].length : 0;
  const getDocNumber = (doc: any) => doc.noteNumber ?? doc.poNumber ?? doc.invoiceNumber ?? null;
  const getDocDate = (doc: any) => doc.deliveryDate ?? doc.orderDate ?? doc.invoiceDate ?? null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={() => store.closeOrphanModal()} />
        <div className={`relative bg-base-100 rounded-2xl shadow-xl flex flex-col overflow-hidden ${triageDoc ? 'w-full max-w-5xl h-[85vh]' : 'w-full max-w-2xl max-h-[80vh]'}`}>
          {triageDoc ? (
            <OrphanTriagePanel doc={triageDoc} onBack={() => setTriageDoc(null)} onAssigned={() => { setTriageDoc(null); store.openOrphanModal(); }} />
          ) : (
            <>
              <OrphanModalHeader isScanning={isScanning} onClose={() => store.closeOrphanModal()} />
              <OrphanModalTabs activeTab={activeTab} getTabCount={getTabCount} onTabChange={(key) => store.setOrphanTab(key)} />
              <div className="flex-1 overflow-y-auto p-6">
                <OrphanModalDocList
                  loading={store.orphanLoading} documents={activeDocuments} selectedIds={store.orphanSelectedIds}
                  getDocNumber={getDocNumber} getDocDate={getDocDate}
                  onToggleSelection={(id) => store.toggleOrphanSelection(id)}
                  onCreateProject={(id) => setCreateProjectDoc({ id, docType: activeTab })}
                  onTriage={(doc) => setTriageDoc({ id: doc.id, supplierName: doc.supplierName, originalFileUrl: doc.originalFileUrl, docType: activeTab })}
                  onViewDocument={(doc) => { store.closeOrphanModal(); store.openDocument(doc.originalFileUrl!); }}
                  onDelete={handleDelete}
                />
              </div>
              <OrphanModalFooter selectedCount={store.orphanSelectedCount} linking={store.orphanLinking} isScanning={isScanning} onClose={() => store.closeOrphanModal()} onLink={() => store.linkSelectedDocuments()} />
            </>
          )}
        </div>
      </div>
      {createProjectDoc && (
        <CreateProjectDialog docId={createProjectDoc.id} docType={createProjectDoc.docType} onCreated={() => { setCreateProjectDoc(null); store.openOrphanModal(); }} onCancel={() => setCreateProjectDoc(null)} />
      )}
    </>
  );
});
