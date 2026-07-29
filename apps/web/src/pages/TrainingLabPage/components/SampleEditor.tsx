import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Save, CheckCircle, RotateCcw, Plus, Trash2, ZoomIn, ZoomOut, RotateCw, Eraser, Hand, MousePointer } from 'lucide-react';
import toast from 'react-hot-toast';
import { samplesApi } from '../api';
import type { Sample, Extraction, LineItem, DeliveryNoteExtraction, InvoiceExtraction, DocumentType } from '../types';

interface SampleEditorProps {
  sample: Sample | null;
  onBack: () => void;
  onSampleUpdated: (sample: Sample) => void;
}

const emptyLineItem: LineItem = {
  lineNumber: null, description: '', catalogNumber: '', quantity: null, unit: '',
  unitPrice: null, totalPrice: null, discountPercent: null,
  discountAmount: null, priceBeforeDiscount: null, remarks: '',
  deliveryNoteRef: null,
};

export const SampleEditor = ({ sample, onBack, onSampleUpdated }: SampleEditorProps) => {
  const { t } = useTranslation('training-lab');
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('gemini');
  const [models, setModels] = useState<Array<{ id: string; name: string; available: boolean }>>([]);
  const [zoom, setZoom] = useState(1);
  const [panMode, setPanMode] = useState(() => localStorage.getItem('viewer-pan-mode') !== 'false');
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const togglePanMode = useCallback(() => {
    setPanMode((prev) => {
      const next = !prev;
      localStorage.setItem('viewer-pan-mode', String(next));
      return next;
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!panMode) return;
    const el = viewerRef.current;
    if (!el) return;
    setIsPanning(true);
    el.setPointerCapture(e.pointerId);
    panStart.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
  }, [panMode]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;
    const el = viewerRef.current;
    if (!el) return;
    el.scrollLeft = panStart.current.scrollLeft - (e.clientX - panStart.current.x);
    el.scrollTop = panStart.current.scrollTop - (e.clientY - panStart.current.y);
  }, [isPanning]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  useEffect(() => {
    samplesApi.fetchModels().then(setModels).catch(() => {});
  }, []);

  const [formData, setFormData] = useState<Extraction | null>(sample?.groundTruth ?? sample?.geminiExtraction ?? null);

  useEffect(() => {
    const data = sample?.groundTruth ?? sample?.geminiExtraction ?? null;
    setFormData(data);
  }, [sample?.id]);

  if (!sample || !formData) {
    return <div className="text-center p-8 text-base-content/50">{t('editor.selectSample')}</div>;
  }

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: unknown) => {
    setFormData((prev) => {
      if (!prev) return prev;
      const items = [...prev.lineItems];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, lineItems: items };
    });
  };

  const addLineItem = () => {
    setFormData((prev) => prev ? { ...prev, lineItems: [...prev.lineItems, { ...emptyLineItem }] } : prev);
  };

  const removeLineItem = (index: number) => {
    setFormData((prev) => prev ? { ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) } : prev);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await samplesApi.updateGroundTruth(sample.id, formData);
      onSampleUpdated(updated);
      toast.success(t('toast.saveSuccess'));
    } catch {
      toast.error(t('toast.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      await samplesApi.updateGroundTruth(sample.id, formData);
      const updated = await samplesApi.verify(sample.id);
      onSampleUpdated(updated);
      toast.success(t('toast.verifySuccess'));
    } catch {
      toast.error(t('toast.saveError'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleExtract = async () => {
    setIsExtracting(true);
    try {
      const updated = await samplesApi.reExtractWithModel(sample.id, selectedModelId);
      onSampleUpdated(updated);
      const extraction = updated.groundTruth ?? updated.geminiExtraction;
      setFormData(extraction);
      toast.success(t('toast.reExtractSuccess'));
    } catch {
      toast.error(t('toast.saveError'));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleClearFields = () => {
    const cleared = { ...formData } as any;
    for (const key of Object.keys(cleared)) {
      if (key === 'lineItems') {
        cleared[key] = [];
      } else if (typeof cleared[key] === 'string') {
        cleared[key] = '';
      } else if (typeof cleared[key] === 'number') {
        cleared[key] = null;
      }
    }
    setFormData(cleared);
    toast.success(t('toast.clearedFields'));
  };

  const docNumberField = 'noteNumber' in formData ? 'noteNumber'
    : 'invoiceNumber' in formData ? 'invoiceNumber'
    : 'poNumber' in formData ? 'poNumber' : null;

  const docDateField = 'deliveryDate' in formData ? 'deliveryDate'
    : 'invoiceDate' in formData ? 'invoiceDate'
    : 'orderDate' in formData ? 'orderDate' : null;

  const hasDeliveryAddress = 'deliveryAddress' in formData;
  const hasProjectName = 'projectName' in formData;
  const hasPoReference = 'poReference' in formData;
  const hasDeliveryNoteRefs = 'deliveryNoteReferences' in formData;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm gap-2" onClick={onBack}>
            <ArrowRight size={16} />
            {t('editor.back')}
          </button>
          <select
            className="select select-bordered select-sm"
            value={sample.documentType}
            onChange={async (e) => {
              try {
                const updated = await samplesApi.updateDocumentType(sample.id, e.target.value as DocumentType);
                onSampleUpdated(updated);
                toast.success(t('toast.documentTypeUpdated'));
              } catch {
                toast.error(t('toast.documentTypeError'));
              }
            }}
          >
            {(['DELIVERY_NOTE', 'INVOICE', 'PURCHASE_ORDER'] as const).map((type) => (
              <option key={type} value={type}>{t(`documentType.${type}`)}</option>
            ))}
          </select>
          <span className="text-sm text-base-content/60 truncate max-w-[300px]">{sample.originalFileName}</span>
          {sample.pageCount > 1 && (
            <span className="badge badge-info badge-sm">{t('editor.pageInfo', { name: sample.originalFileName, count: sample.pageCount })}</span>
          )}
        </div>
        <div className="flex gap-2">
          <select
            className="select select-bordered select-sm"
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id} disabled={!model.available}>
                {model.name}{!model.available ? ' (לא מוגדר)' : ''}
              </option>
            ))}
          </select>
          <button className="btn btn-accent btn-sm gap-2" onClick={handleExtract} disabled={isExtracting}>
            {isExtracting ? <span className="loading loading-spinner loading-xs" /> : <RotateCcw size={14} />}
            חלץ
          </button>
          <button className="btn btn-sm btn-ghost gap-2" onClick={handleClearFields}>
            <Eraser size={14} />
            {t('editor.clearFields')}
          </button>
          <button className="btn btn-primary btn-sm gap-2" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
            {t('editor.save')}
          </button>
          <button className="btn btn-success btn-sm gap-2" onClick={handleVerify} disabled={isVerifying}>
            {isVerifying ? <span className="loading loading-spinner loading-xs" /> : <CheckCircle size={14} />}
            {t('editor.verify')}
          </button>
        </div>
      </div>

      {/* Side-by-side: Image + Form */}
      <div className="flex gap-4 min-h-[70vh]">
        {/* Left: Document viewer */}
        <div className="w-2/5 bg-white rounded-box border border-base-300 flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-center gap-1 p-1 border-b border-base-300 bg-base-200/50">
            <button className="btn btn-ghost btn-xs" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} title="Zoom out">
              <ZoomOut size={14} />
            </button>
            <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button className="btn btn-ghost btn-xs" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} title="Zoom in">
              <ZoomIn size={14} />
            </button>
            <button className="btn btn-ghost btn-xs" onClick={() => setZoom(1)} title="Reset">
              <RotateCw size={14} />
            </button>
            <div className="divider divider-horizontal mx-0" />
            <button
              className={`btn btn-xs ${panMode ? 'btn-active' : 'btn-ghost'}`}
              onClick={togglePanMode}
              title={panMode ? 'מצב הזזה' : 'מצב בחירת טקסט'}
            >
              {panMode ? <Hand size={14} /> : <MousePointer size={14} />}
            </button>
          </div>
          {panMode ? (
            <div
              ref={viewerRef}
              className="overflow-auto flex-1"
              style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {sample.filePath.endsWith('.pdf') ? (
                <iframe
                  src={`${samplesApi.fileUrl(sample.id)}#toolbar=0&navpanes=0&view=FitH`}
                  className="border-0 pointer-events-none"
                  style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, minHeight: '70vh', transformOrigin: 'top right' }}
                />
              ) : (
                <img
                  src={samplesApi.fileUrl(sample.id)}
                  alt={sample.originalFileName}
                  className="p-2 max-w-none select-none"
                  draggable={false}
                  style={{ width: `${zoom * 100}%`, transformOrigin: 'top right' }}
                />
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              {sample.filePath.endsWith('.pdf') ? (
                <iframe
                  src={`${samplesApi.fileUrl(sample.id)}#toolbar=1&navpanes=0&view=FitH`}
                  className="border-0 w-full h-full"
                />
              ) : (
                <div ref={viewerRef} className="overflow-auto h-full">
                  <img
                    src={samplesApi.fileUrl(sample.id)}
                    alt={sample.originalFileName}
                    className="p-2 max-w-none"
                    style={{ width: `${zoom * 100}%`, transformOrigin: 'top right' }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Form */}
        <div className="w-3/5 bg-base-100 rounded-box shadow-sm p-4 overflow-y-auto max-h-[80vh]">
          <h3 className="font-bold mb-4">{t('editor.groundTruth')}</h3>

          {/* Header fields */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="form-control">
              <label className="label label-text text-xs">{t('editor.documentNumber')}</label>
              <input className="input input-bordered input-sm" value={docNumberField ? (formData as unknown as Record<string, unknown>)[docNumberField] as string ?? '' : ''} onChange={(e) => docNumberField && updateField(docNumberField, e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label label-text text-xs">{t('editor.documentDate')}</label>
              <input type="date" className="input input-bordered input-sm" value={docDateField ? (formData as unknown as Record<string, unknown>)[docDateField] as string ?? '' : ''} onChange={(e) => docDateField && updateField(docDateField, e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label label-text text-xs">{t('editor.supplierName')}</label>
              <input className="input input-bordered input-sm" value={formData.supplierName ?? ''} onChange={(e) => updateField('supplierName', e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label label-text text-xs">{t('editor.supplierBusinessId')}</label>
              <input className="input input-bordered input-sm" value={formData.supplierBusinessId ?? ''} onChange={(e) => updateField('supplierBusinessId', e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label label-text text-xs">{t('editor.customerName')}</label>
              <input className="input input-bordered input-sm" value={formData.customerName ?? ''} onChange={(e) => updateField('customerName', e.target.value)} />
            </div>
            {hasDeliveryAddress && (
              <div className="form-control">
                <label className="label label-text text-xs">{t('editor.deliveryAddress')}</label>
                <input className="input input-bordered input-sm" value={(formData as DeliveryNoteExtraction).deliveryAddress ?? ''} onChange={(e) => updateField('deliveryAddress', e.target.value)} />
              </div>
            )}
            {hasProjectName && (
              <div className="form-control col-span-2">
                <label className="label label-text text-xs">{t('editor.projectName')}</label>
                <input className="input input-bordered input-sm" value={(formData as DeliveryNoteExtraction).projectName ?? ''} onChange={(e) => updateField('projectName', e.target.value)} />
              </div>
            )}
            {hasPoReference && (
              <div className="form-control">
                <label className="label label-text text-xs">{t('editor.poReference')}</label>
                <input className="input input-bordered input-sm" value={(formData as unknown as Record<string, unknown>).poReference as string ?? ''} onChange={(e) => updateField('poReference', e.target.value)} />
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm">{t('editor.lineItems')} ({formData.lineItems.length})</h4>
              <button className="btn btn-ghost btn-xs gap-1" onClick={addLineItem}>
                <Plus size={12} /> {t('editor.addLineItem')}
              </button>
            </div>

            <div className="space-y-3">
              {formData.lineItems.map((item, idx) => (
                <div key={idx} className="border border-base-300 rounded-lg p-3 relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="badge badge-ghost badge-xs">#{item.lineNumber ?? idx + 1}</span>
                    <button
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => removeLineItem(idx)}
                      title={t('editor.removeLineItem')}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    <div className="form-control">
                      <label className="label label-text text-xs">{t('editor.lineNumber')}</label>
                      <input type="number" className="input input-bordered input-xs" value={item.lineNumber ?? ''} onChange={(e) => updateLineItem(idx, 'lineNumber', e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    <div className="col-span-2 form-control">
                      <label className="label label-text text-xs">{t('editor.description')}</label>
                      <input className="input input-bordered input-xs" value={item.description} onChange={(e) => updateLineItem(idx, 'description', e.target.value)} />
                    </div>
                    <div className="form-control">
                      <label className="label label-text text-xs">{t('editor.catalogNumber')}</label>
                      <input className="input input-bordered input-xs" value={item.catalogNumber ?? ''} onChange={(e) => updateLineItem(idx, 'catalogNumber', e.target.value)} />
                    </div>
                    <div className="form-control">
                      <label className="label label-text text-xs">{t('editor.quantity')}</label>
                      <input type="number" className="input input-bordered input-xs" value={item.quantity ?? ''} onChange={(e) => updateLineItem(idx, 'quantity', e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    <div className="form-control">
                      <label className="label label-text text-xs">{t('editor.unit')}</label>
                      <input className="input input-bordered input-xs" value={item.unit ?? ''} onChange={(e) => updateLineItem(idx, 'unit', e.target.value)} />
                    </div>
                    <div className="form-control">
                      <label className="label label-text text-xs">{t('editor.unitPrice')}</label>
                      <input type="number" step="0.01" className="input input-bordered input-xs" value={item.unitPrice ?? ''} onChange={(e) => updateLineItem(idx, 'unitPrice', e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    <div className="form-control">
                      <label className="label label-text text-xs">{t('editor.totalPrice')}</label>
                      <input type="number" step="0.01" className="input input-bordered input-xs" value={item.totalPrice ?? ''} onChange={(e) => updateLineItem(idx, 'totalPrice', e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    <div className="form-control">
                      <label className="label label-text text-xs">{t('editor.discountPercent')}</label>
                      <input type="number" step="0.01" className="input input-bordered input-xs" value={item.discountPercent ?? ''} onChange={(e) => updateLineItem(idx, 'discountPercent', e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    <div className="form-control">
                      <label className="label label-text text-xs">{t('editor.discountAmount')}</label>
                      <input type="number" step="0.01" className="input input-bordered input-xs" value={item.discountAmount ?? ''} onChange={(e) => updateLineItem(idx, 'discountAmount', e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    <div className="form-control">
                      <label className="label label-text text-xs">{t('editor.priceBeforeDiscount')}</label>
                      <input type="number" step="0.01" className="input input-bordered input-xs" value={item.priceBeforeDiscount ?? ''} onChange={(e) => updateLineItem(idx, 'priceBeforeDiscount', e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    {hasDeliveryNoteRefs && (
                      <div className="form-control col-span-2">
                        <label className="label label-text text-xs">{t('editor.deliveryNoteRef')}</label>
                        <input className="input input-bordered input-xs" value={item.deliveryNoteRef ?? ''} onChange={(e) => updateLineItem(idx, 'deliveryNoteRef', e.target.value || null)} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="mb-4">
            <h4 className="font-semibold text-sm mb-2">{t('editor.totals')}</h4>
            <div className="grid grid-cols-4 gap-3">
              <div className="form-control">
                <label className="label label-text text-xs">{t('editor.subtotal')}</label>
                <input type="number" step="0.01" className="input input-bordered input-sm" value={formData.subtotal ?? ''} onChange={(e) => updateField('subtotal', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="form-control">
                <label className="label label-text text-xs">{t('editor.vatRate')}</label>
                <input type="number" step="0.01" className="input input-bordered input-sm" value={formData.vatRate ?? ''} onChange={(e) => updateField('vatRate', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="form-control">
                <label className="label label-text text-xs">{t('editor.vatAmount')}</label>
                <input type="number" step="0.01" className="input input-bordered input-sm" value={formData.vatAmount ?? ''} onChange={(e) => updateField('vatAmount', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="form-control">
                <label className="label label-text text-xs">{t('editor.totalAmount')}</label>
                <input type="number" step="0.01" className="input input-bordered input-sm" value={formData.totalAmount ?? ''} onChange={(e) => updateField('totalAmount', e.target.value ? Number(e.target.value) : null)} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <h4 className="font-semibold text-sm mb-2">{t('editor.notes')}</h4>
            <textarea
              className="textarea textarea-bordered w-full min-h-[80px] text-sm"
              placeholder={t('editor.notesPlaceholder')}
              value={formData.notes ?? ''}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
