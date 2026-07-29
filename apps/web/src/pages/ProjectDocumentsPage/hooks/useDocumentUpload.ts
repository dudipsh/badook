import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useStores } from '../../../lib/store-context';
import { apiClient } from '../../../services/api-client';

export interface UploadSuccessInfo {
  typeLabel: string;
  docNumber: string;
  supplier: string;
  isDuplicate?: boolean;
}

export const useDocumentUpload = (projectId: string | undefined) => {
  const { t } = useTranslation('projects');
  const { projectsStore, jobsStore } = useStores();
  const [uploading, setUploading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [duplicateConflict, setDuplicateConflict] = useState<{ file: File; message: string } | null>(null);
  const [successInfo, setSuccessInfo] = useState<UploadSuccessInfo | null>(null);
  const [jobCompleted, setJobCompleted] = useState(false);
  const [completedDocType, setCompletedDocType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const DOC_TYPE_LABELS: Record<string, string> = {
    deliveryNote: t('documents.deliveryNotes'),
    purchaseOrder: t('documents.purchaseOrders'),
    invoice: t('documents.invoices'),
  };

  const lastFileRef = useRef<File | null>(null);

  const activeJob = activeJobId ? jobsStore.activeJobs.get(activeJobId) : null;
  useEffect(() => {
    if (activeJob?.status === 'COMPLETED') {
      setJobCompleted(true);
      setCompletedDocType(activeJob.documentType);
      projectsStore.fetchProjects();
      const refresh = projectId ? projectsStore.fetchProjectFull(projectId) : Promise.resolve();
      refresh.then(() => {
        const details = projectsStore.fullDetails;
        const docType = activeJob.documentType;
        const docId = activeJob.documentId;
        let docNumber = '';
        let supplier = '';
        let found = false;
        if (docType === 'deliveryNote') {
          const doc = details?.deliveryNotes?.find((d) => d.id === docId);
          if (doc) { found = true; docNumber = doc.noteNumber ?? ''; supplier = doc.supplierName ?? ''; }
        } else if (docType === 'purchaseOrder') {
          const doc = details?.purchaseOrders?.find((d) => d.id === docId);
          if (doc) { found = true; docNumber = doc.poNumber ?? ''; supplier = doc.supplierName ?? ''; }
        } else if (docType === 'invoice') {
          const doc = details?.invoices?.find((d) => d.id === docId);
          if (doc) { found = true; docNumber = doc.invoiceNumber ?? ''; supplier = doc.supplierName ?? ''; }
        }
        const typeLabel = DOC_TYPE_LABELS[docType ?? ''] ?? '';
        setSuccessInfo({ typeLabel, docNumber: docNumber || activeJob.fileName, supplier });
      });
      setTimeout(() => { setActiveJobId(null); setUploading(false); setJobCompleted(false); setCompletedDocType(null); }, 3000);
    } else if (activeJob?.status === 'FAILED') {
      toast.error(activeJob.errorMessage || t('documents.docProcessError'));
      setTimeout(() => { setActiveJobId(null); setUploading(false); }, 3000);
    }
  }, [activeJob?.status]);

  const uploadFile = async (file: File, force = false) => {
    const formData = new FormData();
    formData.append('file', file);
    if (projectId) formData.append('projectId', projectId);
    if (force) formData.append('force', 'true');
    const { data } = await apiClient.post<{ jobId: string }>('/upload/delivery-note', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    jobsStore.addJob(data.jobId, file.name, projectId);
    setActiveJobId(data.jobId);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        lastFileRef.current = file;
        try { await uploadFile(file); } catch (err) {
          if (axios.isAxiosError(err) && err.response?.status === 409) {
            setDuplicateConflict({ file, message: err.response.data?.message || t('documents.docAlreadyExists') });
            return;
          }
          throw err;
        }
      }
      toast.success(t('documents.filesSentForProcessing'));
    } catch { toast.error(t('documents.uploadError')); setUploading(false); }
    finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleForceOverwrite = async () => {
    if (!duplicateConflict) return;
    const { file } = duplicateConflict;
    setDuplicateConflict(null); setUploading(true);
    try { await uploadFile(file, true); toast.success(t('documents.fileSentForReprocessing')); }
    catch { toast.error(t('documents.overwriteError')); setUploading(false); }
    finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleDuplicateForceReupload = async () => {
    const file = lastFileRef.current;
    if (!file) return;
    setSuccessInfo(null);
    setUploading(true);
    try { await uploadFile(file, true); }
    catch { toast.error(t('documents.overwriteError')); setUploading(false); }
  };

  const agentStages = activeJobId ? jobsStore.getStages(activeJobId) : null;

  return { uploading, duplicateConflict, setDuplicateConflict, fileInputRef, handleUpload, handleForceOverwrite, handleDuplicateForceReupload, agentStages, successInfo, setSuccessInfo, jobCompleted, completedDocType };
};
