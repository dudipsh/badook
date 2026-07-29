import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useStores } from '../../../lib/store-context';
import { purchaseOrdersService } from '../../../services/purchase-orders.service';
import { projectsService } from '../../../services/projects.service';
import { apiClient } from '../../../services/api-client';
import {
  type LineItem,
  emptyLineItem,
  calcLineTotal,
} from '../../OverviewPage/components/po-utils';
import {
  mapExtractedLineItems,
  autoMatchSupplier,
} from '../../OverviewPage/components/extraction-utils';
import type { DocType } from '../../../types/reconciliation';
import type { OrphanedDoc } from '../../../types/orphan';

interface UseUploadDocumentFormProps {
  docType: DocType;
  onClose: () => void;
  isOpen: boolean;
  orphanDoc?: OrphanedDoc;
  externalProjectId?: string;
  showProjectSelector?: boolean;
  onOrphanSuccess?: () => void;
  editMode?: boolean;
  editDocumentId?: string;
  editDocumentType?: 'deliveryNote' | 'purchaseOrder' | 'invoice';
}

const orphanLineItemsToForm = (doc: OrphanedDoc): LineItem[] => {
  if (!doc.lineItems.length) return [emptyLineItem()];
  return doc.lineItems.map((li) => ({
    description: li.description,
    catalogNumber: li.catalogNumber ?? '',
    unit: li.unit ?? '',
    quantity: li.quantity?.toString() ?? '',
    unitPrice: li.unitPrice?.toString() ?? '',
    discountPercent: li.discountPercent?.toString() ?? '0',
  }));
};

