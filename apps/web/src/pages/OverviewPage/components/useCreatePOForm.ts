import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useStores } from '../../../lib/store-context';
import {
  purchaseOrdersService,
  type ExtractedQuoteData,
  type ExistingPO,
} from '../../../services/purchase-orders.service';
import { LineItem, emptyLineItem, calcLineTotal } from './po-utils';
import { mapExtractedLineItems, autoMatchSupplier } from './extraction-utils';

export const useCreatePOForm = (onClose: () => void) => {
  const { t } = useTranslation('projects');
  const { projectsStore, adminStore } = useStores();

  useEffect(() => {
    if (!adminStore.companySettings) adminStore.fetchCompanySettings();
  }, [adminStore]);

  // Order details
  const [projectId, setProjectId] = useState('');
  const [poNumber] = useState(() => `PO-${String(Date.now()).slice(-4)}`);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');

  // Vendor details
  const [vendorName, setVendorName] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [withholdingTax, setWithholdingTax] = useState('');

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()]);

  // Delivery & notes
  const [siteContact, setSiteContact] = useState('');
  const [sitePhone, setSitePhone] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // File upload
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExtracted, setIsExtracted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [isDragging, setIsDragging] = useState(false);

  // Duplicate detection
  const [duplicatePO, setDuplicatePO] = useState<ExistingPO | null>(null);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'draft' | 'submitted'>('idle');
  const [pendingSubmitAsDraft, setPendingSubmitAsDraft] = useState<boolean | null>(null);

  const projects = projectsStore.activeProjects;

  // Cleanup localPreviewUrl on unmount
  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  // ─── File upload & extraction ───

  const handleFileSelect = useCallback(async (file: File) => {
    setUploadedFile(file);
    setLocalPreviewUrl(URL.createObjectURL(file));
    setIsExtracting(true);
    setIsExtracted(false);
    setDuplicatePO(null);

    try {
      const data: ExtractedQuoteData = await purchaseOrdersService.extractQuote(file);
      setFileUrl(data.fileUrl);

      // Pre-fill form
      if (data.supplierName) setVendorName(data.supplierName);
      if (data.supplierAddress) setVendorAddress(data.supplierAddress);
      if (data.vatNumber) setVatNumber(data.vatNumber);
      if (data.orderDate) setDeliveryDate(data.orderDate);
      if (data.notes) setDeliveryNotes(data.notes);

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

      setIsExtracted(true);
      toast.success(t('createPO.extractionSuccessToast'));

      // Check for duplicate POs by PO number (only warn if same PO number exists)
      if (data.poNumber) {
        try {
          const result = await purchaseOrdersService.search(data.poNumber);
          const match = result.data.find(
            (po) => po.poNumber.trim().toLowerCase() === data.poNumber!.trim().toLowerCase(),
          );
          if (match) setDuplicatePO(match);
        } catch {
          // Silently ignore search errors
        }
      }
    } catch {
      toast.error(t('createPO.extractionErrorToast'));
    } finally {
      setIsExtracting(false);
    }
  }, [t]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const resetFile = () => {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setUploadedFile(null);
    setFileUrl(null);
    setLocalPreviewUrl(null);
    setIsExtracted(false);
    setDuplicatePO(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const dismissDuplicate = () => setDuplicatePO(null);

  // ─── Line items ───

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addLineItem = () => setLineItems((prev) => [...prev, emptyLineItem()]);

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Totals ───

  const vatRate = adminStore.companySettings?.defaultVatRate ?? 18;
  const subtotal = lineItems.reduce((sum, item) => sum + calcLineTotal(item), 0);
  const vatAmount = subtotal * (vatRate / 100);
  const grandTotal = subtotal + vatAmount;

  // ─── Submit ───

  const onSubmitClick = (asDraft: boolean) => {
    if (!projectId) {
      setPendingSubmitAsDraft(asDraft);
      return;
    }
    handleSubmit(asDraft);
  };

  const handleSubmit = async (asDraft: boolean) => {
    if (!vendorName.trim()) {
      toast.error(t('createPO.supplierRequiredToast'));
      return;
    }

    setSubmitting(true);
    try {
      await purchaseOrdersService.create({
        poNumber,
        supplierName: vendorName.trim(),
        projectId: projectId || undefined,
        expectedDelivery: deliveryDate || undefined,
        paymentTerms: paymentTerms || undefined,
        vendorAddress: vendorAddress || undefined,
        vatNumber: vatNumber || undefined,
        withholdingTax: withholdingTax || undefined,
        siteContact: siteContact || undefined,
        sitePhone: sitePhone || undefined,
        deliveryNotes: deliveryNotes || undefined,
        originalFileUrl: fileUrl || undefined,
        totalAmount: grandTotal || undefined,
        lineItems: lineItems
          .filter((li) => li.description.trim())
          .map((li) => ({
            description: li.description.trim(),
            catalogNumber: li.catalogNumber || undefined,
            unit: li.unit || undefined,
            quantity: parseFloat(li.quantity) || 0,
            unitPrice: parseFloat(li.unitPrice) || undefined,
            totalPrice: calcLineTotal(li) || undefined,
            discountPercent: parseFloat(li.discountPercent) || undefined,
          })),
      });

      setSubmitStatus(asDraft ? 'draft' : 'submitted');
      toast.success(asDraft ? t('createPO.draftSavedToast') : t('createPO.orderSentToast'));
      await projectsStore.fetchProjects();
      onClose();
    } catch {
      toast.error(t('createPO.saveErrorToast'));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    projectId, setProjectId,
    poNumber,
    deliveryDate, setDeliveryDate,
    paymentTerms, setPaymentTerms,
    vendorName, setVendorName,
    vendorAddress, setVendorAddress,
    vatNumber, setVatNumber,
    withholdingTax, setWithholdingTax,
    lineItems, updateLineItem, addLineItem, removeLineItem,
    siteContact, setSiteContact,
    sitePhone, setSitePhone,
    deliveryNotes, setDeliveryNotes,
    uploadedFile, fileUrl, isExtracting, isExtracted,
    fileInputRef, handleFileSelect, handleDrop, handleFileChange, resetFile,
    localPreviewUrl, zoom, setZoom, isDragging, setIsDragging,
    duplicatePO, dismissDuplicate,
    submitting, submitStatus,
    pendingSubmitAsDraft, setPendingSubmitAsDraft,
    onSubmitClick, handleSubmit,
    subtotal, vatRate, vatAmount, grandTotal,
    projects,
  };
};
