import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { X, Merge, Loader2, AlertTriangle, MapPin, Pencil } from 'lucide-react';
import { useStores } from '../../../lib/store-context';
import { projectsService } from '../../../services/projects.service';

interface Props {
  currentProjectId: string;
  currentProjectName: string;
  onMerge: (targetProjectId: string, addressesToInclude: string[]) => Promise<void>;
  onClose: () => void;
}

export const MergeProjectModal = observer(({ currentProjectId, currentProjectName, onMerge, onClose }: Props) => {
  const { t } = useTranslation('projects');
  const { projectsStore } = useStores();
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [step, setStep] = useState<'select' | 'addresses' | 'confirm'>('select');
  const [merging, setMerging] = useState(false);

  // Addresses from current (source) project
  const [sourceAddresses, setSourceAddresses] = useState<{ original: string; edited: string; selected: boolean }[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  const otherProjects = projectsStore.projects.filter((p) => p.id !== currentProjectId && !p.isArchived);
  const targetProject = otherProjects.find((p) => p.id === selectedTargetId);

  const loadAddresses = async () => {
    setLoadingAddresses(true);
    try {
      const addresses = await projectsService.getMergeAddresses(currentProjectId);
      setSourceAddresses(addresses.map((addr) => ({ original: addr, edited: addr, selected: true })));
    } catch {
      setSourceAddresses([]);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleNextToAddresses = () => {
    loadAddresses();
    setStep('addresses');
  };

  const toggleAddress = (index: number) => {
    setSourceAddresses((prev) =>
      prev.map((a, i) => (i === index ? { ...a, selected: !a.selected } : a)),
    );
  };

  const editAddress = (index: number, value: string) => {
    setSourceAddresses((prev) =>
      prev.map((a, i) => (i === index ? { ...a, edited: value } : a)),
    );
  };

  const selectedAddresses = sourceAddresses.filter((a) => a.selected).map((a) => a.edited.trim()).filter(Boolean);

  const handleMerge = async () => {
    if (!selectedTargetId) return;
    setMerging(true);
    try {
      await onMerge(selectedTargetId, selectedAddresses);
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-base-100 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-base-300">
          <div>
            <h2 className="text-lg font-bold text-base-content">{t('merge.title')}</h2>
            <p className="text-sm text-base-content/50 mt-0.5">
              {t('merge.subtitle', { projectName: currentProjectName })}
            </p>
          </div>
          <button onClick={onClose} className="text-base-content/40 hover:text-base-content/60 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {step === 'select' && (
            <>
              {/* Target project selection */}
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  {t('merge.targetLabel')}
                </label>
                <select
                  value={selectedTargetId}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  className="w-full border border-base-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-secondary/30 focus:border-secondary/50"
                >
                  <option value="">{t('merge.selectTarget')}</option>
                  {otherProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({(p._count?.deliveryNotes ?? 0) + (p._count?.purchaseOrders ?? 0) + (p._count?.invoices ?? 0)} {t('merge.documents')})
                    </option>
                  ))}
                </select>
              </div>

              {targetProject && (
                <div className="bg-base-200 rounded-lg p-4 text-sm space-y-1">
                  <p className="text-base-content">
                    <span className="font-medium">{t('merge.targetProject')}</span> {targetProject.name}
                  </p>
                  <p className="text-base-content/50">
                    {(targetProject._count?.deliveryNotes ?? 0)} {t('merge.deliveryNotes')}, {' '}
                    {(targetProject._count?.purchaseOrders ?? 0)} {t('merge.purchaseOrders')}, {' '}
                    {(targetProject._count?.invoices ?? 0)} {t('merge.invoices')}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-base-content/60 hover:text-base-content transition-colors">
                  {t('common:cancel')}
                </button>
                <button
                  onClick={handleNextToAddresses}
                  disabled={!selectedTargetId}
                  className="btn btn-sm btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Merge size={16} />
                  {t('common:continue')}
                </button>
              </div>
            </>
          )}

          {step === 'addresses' && (
            <>
              {/* Address selection */}
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  {t('merge.saveAddresses')}
                </label>
                <p className="text-xs text-base-content/40 mb-3">
                  {t('merge.addressesHelp', { projectName: targetProject?.name })}
                </p>

                {loadingAddresses ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-base-content/40" />
                  </div>
                ) : sourceAddresses.length === 0 ? (
                  <div className="text-center py-6 text-base-content/40 text-sm">
                    {t('merge.noAddresses', { projectName: currentProjectName })}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {sourceAddresses.map((addr, index) => (
                      <div
                        key={index}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                          addr.selected ? 'border-secondary/50 bg-secondary/10' : 'border-base-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={addr.selected}
                          onChange={() => toggleAddress(index)}
                          className="w-4 h-4 mt-1 rounded border-base-300 text-secondary focus:ring-secondary cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          {addr.selected ? (
                            <div className="flex items-center gap-2">
                              <MapPin size={14} className="text-base-content/40 flex-shrink-0" />
                              <input
                                type="text"
                                value={addr.edited}
                                onChange={(e) => editAddress(index, e.target.value)}
                                className="flex-1 text-sm text-base-content bg-transparent border-b border-dashed border-base-300 focus:border-secondary/50 focus:outline-none py-0.5"
                              />
                              <Pencil size={12} className="text-base-content/30 flex-shrink-0" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <MapPin size={14} className="text-base-content/30 flex-shrink-0" />
                              <span className="text-sm text-base-content/40 line-through">{addr.edited}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setStep('select')} className="px-4 py-2 text-sm text-base-content/60 hover:text-base-content transition-colors">
                  {t('common:back')}
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  className="btn btn-sm btn-primary inline-flex items-center gap-2"
                >
                  {t('common:continue')}
                </button>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              {/* Confirmation */}
              <div className="flex items-start gap-3 bg-warning/10 border border-warning/30 rounded-lg p-4">
                <AlertTriangle size={20} className="text-warning flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-warning mb-1">{t('merge.irreversibleWarning')}</p>
                  <p className="text-warning">
                    {t('merge.confirmMessage', { sourceName: currentProjectName, targetName: targetProject?.name })}
                    {' '}
                    {selectedAddresses.length > 0
                      ? t('merge.addressesWillBeAdded', { count: selectedAddresses.length })
                      : t('merge.noAddressesWillBeAdded')
                    }
                    {' '}{t('merge.projectWillBeDeleted', { projectName: currentProjectName })}
                  </p>
                </div>
              </div>

              {selectedAddresses.length > 0 && (
                <div className="bg-base-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-base-content/50 mb-2">{t('merge.addressesAddedTo', { projectName: targetProject?.name })}</p>
                  <div className="space-y-1">
                    {selectedAddresses.map((addr) => (
                      <div key={addr} className="flex items-center gap-2 text-sm text-base-content/60">
                        <MapPin size={12} className="text-base-content/40" />
                        {addr}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setStep('addresses')} className="px-4 py-2 text-sm text-base-content/60 hover:text-base-content transition-colors">
                  {t('common:back')}
                </button>
                <button
                  onClick={handleMerge}
                  disabled={merging}
                  className="btn btn-error btn-sm gap-2"
                >
                  {merging ? <Loader2 size={16} className="animate-spin" /> : <Merge size={16} />}
                  {merging ? t('merge.merging') : t('merge.confirmMerge')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
