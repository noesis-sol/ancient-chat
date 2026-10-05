import { clerkSetup } from '@clerk/testing/cypress';
import { defineConfig } from 'cypress';

// End-to-end tests against the running app (`npm run e2e`, see README.md,
// "End-to-end tests"). They need a Clerk development instance, PostgreSQL and
// Pinecone Local, configured through .env like the app itself.
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    // Recorded in CI, where they are uploaded with the screenshots.
    video: Boolean(process.env.CI),
    async setupNodeEvents(on, config) {
      // Loads .env.local and .env, then fetches a Clerk testing token with
      // CLERK_SECRET_KEY so the specs get past Clerk's bot protection.
      const result = await clerkSetup({ config });
      // A +clerk_test address, which signs in with the fixed code 424242.
      result.env.E2E_CLERK_USER_EMAIL = process.env.E2E_CLERK_USER_EMAIL;
      return result;
    },
  },
});
