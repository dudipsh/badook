import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '@/stores/store-context';
import { Search } from 'lucide-react';
import type { SampleStatus, DocumentType } from '@/types/sample.types';

const statuses: SampleStatus[] = ['PENDING', 'AUTO_EXTRACTED', 'LABELED', 'VERIFIED'];
const documentTypes: DocumentType[] = ['DELIVERY_NOTE', 'INVOICE', 'PURCHASE_ORDER'];

const FilterBar = observer(() => {
  const { t } = useTranslation();
  const { samplesStore } = useStores();

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    samplesStore.setStatusFilter(value ? (value as SampleStatus) : undefined);
    samplesStore.loadSamples();
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    samplesStore.setDocumentTypeFilter(value ? (value as DocumentType) : undefined);
    samplesStore.loadSamples();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    samplesStore.setSearchQuery(e.target.value);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      samplesStore.loadSamples();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        className="select select-bordered select-sm"
        value={samplesStore.statusFilter ?? ''}
        onChange={handleStatusChange}
      >
        <option value="">{t('filters.allStatuses')}</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}`)}
          </option>
        ))}
      </select>

      <select
        className="select select-bordered select-sm"
        value={samplesStore.documentTypeFilter ?? ''}
        onChange={handleTypeChange}
      >
        <option value="">{t('filters.allTypes')}</option>
        {documentTypes.map((dt) => (
          <option key={dt} value={dt}>
            {t(`documentType.${dt}`)}
          </option>
        ))}
      </select>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/50" />
        <input
          type="text"
          className="input input-bordered input-sm w-full pr-10"
          placeholder={t('filters.search')}
          value={samplesStore.searchQuery}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
        />
      </div>
    </div>
  );
});

export default FilterBar;
