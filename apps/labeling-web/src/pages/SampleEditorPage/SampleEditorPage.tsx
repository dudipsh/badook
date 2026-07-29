import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '@/stores/store-context';
import Spinner from '@/components/Spinner';
import DocumentViewer from './components/DocumentViewer';
import EditorToolbar from './components/EditorToolbar';
import ExtractionForm from './components/ExtractionForm';
import type { ExtractionFormRef } from './components/ExtractionForm';
import toast from 'react-hot-toast';

const SampleEditorPage = observer(() => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { samplesStore } = useStores();
  const formRef = useRef<ExtractionFormRef>(null);

  useEffect(() => {
    if (!id) {
      navigate('/');
      return;
    }
    const load = async () => {
      try {
        await samplesStore.loadSample(id);
      } catch {
        toast.error(t('toast.loadError'));
        navigate('/');
      }
    };
    load();

    return () => {
      samplesStore.clearCurrentSample();
    };
  }, [id]);

  const handleSave = async () => {
    if (!formRef.current || !samplesStore.currentSample) return;
    const groundTruth = formRef.current.getFormData();
    await samplesStore.saveGroundTruth(samplesStore.currentSample.id, groundTruth);
  };

  const { currentSample, isLoading } = samplesStore;

  if (isLoading || !currentSample) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="p-2">
        <EditorToolbar sample={currentSample} onSave={handleSave} />
      </div>
      <div className="flex-1 flex gap-2 p-2 pt-0 min-h-0">
        <div className="w-1/2 min-h-0">
          <DocumentViewer sample={currentSample} />
        </div>
        <div className="w-1/2 bg-base-100 rounded-box shadow-sm overflow-y-auto min-h-0">
          <ExtractionForm ref={formRef} sample={currentSample} />
        </div>
      </div>
    </div>
  );
});

export default SampleEditorPage;
