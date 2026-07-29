import { useState, useEffect } from 'react';
import { ArrowLeft, AlertCircle, Link2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../../lib/store-context';
import { apiClient } from '../../../services/api-client';
import toast from 'react-hot-toast';

export interface TriageDoc {
  id: string;
  supplierName: string;
  originalFileUrl?: string | null;
  docType: string;
}

interface OrphanTriagePanelProps {
  doc: TriageDoc;
  onBack: () => void;
  onAssigned: () => void;
}

export const OrphanTriagePanel = ({ doc, onBack, onAssigned }: OrphanTriagePanelProps) => {
  const { projectsStore } = useStores();
  const { t } = useTranslation('projects');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedVendorName, setSelectedVendorName] = useState(doc.supplierName || '');
  const [assigning, setAssigning] = useState(false);

  const projects = projectsStore.projects;

  const [projectVendors, setProjectVendors] = useState<string[]>([]);
  const [allVendors, setAllVendors] = useState<string[]>([]);

  useEffect(() => {
    apiClient.get<{ name: string }[]>('/suppliers').then((r) => {
      setAllVendors(r.data.map((s) => s.name));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      apiClient.get(`/projects/${selectedProjectId}/vendors`).then((r) => {
        setProjectVendors((r.data as { supplierName: string }[]).map((v) => v.supplierName));
      }).catch(() => {});
    }
  }, [selectedProjectId]);

  const handleAssign = async () => {
    if (!selectedProjectId) {
      toast.error(t('triage.mustSelectProjectError'));
      return;
    }
    setAssigning(true);
    try {
      await apiClient.post(`/projects/${selectedProjectId}/link-documents`, {
        deliveryNoteIds: doc.docType === 'deliveryNotes' ? [doc.id] : [],
        purchaseOrderIds: doc.docType === 'purchaseOrders' ? [doc.id] : [],
        invoiceIds: doc.docType === 'invoices' ? [doc.id] : [],
      });
      toast.success(t('triage.assignSuccess'));
      onAssigned();
    } catch {
      toast.error(t('triage.assignError'));
    } finally {
      setAssigning(false);
    }
  };

  const fileUrl = doc.originalFileUrl
    ? `${apiClient.defaults.baseURL}/files/view/${encodeURIComponent(doc.originalFileUrl)}`
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b border-base-300">
        <button onClick={onBack} className="text-base-content/50 hover:text-base-content p-1">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-error" />
          <h3 className="font-semibold text-base-content">{t('triage.manualAssign')}</h3>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 border-l border-base-300 bg-base-200">
          {fileUrl ? (
            <iframe src={fileUrl} className="w-full h-full" title="Document preview" />
          ) : (
            <div className="flex items-center justify-center h-full text-base-content/40 text-sm">
              {t('triage.noPreview')}
            </div>
          )}
        </div>

        <div className="w-1/2 p-6 overflow-y-auto space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1.5">
              <span className="text-error">*</span> {t('triage.project')}
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full border border-base-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              required
            >
              <option value="">{t('triage.selectProject')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-xs text-base-content/40 mt-1">{t('triage.mustSelectProject')}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">{t('triage.vendor')}</label>
            <select
              value={selectedVendorName}
              onChange={(e) => setSelectedVendorName(e.target.value)}
              className="w-full border border-base-300 rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="">{t('triage.selectVendor')}</option>
              {selectedProjectId && projectVendors.length > 0 && (
                <optgroup label={t('triage.projectVendors')}>
                  {projectVendors.map((v) => (
                    <option key={`proj-${v}`} value={v}>{v}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label={selectedProjectId ? t('triage.allVendors') : t('triage.vendors')}>
                {allVendors
                  .filter((v) => !projectVendors.includes(v))
                  .map((v) => (
                    <option key={`all-${v}`} value={v}>{v}</option>
                  ))}
              </optgroup>
            </select>
          </div>

          <div className="bg-base-200 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-base-content/50">{t('triage.identifiedVendor')}</span>
              <span className="text-base-content">{doc.supplierName || t('triage.notIdentified')}</span>
            </div>
          </div>

          <button
            onClick={handleAssign}
            disabled={!selectedProjectId || assigning}
            className="btn btn-primary w-full"
          >
            {assigning ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Link2 size={16} />
            )}
            {t('triage.assignToProject')}
          </button>
        </div>
      </div>
    </div>
  );
}
