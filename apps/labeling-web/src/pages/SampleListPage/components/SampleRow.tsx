import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { Trash2 } from 'lucide-react';
import { StatusBadge, TypeBadge } from '@/components/Badge';
import { useStores } from '@/stores/store-context';
import toast from 'react-hot-toast';
import type { Sample } from '@/types/sample.types';

interface SampleRowProps {
  sample: Sample;
}

const SampleRow = observer(({ sample }: SampleRowProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { samplesStore } = useStores();

  const handleClick = () => {
    navigate(`/samples/${sample.id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('למחוק את הדוגמה?')) return;
    try {
      await samplesStore.deleteSample(sample.id);
      toast.success(t('toast.deleteSuccess'));
    } catch {
      toast.error(t('toast.deleteError'));
    }
  };

  const confidence = sample.geminiConfidence != null ? `${(sample.geminiConfidence * 100).toFixed(0)}%` : '—';
  const createdDate = new Date(sample.createdAt).toLocaleDateString('he-IL');

  return (
    <tr className="hover cursor-pointer" onClick={handleClick}>
      <td className="font-medium max-w-[250px] truncate" title={sample.originalFileName}>
        {sample.originalFileName}
      </td>
      <td>
        <TypeBadge type={sample.documentType} />
      </td>
      <td>
        <StatusBadge status={sample.status} />
      </td>
      <td className="text-center">{confidence}</td>
      <td>{createdDate}</td>
      <td>
        <button
          className="btn btn-ghost btn-xs btn-square"
          onClick={handleDelete}
          title={t('buttons.delete')}
        >
          <Trash2 className="w-3.5 h-3.5 text-error" />
        </button>
      </td>
    </tr>
  );
});

export default SampleRow;
