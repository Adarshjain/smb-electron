import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  // Only enable Sentry plugin if all required env vars are present
  const enableSentryPlugin =
    mode === 'production' &&
    env.SENTRY_AUTH_TOKEN &&
    env.SENTRY_ORG &&
    env.SENTRY_PROJECT;

  return {
    base: './',
    plugins: [
      tailwindcss(),
      react(),
      // Only include Sentry plugin in production builds with proper config
      ...(enableSentryPlugin
        ? [
            sentryVitePlugin({
              org: env.SENTRY_ORG,
              project: env.SENTRY_PROJECT,
              authToken: env.SENTRY_AUTH_TOKEN,
              // Upload source maps to Sentry
              sourcemaps: {
                assets: './dist/**',
                filesToDeleteAfterUpload: ['./dist/**/*.map'],
              },
              // Clean up artifacts after upload
              telemetry: false,
              silent: false, // Set to true to suppress logs
            }),
          ]
        : []),
    ],
    build: {
      outDir: 'dist',
      sourcemap: true, // Generate source maps for better error tracking
    },
    server: {
      port: 6969,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    // Make env variables available to the app
    define: {
      'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(env.SENTRY_DSN),
      'import.meta.env.VITE_SENTRY_ENVIRONMENT': JSON.stringify(
        env.SENTRY_ENVIRONMENT || mode
      ),
    },
  };
});
