import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { adminService, type CompanyOverview } from '../../../../services/admin.service';
import { CompanyStatsGrid } from './components/CompanyStatsGrid';
import { CompanyDangerZone } from './components/CompanyDangerZone';
import toast from 'react-hot-toast';

export const CompanyOverviewTab = () => {
  const { t } = useTranslation('settings');
  const { companyId } = useParams<{ companyId: string }>();
  const [stats, setStats] = useState<CompanyOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setStats(await adminService.getCompanyStats(companyId));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('companies.statsError'));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => { load(); }, [load]);

  if (loading && !stats) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }
  if (!stats || !companyId) return null;

  return (
    <div className="space-y-4">
      <CompanyStatsGrid stats={stats} />
      <CompanyDangerZone companyId={companyId} companyName={stats.company.name} onReset={load} />
    </div>
  );
};
