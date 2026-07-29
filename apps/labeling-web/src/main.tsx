import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StoreProvider } from '@/stores/store-context';
import '@/i18n';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
);
