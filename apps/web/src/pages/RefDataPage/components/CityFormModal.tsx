import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { refDataApi, type RefCity } from '../api';

interface CityFormModalProps {
  city: RefCity | null;
  onClose: () => void;
  onSaved: () => void;
}

export const CityFormModal = ({ city, onClose, onSaved }: CityFormModalProps) => {
  const { t } = useTranslation('ref-data');
  const { t: tc } = useTranslation('common');
  const isEdit = !!city;

  const [code, setCode] = useState(city?.code?.toString() ?? '');
  const [name, setName] = useState(city?.name ?? '');
  const [englishName, setEnglishName] = useState(city?.englishName ?? '');
  const [district, setDistrict] = useState(city?.district ?? '');
  const [council, setCouncil] = useState(city?.council ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const dto = {
        code: parseInt(code) || 0,
        name: name.trim(),
        englishName: englishName.trim(),
        district: district.trim(),
        council: council.trim(),
      };

      if (isEdit) {
        await refDataApi.updateCity(city.id, dto);
      } else {
        await refDataApi.createCity(dto);
      }
      toast.success(tc('save'));
      onSaved();
    } catch {
      toast.error(tc('status.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {isEdit ? t('cities.name') : tc('add')}
          </h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-sm font-medium">{t('cities.name')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input input-bordered w-full"
                required
              />
            </div>
            <div>
              <label className="label text-sm font-medium">{t('cities.code')}</label>
              <input
                type="number"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="input input-bordered w-full"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="label text-sm font-medium">{t('cities.englishName')}</label>
            <input
              type="text"
              value={englishName}
              onChange={(e) => setEnglishName(e.target.value)}
              className="input input-bordered w-full"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-sm font-medium">{t('cities.district')}</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>
            <div>
              <label className="label text-sm font-medium">{t('cities.council')}</label>
              <input
                type="text"
                value={council}
                onChange={(e) => setCouncil(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">{tc('cancel')}</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? tc('loading') : tc('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
