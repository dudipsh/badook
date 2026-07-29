import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Save, CheckCircle, RefreshCw } from 'lucide-react';
import { useStores } from '@/stores/store-context';
import { StatusBadge } from '@/components/Badge';
import type { DocumentType, Sample } from '@/types/sample.types';
import Button from '@/components/Button';
import toast from 'react-hot-toast';
import { useEffect } from 'react';

interface EditorToolbarProps {
  sample: Sample;
  onSave: () => Promise<void>;
}

const EditorToolbar = observer(({ sample, onSave }: EditorToolbarProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { samplesStore } = useStores();

  useEffect(() => {
    if (samplesStore.models.length === 0) {
      samplesStore.loadModels();
    }
  }, [samplesStore]);

  const handleBack = () => {
    navigate('/');
  };

  const handleSave = async () => {
    try {
      await onSave();
      toast.success(t('toast.saveSuccess'));
    } catch {
      toast.error(t('toast.saveError'));
    }
  };

  const handleVerify = async () => {
    try {
      await samplesStore.verifySample(sample.id);
      toast.success(t('toast.verifySuccess'));
    } catch {
      toast.error(t('toast.verifyError'));
    }
  };

  const handleExtract = async () => {
    try {
      await samplesStore.reExtractSample(sample.id);
      toast.success(t('toast.reExtractSuccess'));
    } catch {
      toast.error(t('toast.reExtractError'));
    }
  };

  const isExtracting = samplesStore.isReExtracting || samplesStore.isExtractingFinetuned;

  return (
    <div className="flex items-center justify-between bg-base-100 rounded-box shadow-sm p-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={handleBack} className="btn-sm">
          <ArrowRight className="w-4 h-4" />
          {t('buttons.back')}
        </Button>
        <div className="divider divider-horizontal mx-0" />
        <span className="font-medium text-sm truncate max-w-[300px]" title={sample.originalFileName}>
          {sample.originalFileName}
        </span>
        <select
          className="select select-bordered select-sm"
          value={sample.documentType}
          onChange={async (e) => {
            try {
              await samplesStore.updateDocumentType(sample.id, e.target.value as DocumentType);
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
        <StatusBadge status={sample.status} />
      </div>

      <div className="flex items-center gap-2">
        <select
          className="select select-bordered select-sm"
          value={samplesStore.selectedModelId}
          onChange={(e) => samplesStore.setSelectedModel(e.target.value)}
        >
          {samplesStore.models.map((model) => (
            <option key={model.id} value={model.id} disabled={!model.available}>
              {model.name}{!model.available ? ' (לא מוגדר)' : ''}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          className="btn-sm"
          onClick={handleExtract}
          isLoading={isExtracting}
        >
          <RefreshCw className="w-4 h-4" />
          {isExtracting ? t('buttons.extracting') : t('buttons.reExtract')}
        </Button>
        <Button
          variant="primary"
          className="btn-sm"
          onClick={handleSave}
          isLoading={samplesStore.isSaving}
        >
          <Save className="w-4 h-4" />
          {samplesStore.isSaving ? t('buttons.saving') : t('buttons.save')}
        </Button>
        <Button
          variant="secondary"
          className="btn-sm"
          onClick={handleVerify}
          isLoading={samplesStore.isVerifying}
          disabled={sample.status !== 'LABELED'}
        >
          <CheckCircle className="w-4 h-4" />
          {samplesStore.isVerifying ? t('buttons.verifying') : t('buttons.verify')}
        </Button>
      </div>
    </div>
  );
});

export default EditorToolbar;
