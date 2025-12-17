import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,
    // Use jsdom for DOM simulation
    environment: 'jsdom',
    // Setup file for React Testing Library
    setupFiles: ['./src/test/setup.ts'],
    // Include test files
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Exclude files
    exclude: ['node_modules', 'dist', 'dist-electron'],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'dist-electron/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/',
      ],
    },
    // Reporter for test output
    reporters: ['default'],
    // CSS handling
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
