import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
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
            // zod and @hookform/resolvers are left out on purpose: only lazily
            // loaded screens use them, so they shouldn't be in the startup chunk.
            'form-vendor': ['react-hook-form'],
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
    esbuild: {
      drop: isProduction ? ['console', 'debugger'] : [],
      keepNames: !isProduction,
    },
  };
});
