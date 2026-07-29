import { useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStores } from '../../../lib/store-context';
import { ViewModeSegment } from './ViewModeSegment';

interface ToolbarSearchInputProps {
  isExpanded: boolean;
  onToggle: (expanded: boolean) => void;
  children?: React.ReactNode;
}

export const ToolbarSearchInput = observer(({ isExpanded, onToggle, children }: ToolbarSearchInputProps) => {
  const { t } = useTranslation('projects');
  const { projectDashboardStore } = useStores();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isExpanded]);

  return (
    <div className="flex flex-col justify-center h-10 w-full relative z-10">
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div
            key="search-active"
            initial={{ opacity: 0, width: '0%' }}
            animate={{ opacity: 1, width: '100%' }}
            exit={{ opacity: 0, width: '0%' }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex items-center w-full absolute inset-y-0 start-0 z-20 bg-base-100"
          >
            <div className="relative w-full">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60 z-10 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                className="input input-sm w-full bg-base-100 border border-base-300 focus:bg-base-100 focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/20 rtl:pr-9 ltr:pl-9 rtl:pl-9 ltr:pr-9 transition-all font-medium text-sm rtl:text-right ltr:text-left"
                placeholder={t('toolbar.searchPlaceholder')}
                value={projectDashboardStore.docSearch}
                onChange={(e) => projectDashboardStore.setDocSearch(e.target.value)}
                dir="auto"
              />
              <button
                className="absolute end-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 opacity-50 hover:opacity-100 transition-opacity"
                onClick={() => { onToggle(false); projectDashboardStore.setDocSearch(''); }}
              >
                <X className="w-4 h-4 text-base-content/70" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="search-inactive"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between w-full h-full"
          >
            <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide">
              <button
                className="btn btn-sm w-9 h-9 rounded-[10px] bg-base-100 border border-base-300 shadow-sm hover:border-base-400 hover:bg-base-200 text-base-content/70 mr-1 rtl:mr-0 flex items-center justify-center transition-all cursor-pointer shrink-0"
                onClick={() => onToggle(true)}
                title={t('toolbar.search')}
              >
                <Search className="w-[15px] h-[15px]" />
              </button>
              <ViewModeSegment />
            </div>
            <div className="flex items-center ms-auto shrink-0 pe-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
