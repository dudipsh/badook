import { useTranslation } from 'react-i18next';
import { ArrowRight, Upload, Loader2, Archive, FileText, Package, ReceiptText } from 'lucide-react';

interface DocTabType {
  key: string;
  label: string;
  count: number;
}

interface DocPageHeaderProps {
  projectName: string | undefined;
  uploading: boolean;
  onBack: () => void;
  onUploadClick: () => void;
  tabs: DocTabType[];
  activeTab: string;
  onTabChange: (key: string) => void;
  highlightTab?: string | null;
}

export const DocPageHeader = ({ projectName, uploading, onBack, onUploadClick, tabs, activeTab, onTabChange, highlightTab }: DocPageHeaderProps) => {
  const { t } = useTranslation('projects');

  const tabColors: Record<string, { active: string; border: string }> = {
    'purchase-orders': { active: 'text-primary', border: 'border-primary' },
    'delivery-notes': { active: 'text-secondary', border: 'border-secondary' },
    'invoices': { active: 'text-accent', border: 'border-accent' },
  };

  const getIcon = (key: string) => {
    switch (key) {
      case 'purchase-orders': return <FileText className="w-3.5 h-3.5" />;
      case 'delivery-notes': return <Package className="w-3.5 h-3.5" />;
      case 'invoices': return <ReceiptText className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  return (
    <div className="px-4 pt-3 pb-2 bg-base-200/30 border-b border-base-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-base-content/40 hover:text-base-content/60 transition-colors">
            <ArrowRight size={20} />
          </button>
          <h1 className="text-xl font-bold text-base-content">{t('documents.title', 'מסמכים')}</h1>
          <div className="flex items-center gap-1.5 opacity-50 text-xs mt-1">
            <Archive className="w-3.5 h-3.5" />
            <span>{t('documents.manageLog', { name: projectName || '—' })}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onUploadClick}
            disabled={uploading}
            className="btn btn-xs btn-primary gap-1 text-xs"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {uploading ? t('documents.uploading', 'מעלה...') : t('documents.uploadFiles', 'העלאת מסמכים')}
          </button>
        </div>
      </div>

      {/* Tri-Color Tabs */}
      <div className="flex items-center gap-1 mt-2 -mb-2">
        {tabs.map((tab) => {
          const config = tabColors[tab.key] || { active: 'text-primary', border: 'border-primary' };
          const isActive = activeTab === tab.key;

          const isHighlighted = highlightTab === tab.key;

          return (
            <button
              key={tab.key}
              className={`relative px-4 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                isActive ? `${config.active} ${config.border}` : 'border-transparent text-base-content/50 hover:text-base-content/80'
              }`}
              onClick={() => onTabChange(tab.key)}
            >
              {getIcon(tab.key)}
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs min-w-5 h-5 flex items-center justify-center rounded-full px-1 font-bold ${
                  isHighlighted
                    ? 'bg-warning text-warning-content'
                    : isActive
                      ? 'bg-base-content/10 text-base-content/60'
                      : 'bg-base-200 text-base-content/40'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
