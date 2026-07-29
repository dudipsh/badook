import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useStores } from '../../lib/store-context';
import { ChatScopePeriod } from '../../stores/chat.store';
import { Project, projectsService } from '../../services/projects.service';
import { Supplier, suppliersService } from '../../services/suppliers.service';
import { ScopeCombobox } from './ScopeCombobox';

const PERIODS: ChatScopePeriod[] = ['all', 'thisMonth', 'last3Months', 'thisYear'];
const PERIOD_KEY: Record<ChatScopePeriod, string> = {
  all: 'scope.periodAll',
  thisMonth: 'scope.thisMonth',
  last3Months: 'scope.last3Months',
  thisYear: 'scope.thisYear',
};

export const ChatScopeBar = observer(() => {
  const { chatStore } = useStores();
  const { t } = useTranslation('chat');
  const [projects, setProjects] = useState<Project[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    void projectsService.getAll().then(setProjects).catch(() => {});
    void suppliersService.getAll().then(setSuppliers).catch(() => {});
  }, []);

  return (
    <div className="w-full max-w-[920px] mx-auto flex flex-wrap items-center gap-2 mb-2 px-1">
      <ScopeCombobox
        options={projects}
        value={chatStore.scopeProjectId}
        placeholder={t('scope.allProjects')}
        onChange={(id) => chatStore.setScopeProject(id)}
      />
      <ScopeCombobox
        options={suppliers}
        value={chatStore.scopeSupplierId}
        placeholder={t('scope.allSuppliers')}
        onChange={(id) => chatStore.setScopeSupplier(id)}
      />
      <select
        className="select select-bordered select-xs h-7 min-h-0 rounded-full bg-base-100/80 text-[12px] font-medium"
        value={chatStore.scopePeriod}
        onChange={(e) => chatStore.setScopePeriod(e.target.value as ChatScopePeriod)}
      >
        {PERIODS.map((p) => (
          <option key={p} value={p}>
            {t(PERIOD_KEY[p])}
          </option>
        ))}
      </select>
      {chatStore.hasScope && (
        <button
          onClick={() => chatStore.clearScope()}
          className="btn btn-ghost btn-xs rounded-full text-base-content/50 gap-1"
        >
          <X className="w-3 h-3" />
          {t('scope.clear')}
        </button>
      )}
    </div>
  );
});