export const useUploadDocumentForm = ({
  docType,
  onClose,
  isOpen,
  orphanDoc,
  externalProjectId,
  showProjectSelector,
  onOrphanSuccess,
  editMode,
  editDocumentId,
  editDocumentType,
}: UseUploadDocumentFormProps) => {
  const { t } = useTranslation('projects');
  const { jobsStore, projectDashboardStore, adminStore, projectsStore } = useStores();

  useEffect(() => {
    if (!adminStore.companySettings) adminStore.fetchCompanySettings();
  }, [adminStore]);

  useEffect(() => {
    if (showProjectSelector && !projectsStore.projects.length) projectsStore.fetchProjects();
  }, [showProjectSelector, projectsStore]);

  const project = projectDashboardStore.project;
  const [selectedProjectId, setSelectedProjectId] = useState(externalProjectId ?? '');
  const projectId = showProjectSelector ? selectedProjectId : (externalProjectId ?? project?.id ?? '');
  const projectName = showProjectSelector
    ? (projectsStore.activeProjects.find((p) => p.id === selectedProjectId)?.name ?? '')
    : (externalProjectId ? '' : (project?.name ?? ''));

  // Order details
  const [docNumber, setDocNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');

  // Vendor details
  const [vendorName, setVendorName] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [withholdingTax, setWithholdingTax] = useState('');

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()]);

  // File upload
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExtracted, setIsExtracted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview
  const [zoom, setZoom] = useState(100);
  const [isDragging, setIsDragging] = useState(false);

  // Duplicate detection
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Submit
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Reset + pre-populate on open
  useEffect(() => {
    if (!isOpen) return;

    setPaymentTerms('');
    setVendorAddress('');
    setVatNumber('');
    setWithholdingTax('');
    setUploadedFile(null);
    setLocalPreviewUrl(null);
    setIsExtracting(false);
    setZoom(100);
    setIsDragging(false);
    setSubmitStatus('idle');
    setErrorMessage('');
    setDuplicateWarning(null);
    setSelectedProjectId(externalProjectId ?? '');

    if (editMode && editDocumentId) {
      // Pre-populate from existing document in store
      const details = projectsStore.fullDetails;
      const toDateInput = (v?: string | null) => (v ? v.slice(0, 10) : '');
      const mapLineItems = (items: any[]) =>
        items.map((li: any) => ({
          description: li.description ?? '',
          catalogNumber: li.catalogNumber ?? '',
          unit: li.unit ?? '',
          quantity: li.quantity?.toString() ?? '',
          unitPrice: li.unitPrice?.toString() ?? '',
          discountPercent: li.discountPercent?.toString() ?? '0',
        }));

      if (editDocumentType === 'deliveryNote') {
        const doc = details?.deliveryNotes?.find((d) => d.id === editDocumentId);
        if (doc) {
          setDocNumber(doc.noteNumber ?? '');
          setDeliveryDate(toDateInput(doc.deliveryDate));
          setVendorName(doc.supplierName ?? '');
          setFileUrl(doc.originalFileUrl ?? null);
          if (doc.lineItems?.length) setLineItems(mapLineItems(doc.lineItems));
          setIsExtracted(true);
        }
      } else if (editDocumentType === 'purchaseOrder') {
        const doc = details?.purchaseOrders?.find((d) => d.id === editDocumentId);
        if (doc) {
          setDocNumber(doc.poNumber ?? '');
          setDeliveryDate(toDateInput(doc.orderDate));
          setVendorName(doc.supplierName ?? '');
          setFileUrl(doc.originalFileUrl ?? null);
          if (doc.lineItems?.length) setLineItems(mapLineItems(doc.lineItems));
          setIsExtracted(true);
        }
      } else if (editDocumentType === 'invoice') {
        const doc = details?.invoices?.find((d) => d.id === editDocumentId);
        if (doc) {
          setDocNumber(doc.invoiceNumber ?? '');
          setDeliveryDate(toDateInput(doc.invoiceDate));
          setVendorName(doc.supplierName ?? '');
          setFileUrl(doc.originalFileUrl ?? null);
          if (doc.lineItems?.length) setLineItems(mapLineItems(doc.lineItems));
          setIsExtracted(true);
        }
      }
    } else if (orphanDoc) {
      // Pre-populate from already-extracted data
      setFileUrl(orphanDoc.originalFileUrl);
      setVendorName(orphanDoc.supplierName);
      setDocNumber(orphanDoc.docNumber ?? '');
      setDeliveryDate(orphanDoc.date ?? '');
      setLineItems(orphanLineItemsToForm(orphanDoc));
      setIsExtracted(true);
    } else {
      setFileUrl(null);
      setVendorName('');
      setDocNumber('');
      setDeliveryDate('');
      setLineItems([emptyLineItem()]);
      setIsExtracted(false);
    }
  }, [isOpen]);

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const vatRate = adminStore.companySettings?.defaultVatRate ?? 18;
  const subtotal = lineItems.reduce((sum, item) => sum + calcLineTotal(item), 0);
  const vatAmount = subtotal * (vatRate / 100);
  const grandTotal = subtotal + vatAmount;

  // File extraction via OCR (normal upload flow only)
  const handleFileSelect = useCallback(
    async (file: File) => {
      setUploadedFile(file);
      setLocalPreviewUrl(URL.createObjectURL(file));
      setIsExtracting(true);
      setIsExtracted(false);

      try {
        const data = await purchaseOrdersService.extractQuote(file);
        setFileUrl(data.fileUrl);

        if (data.supplierName) setVendorName(data.supplierName);
        if (data.supplierAddress) setVendorAddress(data.supplierAddress);
        if (data.vatNumber) setVatNumber(data.vatNumber);
        if (data.orderDate) setDeliveryDate(data.orderDate);
        if (data.poNumber) setDocNumber(data.poNumber);

        if (data.supplierName) {
          const matched = await autoMatchSupplier(data.supplierName);
          if (matched) {
            setVendorName(matched.name);
            if (matched.address) setVendorAddress(matched.address);
            if (matched.businessId) setVatNumber(matched.businessId);
          }
        }

        const mapped = mapExtractedLineItems(data.lineItems);
        if (mapped.length > 0) setLineItems(mapped);

        if (data.poNumber) {
          try {
            const { data: dupCheck } = await apiClient.get<{ exists: boolean }>(
              `/purchase-orders/check-duplicate/${encodeURIComponent(data.poNumber)}`,
            );
            if (dupCheck.exists) {
              setDuplicateWarning(`הזמנת רכש מספר ${data.poNumber} כבר קיימת במערכת`);
            }
          } catch {
            // Non-critical check
          }
        }

        setIsExtracted(true);
        toast.success(t('upload.extractionSuccessToast'));
      } catch {
        toast.error(t('upload.extractionErrorToast'));
      } finally {
        setIsExtracting(false);
      }
    },
    [t],
  );

  const resetFile = () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setUploadedFile(null);
    setFileUrl(null);
    setLocalPreviewUrl(null);
    setIsExtracted(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Line items CRUD
  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addLineItem = () => setLineItems((prev) => [...prev, emptyLineItem()]);

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit
  const handleSubmit = async () => {
    setSubmitStatus('uploading');
    setErrorMessage('');

    try {
      if (editMode && editDocumentId && editDocumentType) {
        // Edit flow: update existing document metadata + line items
        await projectsService.updateDocument(editDocumentId, editDocumentType, {
          supplierName: vendorName || undefined,
          docNumber: docNumber || undefined,
          date: deliveryDate || undefined,
          totalAmount: grandTotal || undefined,
          lineItems: lineItems.filter((li) => li.description || li.quantity || li.unitPrice),
        });
        setSubmitStatus('success');
      } else if (orphanDoc) {
        // Orphan flow: assign existing doc to project
        await projectsService.linkDocuments(projectId, [
          { id: orphanDoc.id, type: orphanDoc.docType },
        ]);
        setSubmitStatus('success');
        onOrphanSuccess?.();
      } else {
        // Normal flow: upload new file
        if (!uploadedFile) return;
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('projectId', projectId);
        formData.append('docType', docType);
        if (docNumber) formData.append('poNumber', docNumber);
        if (vendorName) formData.append('vendorName', vendorName);

        const { data } = await apiClient.post<{ jobId: string }>(
          '/upload/delivery-note',
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );

        jobsStore.addJob(data.jobId, uploadedFile.name, projectId);
        setSubmitStatus('success');
        projectDashboardStore.setMatching(true);
      }
      setTimeout(() => { onClose(); }, 600);
    } catch (e: any) {
      setSubmitStatus('error');
      setErrorMessage(e?.response?.data?.message || e?.message || t('upload.uploadFailed'));
    }
  };

  const handleCreateProject = async (name: string, address: string) => {
    const project = await projectsStore.createProject({ name, address: address || null });
    setSelectedProjectId(project.id);
  };

  return {
    projectName,
    projectId,
    selectedProjectId,
    setSelectedProjectId,
    showProjectSelector: !!showProjectSelector,
    activeProjects: projectsStore.activeProjects,
    handleCreateProject,
    docType,
    docNumber,
    setDocNumber,
    deliveryDate,
    setDeliveryDate,
    paymentTerms,
    setPaymentTerms,
    vendorName,
    setVendorName,
    vendorAddress,
    setVendorAddress,
    vatNumber,
    setVatNumber,
    withholdingTax,
    setWithholdingTax,
    lineItems,
    updateLineItem,
    addLineItem,
    removeLineItem,
    subtotal,
    vatRate,
    vatAmount,
    grandTotal,
    uploadedFile,
    fileUrl,
    localPreviewUrl,
    isExtracting,
    isExtracted,
    zoom,
    setZoom,
    isDragging,
    setIsDragging,
    fileInputRef,
    handleFileSelect,
    resetFile,
    submitStatus,
    errorMessage,
    duplicateWarning,
    handleSubmit,
    isOrphanFlow: !!orphanDoc,
    editMode: !!editMode,
  };
};
