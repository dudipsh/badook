import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: './src',
    include: ['**/__tests__/**/*.test.ts'],
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
