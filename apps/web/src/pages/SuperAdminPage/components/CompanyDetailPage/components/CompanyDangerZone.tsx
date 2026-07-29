import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, RotateCcw, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { adminService } from '../../../../../services/admin.service';
import { useStores } from '../../../../../lib/store-context';
import toast from 'react-hot-toast';

interface Props {
  companyId: string;
  companyName: string;
  onReset: () => void;
}

export const CompanyDangerZone = ({ companyId, companyName, onReset }: Props) => {
  const { t } = useTranslation('settings');
  const { superAdminStore } = useStores();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    if (!confirm(t('companies.exportToTrainingConfirm', { name: companyName }))) return;
    setExporting(true);
    const toastId = toast.loading(t('companies.exporting', { name: companyName }));
    try {
      const summary = await adminService.exportCompanyToTrainingLab(companyId);
      toast.success(t('companies.exportDone', { uploaded: summary.uploaded, failed: summary.failed }), { id: toastId, duration: 8000 });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('companies.exportError'), { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  const handleReset = async () => {
    if (!confirm(t('companies.resetDataConfirm', { name: companyName }))) return;
    setResetting(true);
    try {
      await adminService.resetCompanyData(companyId);
      toast.success(t('companies.resetDataDone', { name: companyName }));
      onReset();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('companies.resetDataError'));
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('companies.deleteCompanyConfirm', { name: companyName }))) return;
    setDeleting(true);
    try {
      await superAdminStore.deleteCompany(companyId);
      toast.success(t('companies.companyDeleted'));
      navigate('/super-admin/companies');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('companies.deleteCompanyError'));
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-red-200 p-5 space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700">
        <AlertTriangle size={16} /> {t('companyDetail.dangerZone')}
      </h3>
      <div className="flex flex-wrap gap-2">
        <button onClick={handleExport} disabled={exporting} className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-2 text-secondary hover:bg-gray-50 disabled:opacity-60">
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
          {t('companies.exportToTraining')}
        </button>
        <button onClick={handleReset} disabled={resetting} className="flex items-center gap-1.5 text-sm border border-red-200 rounded-lg px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-60">
          {resetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          {t('companies.resetData')}
        </button>
        <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 text-sm border border-red-200 rounded-lg px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-60">
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          {t('companies.deleteCompany')}
        </button>
      </div>
    </div>
  );
};
