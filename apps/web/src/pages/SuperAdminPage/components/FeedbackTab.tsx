import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import { FeedbackTable } from './shared/FeedbackTable';
import { FeedbackEditModal } from './shared/FeedbackEditModal';
import { DeleteConfirmModal } from './shared/DeleteConfirmModal';
import type { FeedbackItem } from '../../../services/admin.service';
import toast from 'react-hot-toast';

export const FeedbackTab = observer(() => {
  const { t } = useTranslation('settings');
  const { adminStore } = useStores();
  const [editItem, setEditItem] = useState<FeedbackItem | null>(null);
  const [editForm, setEditForm] = useState({ descriptionA: '', descriptionB: '', catalogNumberA: '', catalogNumberB: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { adminStore.fetchFeedback(); }, [adminStore]);

  const handleEdit = (item: FeedbackItem) => {
    setEditItem(item);
    setEditForm({
      descriptionA: item.descriptionA,
      descriptionB: item.descriptionB,
      catalogNumberA: item.catalogNumberA || '',
      catalogNumberB: item.catalogNumberB || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    try {
      await adminStore.updateFeedback(editItem.id, {
        descriptionA: editForm.descriptionA,
        descriptionB: editForm.descriptionB,
        catalogNumberA: editForm.catalogNumberA || undefined,
        catalogNumberB: editForm.catalogNumberB || undefined,
      });
      toast.success(t('training.feedbackUpdated'));
      setEditItem(null);
    } catch {
      toast.error(t('training.feedbackUpdateError'));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await adminStore.deleteFeedback(deleteId);
      toast.success(t('training.feedbackDeleted'));
      setDeleteId(null);
    } catch {
      toast.error(t('training.feedbackDeleteError'));
    }
  };

  return (
    <div className="space-y-4">
      <FeedbackTable
        list={adminStore.feedbackList}
        page={adminStore.feedbackPage}
        totalPages={adminStore.feedbackTotalPages}
        onEdit={handleEdit}
        onDelete={setDeleteId}
        onPageChange={(p) => adminStore.fetchFeedback(p)}
      />
      <FeedbackEditModal item={editItem} form={editForm} onFormChange={setEditForm} onClose={() => setEditItem(null)} onSave={handleSaveEdit} />
      <DeleteConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
    </div>
  );
});
