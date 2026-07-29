import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useStores } from '@/stores/store-context';
import Button from '@/components/Button';
import StatsBar from './components/StatsBar';
import FilterBar from './components/FilterBar';
import SampleTable from './components/SampleTable';
import UploadModal from './components/UploadModal';
import toast from 'react-hot-toast';

const SampleListPage = observer(() => {
  const { t } = useTranslation();
  const { samplesStore } = useStores();
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        await Promise.all([samplesStore.loadSamples(), samplesStore.loadStats()]);
      } catch {
        toast.error(t('toast.loadError'));
      }
    };
    load();
  }, []);

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('pages.sampleList')}</h1>
        <Button variant="primary" onClick={() => setIsUploadOpen(true)}>
          <Plus className="w-4 h-4" />
          {t('buttons.upload')}
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <StatsBar />
        <div className="bg-base-100 rounded-box shadow-sm p-4">
          <FilterBar />
        </div>
        <div className="bg-base-100 rounded-box shadow-sm">
          <SampleTable />
        </div>
      </div>

      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
    </div>
  );
});

export default SampleListPage;
