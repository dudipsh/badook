import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../../../components/ui/Modal';
import { USER_ROLE_OPTIONS, type CreateUserPayload } from '../../../../../services/users.service';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateUserPayload) => Promise<void>;
}

const EMPTY_FORM: CreateUserPayload = {
  email: '',
  name: '',
  role: 'ACCOUNTANT',
};

export const AddUserModal = ({ isOpen, onClose, onSubmit }: AddUserModalProps) => {
  const { t } = useTranslation('settings');
  const [form, setForm] = useState<CreateUserPayload>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setForm({ ...EMPTY_FORM });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(form);
      setForm({ ...EMPTY_FORM });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('addUserModal.title')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('addUserModal.fullName')}
          </label>
          <input
            type="text"
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/300"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('addUserModal.email')}
          </label>
          <input
            type="email"
            required
            dir="ltr"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/300"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('addUserModal.role')}
          </label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/300"
            value={form.role}
            onChange={(e) =>
              setForm({
                ...form,
                role: e.target.value as CreateUserPayload['role'],
              })
            }
          >
            {USER_ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {t(r.labelKey)}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-gray-500">
          {t('addUserModal.hint')}
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50"
          >
            {t('common:cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary disabled:opacity-60"
          >
            {submitting ? t('addUserModal.creating') : t('addUserModal.createUser')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
