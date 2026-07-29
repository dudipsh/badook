import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft, Download, Maximize2, Minimize2, Building2, Calendar, Search, FileSpreadsheet } from 'lucide-react';
import { useStores } from '../../../lib/store-context';
import { MOCK_PROJECTS, MOCK_VENDORS, MOCK_MONTHS } from '../data';

interface ReportLayoutProps {
  title: string;
  showVendorFilter?: boolean;
  requiresVendor?: boolean;
  children: (props: { selectedProject: string; selectedVendor: string; selectedMonth: string }) => React.ReactNode;
}

export const ReportLayout = ({ title, showVendorFilter = false, requiresVendor = false, children }: ReportLayoutProps) => {
  const { t } = useTranslation('reports');
  const navigate = useNavigate();
  const { languageStore } = useStores();
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedVendor, setSelectedVendor] = useState('ALL');
  const [isExpanded, setIsExpanded] = useState(false);

  const showEmptyState = selectedProject === 'ALL' || (requiresVendor && selectedVendor === 'ALL');
  const emptyMessage = selectedProject === 'ALL' ? t('selectProjectFirst') : t('selectVendorFirst');

  return (
    <div className={`flex flex-col bg-base-100 shadow-sm overflow-hidden ${
      isExpanded
        ? 'fixed inset-4 z-50 rounded-2xl shadow-2xl border border-primary/20'
        : 'flex-1 rounded-2xl border border-base-300 h-[calc(100vh-10rem)]'
    }`}>
      {/* Toolbar */}
      <div className="p-4 bg-base-200/50 border-b border-base-300 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/reports')} className="btn btn-sm btn-ghost gap-2">
            {languageStore.isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {t('back')}
          </button>
          <div className="h-6 w-px bg-base-300" />
          <h2 className="text-lg font-bold">{title}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn btn-sm btn-primary shrink-0 shadow-md">
            <span>{t('exportXlsx')}</span>
            <Download className="w-4 h-4 rtl:mr-2 ltr:ml-2" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn btn-sm btn-ghost btn-square"
            title={t('expandFullscreen')}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4 opacity-70" /> : <Maximize2 className="w-4 h-4 opacity-70" />}
          </button>
        </div>
      </div>

      {/* Filters Strip */}
      <div className="p-4 border-b border-base-200 flex flex-wrap items-center gap-4 bg-base-100 shrink-0">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 opacity-50" />
          <select
            className="select select-bordered select-sm w-full max-w-xs font-medium"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="ALL">{t('selectProject')}</option>
            {MOCK_PROJECTS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {showVendorFilter && (
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 opacity-50" />
            <select
              className="select select-bordered select-sm w-full max-w-xs font-medium"
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
            >
              <option value="ALL">{t('selectVendor')}</option>
              {MOCK_VENDORS.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 opacity-50" />
          <select
            className="select select-bordered select-sm font-medium"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="ALL">{t('allMonths')}</option>
            {MOCK_MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {showEmptyState ? (
        <div className="flex-1 flex items-center justify-center bg-base-200/20">
          <div className="text-center opacity-50">
            <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-xl font-bold mb-2">{t('previewUnavailable')}</h3>
            <p>{emptyMessage}</p>
          </div>
        </div>
      ) : (
        children({ selectedProject, selectedVendor, selectedMonth })
      )}
    </div>
  );
};
