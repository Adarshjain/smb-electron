import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { CompanyProvider } from './context/CompanyProvider.tsx';
import { ThanglishProvider } from '@/context/ThanglishProvider.tsx';
import { TabManager } from '@/TabManager.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CompanyProvider>
      <ThanglishProvider>
        <TabManager />
      </ThanglishProvider>
    </CompanyProvider>
  </StrictMode>
);
