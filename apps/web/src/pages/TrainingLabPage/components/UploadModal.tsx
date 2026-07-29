import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileUp, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { samplesApi } from '../api';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

export const UploadModal = ({ isOpen, onClose, onUploaded }: UploadModalProps) => {
  const { t } = useTranslation('training-lab');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ existingId: string; existingFileName: string; documentNumber?: string } | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setDuplicateInfo(null);
    }
  }, []);

  const doUpload = async (replaceId?: string) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const samples = await samplesApi.upload(file, replaceId);
      if (samples.length > 1) {
        toast.success(`הועלו ${samples.length} דוגמאות`);
      } else {
        toast.success(t('toast.uploadSuccess'));
      }
      setFile(null);
      setDuplicateInfo(null);
      onClose();
      onUploaded();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { existingId?: string; existingFileName?: string; documentNumber?: string } } };
      if (axiosErr?.response?.status === 409 && axiosErr.response.data?.existingId) {
        const { existingId, existingFileName, documentNumber } = axiosErr.response.data;
        setDuplicateInfo({ existingId, existingFileName: existingFileName ?? file.name, documentNumber });
      } else {
        toast.error(t('toast.uploadError'));
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const check = await samplesApi.checkDuplicate(file.name);
      if (check.isDuplicate && check.existingId) {
        setDuplicateInfo({ existingId: check.existingId, existingFileName: check.existingFileName ?? file.name });
        setIsUploading(false);
        return;
      }
    } catch {
      // If check fails, proceed with upload
    }
    await doUpload();
  };

  const handleReplace = () => {
    if (duplicateInfo) {
      doUpload(duplicateInfo.existingId);
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    setFile(null);
    setDuplicateInfo(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">{t('upload.title')}</h3>

        {duplicateInfo ? (
          <div className="flex flex-col gap-4">
            <div className="alert alert-warning">
              <AlertTriangle size={20} />
              <div>
                <div className="font-semibold">{t('upload.duplicateTitle')}</div>
                <div className="text-sm">
                  {duplicateInfo.documentNumber
                    ? `קיים כבר מסמך עם מספר "${duplicateInfo.documentNumber}" (${duplicateInfo.existingFileName})`
                    : t('upload.duplicateMessage', { name: duplicateInfo.existingFileName })}
                </div>
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setDuplicateInfo(null); }}>{t('buttons.cancel')}</button>
              <button className="btn btn-warning" onClick={handleReplace} disabled={isUploading}>
                {isUploading ? <span className="loading loading-spinner loading-sm" /> : t('upload.replace')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragOver ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50'}`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
                onChange={(e) => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setDuplicateInfo(null); } }}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <FileUp size={20} />
                  <span>{t('upload.fileSelected', { name: file.name })}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-base-content/50">
                  <Upload size={32} />
                  <span>{t('upload.dropzone')}</span>
                </div>
              )}
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={handleClose} disabled={isUploading}>{t('buttons.cancel')}</button>
              <button className="btn btn-primary" onClick={handleUpload} disabled={!file || isUploading}>
                {isUploading ? <><span className="loading loading-spinner loading-sm" /> {t('upload.uploading')}</> : t('buttons.upload')}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={handleClose} />
    </div>
  );
};
