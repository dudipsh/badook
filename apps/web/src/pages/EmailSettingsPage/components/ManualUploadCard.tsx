import { useRef, useState } from 'react';
import { Upload, X, FileText, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CompanyOption {
  id: string;
  name: string;
}

interface ManualUploadCardProps {
  scanning: boolean;
  onUpload: (files: File[], force: boolean) => void;
  // When provided (super-admin context), the upload is targeted at a chosen
  // company and a selection is required before processing.
  companies?: CompanyOption[];
  selectedCompanyId?: string | null;
  onSelectCompany?: (id: string | null) => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const ManualUploadCard = ({
  scanning,
  onUpload,
  companies,
  selectedCompanyId,
  onSelectCompany,
}: ManualUploadCardProps) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [force, setForce] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation('settings');
  const requireCompany = !!companies;
  const missingCompany = requireCompany && !selectedCompanyId;

  const handleFileSelect = (fileList: FileList | null) => {
    if (!fileList) return;
    setSelectedFiles((prev) => [...prev, ...Array.from(fileList)]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0 || missingCompany) return;
    onUpload(selectedFiles, force);
    setSelectedFiles([]);
    setForce(false);
  };

  return (
    <div className="bg-base-100 rounded-xl border border-base-300 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Upload className="w-5 h-5 text-base-content/60" />
        <h3 className="text-lg font-semibold text-base-content">{t('upload.title')}</h3>
      </div>
      <p className="text-sm text-base-content/50 mb-4">
        {t('upload.description')}
      </p>

      {companies && (
        <label className="block mb-4">
          <span className="text-sm font-medium text-base-content">
            {t('upload.selectCompany')} <span className="text-error">*</span>
          </span>
          <select
            value={selectedCompanyId ?? ''}
            onChange={(e) => onSelectCompany?.(e.target.value || null)}
            className="select select-bordered w-full mt-1.5 max-w-md"
          >
            <option value="">{t('upload.companyPlaceholder')}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {selectedFiles.length > 0 && (
        <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
          {selectedFiles.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-base-300 bg-base-200"
            >
              <FileText className="w-4 h-4 text-base-content/40 flex-shrink-0" />
              <span className="text-sm font-medium text-base-content flex-1 truncate" dir="ltr">
                {file.name}
              </span>
              <span className="text-xs text-base-content/40 flex-shrink-0">
                {formatSize(file.size)}
              </span>
              <button
                onClick={() => removeFile(i)}
                className="text-base-content/40 hover:text-error transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <label className="flex items-center gap-2 mb-4 text-sm text-base-content/60 cursor-pointer">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
            className="rounded border-base-300"
          />
          <AlertTriangle className="w-3.5 h-3.5 text-warning" />
          {t('upload.overwriteDuplicates')}
        </label>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-base-200 text-base-content hover:bg-base-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="w-4 h-4" />
          {selectedFiles.length > 0 ? t('upload.addFiles') : t('upload.selectFiles')}
        </button>

        {selectedFiles.length > 0 && (
          <button
            onClick={handleUpload}
            disabled={scanning || missingCompany}
            title={missingCompany ? t('upload.companyRequired') : undefined}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-neutral text-neutral-content hover:bg-neutral/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? t('upload.processing') : t('upload.startProcessing', { count: selectedFiles.length })}
          </button>
        )}
      </div>
    </div>
  );
}
