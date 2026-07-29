import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Store, FileText, Package, PiggyBank } from 'lucide-react';
import { ReportCard } from './components/ReportCard';

export const ReportsPage = () => {
  const { t } = useTranslation('reports');
  const navigate = useNavigate();

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-base-content/60 mt-3 text-lg max-w-2xl">{t('subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ReportCard
          icon={<Store className="w-5 h-5" />}
          title={t('cards.vendor.title')}
          description={t('cards.vendor.description')}
          color="success"
          onClick={() => navigate('/reports/vendor')}
        />
        <ReportCard
          icon={<FileText className="w-5 h-5" />}
          title={t('cards.poSummary.title')}
          description={t('cards.poSummary.description')}
          color="primary"
          onClick={() => navigate('/reports/po-summary')}
        />
        <ReportCard
          icon={<Package className="w-5 h-5" />}
          title={t('cards.deliveryCerts.title')}
          description={t('cards.deliveryCerts.description')}
          color="secondary"
          onClick={() => navigate('/reports/delivery-certs')}
        />
        <ReportCard
          icon={<PiggyBank className="w-5 h-5" />}
          title={t('cards.budgetControl.title')}
          description={t('cards.budgetControl.description')}
          color="accent"
          onClick={() => navigate('/reports/budget-control')}
        />
      </div>
    </div>
  );
};
