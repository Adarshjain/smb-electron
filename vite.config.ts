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

  const isProduction = mode === 'production';

  return {
    base: './',
    plugins: [
      tailwindcss(),
      react({
        // Enable React Compiler for automatic memoization (experimental)
        babel: {
          plugins: isProduction ? [] : [],
        },
      }),
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
      chunkSizeWarningLimit: 1000,
      minify: isProduction ? 'esbuild' : false,
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
            'radix-vendor': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-popover',
              '@radix-ui/react-select',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-tabs',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-label',
              '@radix-ui/react-separator',
              '@radix-ui/react-alert-dialog',
            ],
            utils: ['clsx', 'tailwind-merge', 'class-variance-authority'],
            router: ['react-router-dom'],
            virtual: ['@tanstack/react-virtual'],
          },
          chunkFileNames: isProduction
            ? 'assets/[name]-[hash].js'
            : 'assets/[name].js',
          entryFileNames: isProduction
            ? 'assets/[name]-[hash].js'
            : 'assets/[name].js',
          assetFileNames: isProduction
            ? 'assets/[name]-[hash].[ext]'
            : 'assets/[name].[ext]',
        },
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
        },
      },
      cssCodeSplit: true,
      cssMinify: isProduction,
      reportCompressedSize: false,
    },
    server: {
      port: 6969,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    // Dependency optimization
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'react-hook-form',
        '@hookform/resolvers/zod',
        'zod',
        '@tanstack/react-virtual',
        'clsx',
        'tailwind-merge',
        'class-variance-authority',
        'lucide-react',
        'sonner',
      ],
      force: false,
    },
    define: {
      'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(env.SENTRY_DSN),
      'import.meta.env.VITE_SENTRY_ENVIRONMENT': JSON.stringify(
        env.SENTRY_ENVIRONMENT || mode
      ),
    },
    esbuild: {
      drop: isProduction ? ['console', 'debugger'] : [],
      keepNames: !isProduction,
    },
  };
});
