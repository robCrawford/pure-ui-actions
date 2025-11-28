import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'pure-ui-actions': path.resolve(__dirname, '../../src/pure-ui-actions.ts')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.spec.ts'],
  },
});

