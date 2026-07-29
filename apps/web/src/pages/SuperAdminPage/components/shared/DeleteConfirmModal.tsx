import { useTranslation } from 'react-i18next';
import { Modal } from '../../../../components/ui/Modal';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal = ({ isOpen, onClose, onConfirm }: DeleteConfirmModalProps) => {
  const { t } = useTranslation('settings');
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('feedback.deleteTitle')}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{t('feedback.deleteConfirm')}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50">{t('common:cancel')}</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">{t('common:delete')}</button>
        </div>
      </div>
    </Modal>
  );
}
