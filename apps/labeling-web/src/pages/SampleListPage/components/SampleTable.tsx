import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '@/stores/store-context';
import SampleRow from './SampleRow';
import Spinner from '@/components/Spinner';
import { ChevronRight, ChevronLeft } from 'lucide-react';

const SampleTable = observer(() => {
  const { t } = useTranslation();
  const { samplesStore } = useStores();
  const { samples, isLoading, page, totalPages } = samplesStore;

  const handlePrevPage = () => {
    if (page > 1) {
      samplesStore.setPage(page - 1);
      samplesStore.loadSamples();
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      samplesStore.setPage(page + 1);
      samplesStore.loadSamples();
    }
  };

  if (isLoading) {
    return <Spinner />;
  }

  if (samples.length === 0) {
    return (
      <div className="text-center py-12 text-base-content/50">
        {t('table.noSamples')}
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>{t('table.fileName')}</th>
              <th>{t('table.type')}</th>
              <th>{t('table.status')}</th>
              <th className="text-center">{t('table.confidence')}</th>
              <th>{t('table.date')}</th>
              <th>{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((sample) => (
              <SampleRow key={sample.id} sample={sample} />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button className="btn btn-sm btn-ghost" onClick={handlePrevPage} disabled={page <= 1}>
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm">
            {t('table.page')} {page} {t('table.of')} {totalPages}
          </span>
          <button className="btn btn-sm btn-ghost" onClick={handleNextPage} disabled={page >= totalPages}>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
});

export default SampleTable;
