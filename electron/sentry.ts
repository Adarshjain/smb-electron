// Sentry for the main process, loaded lazily.
//
// Requiring @sentry/electron/main costs ~300ms (much more on a cold Windows
// start), so it's loaded after the window is up instead of before it.
// Errors captured before then are queued and sent once it's ready.

import type * as SentryMainModule from '@sentry/electron/main';

type SentryMain = typeof SentryMainModule;
type CaptureContext = Parameters<SentryMain['captureException']>[1];

let sentry: SentryMain | null = null;
let pending: [unknown, CaptureContext][] = [];

export async function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('⚠️ Sentry DSN not found. Error tracking disabled.');
    pending = [];
    return;
  }

  const Sentry = await import('@sentry/electron/main');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment:
      process.env.SENTRY_ENVIRONMENT ??
      (process.env.VITE_DEV_SERVER_URL ? 'development' : 'production'),

    tracesSampleRate: 0.1,

    // The default mode also registers a custom protocol, which Electron only
    // allows before 'ready'. That protocol is only used by
    // @sentry/electron/renderer; our renderer uses @sentry/react directly.
    ipcMode: Sentry.IPCMode.Classic,

    beforeSend(event, hint) {
      // Log errors in development
      if (process.env.VITE_DEV_SERVER_URL) {
        console.error(
          'Sentry Error:',
          hint.originalException ?? hint.syntheticException
        );
      }
      return event;
    },

    initialScope: {
      tags: {
        'electron.process': 'main',
      },
    },
  });
  sentry = Sentry;

  for (const [error, context] of pending) {
    Sentry.captureException(error, context);
  }
  pending = [];

  console.log('✅ Sentry initialized for main process');
}

export function captureException(error: unknown, context?: CaptureContext) {
  if (sentry) {
    sentry.captureException(error, context);
  } else if (process.env.SENTRY_DSN) {
    pending.push([error, context]);
  }
}
