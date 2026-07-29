import { createContext, useContext, type ReactNode } from 'react';
import SamplesStore from './samples.store';

class RootStore {
  samplesStore: SamplesStore;

  constructor() {
    this.samplesStore = new SamplesStore();
  }
}

const rootStore = new RootStore();
const StoreContext = createContext<RootStore>(rootStore);

interface StoreProviderProps {
  children: ReactNode;
}

export const StoreProvider = ({ children }: StoreProviderProps) => {
  return <StoreContext.Provider value={rootStore}>{children}</StoreContext.Provider>;
};

export const useStores = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStores must be used within a StoreProvider');
  }
  return context;
};

export { RootStore };
