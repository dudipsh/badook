import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportsApi } from '../api';
import type { DocumentType, ExportRecord } from '../types';

export const ExportsTab = () => {
  const { t } = useTranslation('training-lab');
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType | ''>('');
  const [format, setFormat] = useState('jsonl');
  const [minStatus, setMinStatus] = useState<'LABELED' | 'VERIFIED'>('LABELED');

  useEffect(() => {
    loadExports();
  }, []);

  const loadExports = async () => {
    try {
      const data = await exportsApi.list();
      setExports(data);
    } catch {
      /* ignore */
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await exportsApi.create({
        documentType: documentType || undefined,
        format,
        minStatus,
      });
      toast.success(t('toast.exportSuccess'));
      loadExports();
    } catch {
      toast.error(t('toast.exportError'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export form */}
      <div className="bg-base-100 rounded-box shadow-sm p-4">
        <h3 className="font-bold mb-4">{t('exports.title')}</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="form-control">
            <label className="label label-text text-xs">{t('exports.type')}</label>
            <select className="select select-bordered select-sm" value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType | '')}>
              <option value="">{t('exports.allTypes')}</option>
              <option value="DELIVERY_NOTE">{t('documentType.DELIVERY_NOTE')}</option>
              <option value="INVOICE">{t('documentType.INVOICE')}</option>
              <option value="PURCHASE_ORDER">{t('documentType.PURCHASE_ORDER')}</option>
            </select>
          </div>
          <div className="form-control">
            <label className="label label-text text-xs">{t('exports.format')}</label>
            <select className="select select-bordered select-sm" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="jsonl">JSONL</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div className="form-control">
            <label className="label label-text text-xs">{t('exports.minStatus')}</label>
            <select className="select select-bordered select-sm" value={minStatus} onChange={(e) => setMinStatus(e.target.value as 'LABELED' | 'VERIFIED')}>
              <option value="LABELED">{t('status.LABELED')}</option>
              <option value="VERIFIED">{t('status.VERIFIED')}</option>
            </select>
          </div>
          <button className="btn btn-primary btn-sm gap-2" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? <span className="loading loading-spinner loading-xs" /> : <FileDown size={14} />}
            {isCreating ? t('exports.creating') : t('exports.create')}
          </button>
        </div>
      </div>

      {/* Exports list */}
      <div className="bg-base-100 rounded-box shadow-sm overflow-x-auto">
        {exports.length === 0 ? (
          <div className="text-center p-8 text-base-content/50">{t('exports.noExports')}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('exports.format')}</th>
                <th>{t('exports.type')}</th>
                <th>{t('exports.sampleCount')}</th>
                <th>{t('exports.date')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exports.map((exp) => (
                <tr key={exp.id}>
                  <td><span className="badge badge-outline badge-sm">{exp.format}</span></td>
                  <td>{exp.documentType ? t(`documentType.${exp.documentType}`) : t('exports.allTypes')}</td>
                  <td>{exp.sampleCount}</td>
                  <td className="text-sm">{new Date(exp.createdAt).toLocaleDateString('he-IL')}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-xs gap-1"
                      onClick={() => exportsApi.download(exp.id).catch(() => toast.error(t('toast.downloadError')))}
                    >
                      <Download size={14} />
                      {t('exports.download')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
