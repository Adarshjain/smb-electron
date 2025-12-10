import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { CompanyProvider } from './context/CompanyProvider.tsx';
import { ThanglishProvider } from '@/context/ThanglishProvider.tsx';
import { TabManager } from '@/TabManager.tsx';
import * as Sentry from '@sentry/react';

// Initialize Sentry for the renderer process
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    dsn: import.meta.env.VITE_SENTRY_DSN,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,

    // Performance Monitoring
    integrations: [
      // Session Replay - captures user sessions for debugging
      Sentry.replayIntegration({
        maskAllText: false, // Mask all text to protect PII
        blockAllMedia: false, // Block all media (images, videos) to protect PII
        maskAllInputs: false, // Mask all input fields
      }),
      // Additional integrations
      Sentry.browserProfilingIntegration(),
    ],

    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production (0.1 = 10%)
    tracesSampleRate: 1,

    // Set `tracePropagationTargets` to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: [/./],

    // Capture Replay for 10% of all sessions,
    // plus 100% of sessions with an error
    replaysSessionSampleRate: 1.0,
    replaysOnErrorSampleRate: 1.0,

    // Additional configuration
    beforeSend(event) {
      // Filter out errors if needed
      // You can modify or drop events here
      return event;
    },

    // Enable debug mode in development
    debug: true,
  });
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
