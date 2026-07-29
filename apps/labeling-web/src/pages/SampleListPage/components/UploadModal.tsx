import { useState, useRef, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Upload, FileUp, AlertTriangle } from 'lucide-react';
import { useStores } from '@/stores/store-context';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import toast from 'react-hot-toast';
import { checkDuplicate } from '@/api/samples.api';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UploadModal = observer(({ isOpen, onClose }: UploadModalProps) => {
  const { t } = useTranslation();
  const { samplesStore } = useStores();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setDuplicateInfo(null);
    }
  };

  const doUpload = async (replaceId?: string) => {
    if (!file) return;
    try {
      const samples = await samplesStore.uploadSample(file, replaceId);
      if (samples.length > 1) {
        toast.success(`הועלו ${samples.length} דוגמאות`);
      } else {
        toast.success(t('toast.uploadSuccess'));
      }
      setFile(null);
      setDuplicateInfo(null);
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { existingId?: string; existingFileName?: string; documentNumber?: string } } };
      if (axiosErr?.response?.status === 409 && axiosErr.response.data?.existingId) {
        const { existingId, existingFileName, documentNumber } = axiosErr.response.data;
        setDuplicateInfo({ existingId, existingFileName: existingFileName ?? file.name, documentNumber });
      } else {
        toast.error(t('toast.uploadError'));
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      const check = await checkDuplicate(file.name);
      if (check.isDuplicate && check.existingId) {
        setDuplicateInfo({ existingId: check.existingId, existingFileName: check.existingFileName ?? file.name });
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
    if (samplesStore.isUploading) return;
    setFile(null);
    setDuplicateInfo(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('upload.title')}>
      <div className="flex flex-col gap-4">
        {duplicateInfo ? (
          <>
            <div className="alert alert-warning">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <div className="font-semibold">מסמך כפול</div>
                <div className="text-sm">
                  {duplicateInfo.documentNumber
                    ? `קיים כבר מסמך עם מספר "${duplicateInfo.documentNumber}" (${duplicateInfo.existingFileName})`
                    : `קיים כבר מסמך בשם "${duplicateInfo.existingFileName}"`}
                </div>
              </div>
            </div>
            <div className="modal-action">
              <Button variant="ghost" onClick={() => setDuplicateInfo(null)}>
                {t('buttons.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleReplace}
                isLoading={samplesStore.isUploading}
              >
                החלף
              </Button>
            </div>
          </>
        ) : (
          <>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragOver ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50'}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
                onChange={handleFileChange}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <FileUp className="w-5 h-5" />
                  <span>{t('upload.fileSelected', { name: file.name })}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-base-content/50">
                  <Upload className="w-8 h-8" />
                  <span>{t('upload.dropzone')}</span>
                </div>
              )}
            </div>

            <div className="modal-action">
              <Button variant="ghost" onClick={handleClose}>
                {t('buttons.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleUpload}
                disabled={!file}
                isLoading={samplesStore.isUploading}
              >
                {samplesStore.isUploading ? t('buttons.uploading') : t('buttons.upload')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
});

export default UploadModal;
