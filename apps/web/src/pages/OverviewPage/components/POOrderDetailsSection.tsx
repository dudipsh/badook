import { useTranslation } from 'react-i18next';
import type { Project } from '../../../services/projects.service';
import { POSectionTitle } from './POSectionTitle';
import { ProjectSelector } from './ProjectSelector';

interface POOrderDetailsSectionProps {
  projects: Project[];
  projectId: string;
  setProjectId: (id: string) => void;
  onCreateProject: (name: string, address: string) => Promise<void>;
  poNumber: string;
  deliveryDate: string;
  setDeliveryDate: (date: string) => void;
  paymentTerms: string;
  setPaymentTerms: (terms: string) => void;
}

export const POOrderDetailsSection = ({
  projects,
  projectId,
  setProjectId,
  onCreateProject,
  poNumber,
  deliveryDate,
  setDeliveryDate,
  paymentTerms,
  setPaymentTerms,
}: POOrderDetailsSectionProps) => {
  const { t } = useTranslation('projects');

  return (
    <>
      <POSectionTitle icon="🏗️" title={t('createPO.orderDetails')} />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-base-content/60 mb-1.5">{t('createPO.project')}</label>
          <ProjectSelector
            projects={projects}
            value={projectId}
            onChange={setProjectId}
            onCreateProject={onCreateProject}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-base-content/60 mb-1.5">{t('createPO.orderNumber')}</label>
          <div className="flex items-center gap-2 px-3 py-2.5 border border-base-300 rounded-lg bg-base-200 text-sm text-base-content/50">
            <span className="text-base-content/40">#</span>
            {poNumber}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-base-content/60 mb-1.5">{t('createPO.deliveryDate')}</label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-base-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-base-content/60 mb-1.5">{t('createPO.paymentTerms')}</label>
          <input
            type="text"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder={t('createPO.paymentTermsPlaceholder')}
            className="w-full px-3 py-2.5 border border-base-300 rounded-lg text-sm placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary/50"
          />
        </div>
      </div>
    </>
  );
};
