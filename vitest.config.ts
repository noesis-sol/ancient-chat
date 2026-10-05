import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // tsconfig keeps JSX for Next ("preserve"); component tests need it compiled.
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Integration suites need Pinecone Local; vitest.integration.config.ts runs them.
    exclude: [...configDefaults.exclude, 'src/**/*.integration.test.ts'],
    environment: 'node',
  },
});
