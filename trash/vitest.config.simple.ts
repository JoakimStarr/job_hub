import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: [
        'src/lib/auth-db.ts'
      ],
      exclude: [
        '**/node_modules/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/app/api/**'
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    },
    testTimeout: 10000,
    setupFiles: []
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
