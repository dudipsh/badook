import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Inbox, Ban, FileQuestion } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../../lib/store-context';
import { OrphanDocRow } from './OrphanDocRow';
import { BlockedSendersTab } from './BlockedSendersTab';
import { OrphanConfirmModal } from './OrphanConfirmModal';
import type { OrphanedDoc } from '../../../types/orphan';
import type { OrphanTab } from '../OrphanedDocsPage';
import toast from 'react-hot-toast';

type ConfirmState = { doc: OrphanedDoc; action: 'delete' | 'block' } | null;

interface OrphanDocsTableProps {
  activeTab: OrphanTab;
  onTabChange: (tab: OrphanTab) => void;
}

export const OrphanDocsTable = observer(({ activeTab, onTabChange }: OrphanDocsTableProps) => {
  const { t } = useTranslation(['projects', 'settings']);
  const { orphanStore, gmailStore } = useStores();
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const handleDelete = useCallback((doc: OrphanedDoc) => {
    setConfirmState({ doc, action: 'delete' });
  }, []);

  const handleBlockSender = useCallback((doc: OrphanedDoc) => {
    if (!doc.senderEmail) return;
    setConfirmState({ doc, action: 'block' });
  }, []);

  const handleConfirm = async () => {
    if (!confirmState) return;
    setConfirmLoading(true);
    const { doc, action } = confirmState;
    try {
      if (action === 'block' && doc.senderEmail) {
        await gmailStore.addBlockedRule('sender', doc.senderEmail);
        orphanStore.removeDocFromList(doc.id);
        toast.success(t('settings:orphan.blockSuccess'));
      } else {
        await orphanStore.deleteDoc(doc);
      }
    } catch {
      toast.error(action === 'block' ? t('settings:orphan.blockError') : t('settings:orphan.deleteError'));
    } finally {
      setConfirmLoading(false);
      setConfirmState(null);
    }
  };

  const handleCancelConfirm = useCallback(() => setConfirmState(null), []);

  const tabs = [
    { key: 'pending' as const, icon: Inbox, label: t('projects:orphan.pending', 'ממתין'), count: orphanStore.docs.length },
    { key: 'resolved' as const, icon: CheckCircle2, label: t('projects:orphan.resolved', 'טופל') },
    { key: 'blocked' as const, icon: Ban, label: t('projects:orphan.blockedSenders', 'שולחים חסומים'), count: gmailStore.blockedRules.length },
  ];

  return (
    <div className="flex-1 bg-base-100 rounded-box border border-base-200 shadow-lg overflow-visible flex flex-col">
      {/* Header + tabs */}
      <div className="pt-6 bg-base-200/30 border-b border-base-200">
        <div className="flex items-center justify-between px-6 mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-base-content">{t('projects:orphan.title', 'מסמכים לא משויכים')}</h1>
            <div className="flex items-center gap-1.5 opacity-50 text-xs">
              <FileQuestion className="w-3.5 h-3.5" />
              <span>{t('projects:orphan.subtitle', 'תיבת דואר לא מותאמת')}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-0 mt-4">
          {tabs.map(({ key, icon: Icon, label, count }) => (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`flex items-center gap-2 px-6 py-3 text-sm transition-colors border-b-2 ${activeTab === key
                ? 'border-base-content text-base-content font-bold'
                : 'border-transparent text-base-content/60 hover:text-base-content/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count !== undefined && count > 0 && (
                <span className={`badge badge-sm font-normal ms-1 ${key === 'pending' ? 'badge-error' : 'badge-ghost'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'pending' && (
        <PendingTab
          docs={orphanStore.docs}
          onHandle={(d) => orphanStore.openIntakeModal(d)}
          onView={(d) => d.originalFileUrl && orphanStore.openDocument(d.originalFileUrl)}
          onDelete={handleDelete}
          onBlockSender={handleBlockSender}
        />
      )}
      {activeTab === 'blocked' && <BlockedSendersTab />}
      {activeTab === 'resolved' && (
        <EmptyState message={t('projects:orphan.noItems', 'אין פריטים להצגה')} />
      )}

      {confirmState && (
        <OrphanConfirmModal
          action={confirmState.action}
          senderEmail={confirmState.doc.senderEmail}
          loading={confirmLoading}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
        />
      )}
    </div>
  );
});

/* ── Pending tab ── */
const PendingTab = ({ docs, onHandle, onView, onDelete, onBlockSender }: {
  docs: OrphanedDoc[];
  onHandle: (doc: OrphanedDoc) => void;
  onView: (doc: OrphanedDoc) => void;
  onDelete: (doc: OrphanedDoc) => void;
  onBlockSender: (doc: OrphanedDoc) => void;
}) => {
  const { t } = useTranslation('projects');

  if (docs.length === 0) {
    return <EmptyState message={t('orphan.noUnlinkedDocs')} icon="success" />;
  }

  return (
    <div className="flex-1 overflow-visible flex flex-col">
      <div className="overflow-visible">
        <table className="table table-sm table-pin-rows w-full text-sm">
          <thead>
            <tr className="bg-base-200/50 text-base-content/60 uppercase text-xs">
              <th className="w-[14%] pr-6">{t('orphan.status')}</th>
              <th className="w-[24%]">{t('orphan.document')}</th>
              <th className="w-[16%]">{t('orphan.sender', 'שולח')}</th>
              <th className="w-[24%]">{t('orphan.problemDescription')}</th>
              <th className="w-[22%] text-left pl-6">{t('orphan.action')}</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <OrphanDocRow
                key={doc.id}
                doc={doc}
                onHandle={onHandle}
                onView={onView}
                onDelete={onDelete}
                onBlockSender={onBlockSender}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ── Empty state ── */
const EmptyState = ({ message, icon }: { message: string; icon?: 'success' }) => (
  <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-40">
    <CheckCircle2 className={`w-12 h-12 mb-3 ${icon === 'success' ? 'text-success' : ''}`} />
    <p className="font-bold text-base">{message}</p>
  </div>
);
