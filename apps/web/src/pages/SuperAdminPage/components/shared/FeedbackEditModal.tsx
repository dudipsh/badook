import { useTranslation } from 'react-i18next';
import { Modal } from '../../../../components/ui/Modal';
import type { FeedbackItem } from '../../../../services/admin.service';

interface FeedbackEditModalProps {
  item: FeedbackItem | null;
  form: { descriptionA: string; descriptionB: string; catalogNumberA: string; catalogNumberB: string };
  onFormChange: (form: FeedbackEditModalProps['form']) => void;
  onClose: () => void;
  onSave: () => void;
}

export const FeedbackEditModal = ({ item, form, onFormChange, onClose, onSave }: FeedbackEditModalProps) => {
  const { t } = useTranslation('settings');

  return (
    <Modal isOpen={!!item} onClose={onClose} title={t('editFeedback.title')}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('editFeedback.descriptionA')}</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.descriptionA}
            onChange={(e) => onFormChange({ ...form, descriptionA: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('editFeedback.descriptionB')}</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.descriptionB}
            onChange={(e) => onFormChange({ ...form, descriptionB: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('editFeedback.catalogA')}</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.catalogNumberA}
              onChange={(e) => onFormChange({ ...form, catalogNumberA: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('editFeedback.catalogB')}</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.catalogNumberB}
              onChange={(e) => onFormChange({ ...form, catalogNumberB: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50">{t('common:cancel')}</button>
          <button onClick={onSave} className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary">{t('common:save')}</button>
        </div>
      </div>
    </Modal>
  );
}
