import { createContext, useContext, type ReactNode } from 'react';
import { RootStore } from '../stores/root.store';

const StoreContext = createContext<RootStore | null>(null);
const rootStore = new RootStore();

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  return <StoreContext.Provider value={rootStore}>{children}</StoreContext.Provider>;
}

export function useStores() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStores must be used within StoreProvider');
  return store;
}
