import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
    plugins: [
      tailwindcss(),
      react(),
      // Only include Sentry plugin in production builds with auth token
      ...(mode === 'production' && env.SENTRY_AUTH_TOKEN
        ? [
            sentryVitePlugin({
              org: 'Adarsh Jain',
              project: 'smb-react',
              authToken: env.SENTRY_AUTH_TOKEN,
              // Upload source maps to Sentry
              sourcemaps: {
                assets: './dist/**',
                filesToDeleteAfterUpload: ['./dist/**/*.map'],
              },
              // Clean up artifacts after upload
              telemetry: false,
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
