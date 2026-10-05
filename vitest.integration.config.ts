import { configDefaults, defineConfig } from 'vitest/config';
import unitConfig from './vitest.config';

// `npm run test:integration`: suites that run the app's code against Pinecone
// Local (see README.md, "Integration tests"). They skip when
// PINECONE_CONTROLLER_HOST is unset.

if (!process.env.PINECONE_CONTROLLER_HOST) {
  console.warn(
    'PINECONE_CONTROLLER_HOST is not set, so the Pinecone Local integration tests are skipped. ' +
      'Start Pinecone Local and set PINECONE_CONTROLLER_HOST=http://localhost:5080 (README.md, "Integration tests").'
  );
}

export default defineConfig({
  ...unitConfig,
  test: {
    ...unitConfig.test,
    include: ['src/**/*.integration.test.ts'],
    exclude: configDefaults.exclude,
    // Creating an index on Pinecone Local and waiting for it takes seconds.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
