import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import type { UploadSuccessInfo } from '../hooks/useDocumentUpload';

interface DocumentSuccessModalProps {
  info: UploadSuccessInfo;
  onClose: () => void;
  onForceReupload?: () => void;
}

export const DocumentSuccessModal = ({ info, onClose, onForceReupload }: DocumentSuccessModalProps) => {
  const { t } = useTranslation('projects');
  const isDuplicate = info.isDuplicate;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40">
      <div className="bg-base-100 rounded-xl shadow-2xl w-[400px] p-6 relative" dir="rtl">
        <button onClick={onClose} className="absolute top-3 left-3 text-base-content/30 hover:text-base-content/60 transition-colors">
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center gap-3">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isDuplicate ? 'bg-warning/10' : 'bg-success/10'}`}>
            {isDuplicate
              ? <AlertTriangle size={32} className="text-warning" />
              : <CheckCircle2 size={32} className="text-success" />}
          </div>

          <h3 className="text-lg font-bold text-base-content">
            {isDuplicate ? t('documents.duplicateDetected') : t('documents.docProcessedSuccess')}
          </h3>

          {isDuplicate && (
            <p className="text-sm text-base-content/60">
              {t('documents.duplicateExplanation')}
            </p>
          )}

          <div className="flex flex-col gap-1.5 text-sm text-base-content/70 w-full">
            {info.typeLabel && (
              <div className="flex justify-between px-4 py-1.5 bg-base-200/50 rounded-lg">
                <span className="text-base-content/50">{t('documents.docTypeLabel')}</span>
                <span className="font-medium text-base-content">{info.typeLabel}</span>
              </div>
            )}
            {info.docNumber && (
              <div className="flex justify-between px-4 py-1.5 bg-base-200/50 rounded-lg">
                <span className="text-base-content/50">{isDuplicate ? t('documents.fileName') : t('documents.number')}</span>
                <span className="font-medium text-base-content font-mono text-xs">{info.docNumber}</span>
              </div>
            )}
            {info.supplier && (
              <div className="flex justify-between px-4 py-1.5 bg-base-200/50 rounded-lg">
                <span className="text-base-content/50">{t('documents.supplier')}</span>
                <span className="font-medium text-base-content">{info.supplier}</span>
              </div>
            )}
          </div>

          {isDuplicate ? (
            <div className="flex gap-2 w-full mt-2">
              <button onClick={onClose} className="btn btn-sm btn-ghost flex-1">
                {t('documents.cancelUpload')}
              </button>
              <button onClick={onForceReupload} className="btn btn-sm btn-warning flex-1">
                {t('documents.overwriteExisting')}
              </button>
            </div>
          ) : (
            <button onClick={onClose} className="btn btn-sm btn-primary mt-2 w-full">
              {t('documents.understood')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
