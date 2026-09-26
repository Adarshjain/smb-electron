import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { CompanyProvider } from './context/CompanyProvider.tsx';
import { ThanglishProvider } from '@/context/ThanglishProvider.tsx';
import { TabManager } from '@/TabManager.tsx';
import * as Sentry from '@sentry/react';

// Initialize Sentry for the renderer process.
// Kept light so it doesn't slow down startup: no always-on session replay,
// no profiling, and the replay integration is fetched lazily after first paint.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    dsn: import.meta.env.VITE_SENTRY_DSN,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,

    tracesSampleRate: 0.1,

    // Only record a replay when an error happens
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,

    debug: false,
  });

  const loadReplay = () => {
    void import('@/lib/sentryReplay.ts').then(({ replayIntegration }) =>
      Sentry.addIntegration(
        replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
          maskAllInputs: false,
        })
      )
    );
  };
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadReplay, { timeout: 5000 });
  } else {
    setTimeout(loadReplay, 3000);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CompanyProvider>
      <ThanglishProvider>
        <TabManager />
      </ThanglishProvider>
    </CompanyProvider>
  </StrictMode>
);
