import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Eye, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { samplesApi } from '../api';
import { UploadModal } from './UploadModal';
import type { Sample, Stats, SampleStatus } from '../types';

interface SamplesTabProps {
  samples: Sample[];
  stats: Stats | null;
  total: number;
  page: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onEdit: (sample: Sample) => void;
  onRefresh: () => void;
}

const STATUS_COLORS: Record<SampleStatus, string> = {
  PENDING: 'badge-warning',
  AUTO_EXTRACTED: 'badge-info',
  LABELED: 'badge-primary',
  VERIFIED: 'badge-success',
};

export const SamplesTab = ({ samples, stats, total, page, isLoading, onPageChange, onEdit, onRefresh }: SamplesTabProps) => {
  const { t } = useTranslation('training-lab');
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const handleDelete = async (sample: Sample) => {
    if (!confirm(t('samples.deleteConfirm'))) return;
    try {
      await samplesApi.delete(sample.id);
      toast.success(t('toast.deleteSuccess'));
      onRefresh();
    } catch {
      toast.error(t('toast.deleteError'));
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      {stats && (
        <div className="stats stats-horizontal shadow w-full">
          <div className="stat"><div className="stat-title">{t('stats.total')}</div><div className="stat-value text-2xl">{stats.total}</div></div>
          <div className="stat"><div className="stat-title">{t('stats.pending')}</div><div className="stat-value text-2xl text-warning">{stats.byStatus.PENDING || 0}</div></div>
          <div className="stat"><div className="stat-title">{t('stats.extracted')}</div><div className="stat-value text-2xl text-info">{stats.byStatus.AUTO_EXTRACTED || 0}</div></div>
          <div className="stat"><div className="stat-title">{t('stats.labeled')}</div><div className="stat-value text-2xl text-primary">{stats.byStatus.LABELED || 0}</div></div>
          <div className="stat"><div className="stat-title">{t('stats.verified')}</div><div className="stat-value text-2xl text-success">{stats.byStatus.VERIFIED || 0}</div></div>
        </div>
      )}

      {/* Upload button */}
      <div className="flex justify-end">
        <button className="btn btn-primary gap-2" onClick={() => setIsUploadOpen(true)}>
          <Plus size={16} />
          {t('samples.upload')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-base-100 rounded-box shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center p-8"><span className="loading loading-spinner loading-lg" /></div>
        ) : samples.length === 0 ? (
          <div className="text-center p-8 text-base-content/50">{t('samples.noResults')}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('samples.fileName')}</th>
                <th>{t('samples.type')}</th>
                <th>{t('samples.status')}</th>
                <th>{t('samples.confidence')}</th>
                <th>{t('samples.date')}</th>
                <th>{t('samples.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => (
                <tr key={sample.id} className="hover">
                  <td className="font-medium max-w-[200px] truncate">{sample.originalFileName}</td>
                  <td><span className="badge badge-outline badge-sm">{t(`documentType.${sample.documentType}`)}</span></td>
                  <td><span className={`badge badge-sm ${STATUS_COLORS[sample.status]}`}>{t(`status.${sample.status}`)}</span></td>
                  <td>{sample.geminiConfidence != null ? `${Math.round(sample.geminiConfidence * 100)}%` : '—'}</td>
                  <td className="text-sm">{new Date(sample.createdAt).toLocaleDateString('he-IL')}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-xs" onClick={() => window.open(`/labeling-api/files/${sample.id}`, '_blank')} title={t('samples.view')}>
                        <Eye size={14} />
                      </button>
                      <button className="btn btn-ghost btn-xs" onClick={() => onEdit(sample)} title={t('samples.edit')}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(sample)} title={t('samples.delete')}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronRight size={14} />
          </button>
          <span className="btn btn-sm btn-ghost">{page} / {totalPages}</span>
          <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            <ChevronLeft size={14} />
          </button>
        </div>
      )}

      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUploaded={onRefresh} />
    </div>
  );
};
