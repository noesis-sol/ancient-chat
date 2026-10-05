import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7's CLI no longer loads .env itself. Load it here, without
// overriding variables already set in the environment.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Not env('DATABASE_URL'), which throws when it is unset: `prisma generate`
    // (run on install, including in CI) needs no database. Commands that do
    // connect fail with a clear error when it is missing.
    url: process.env.DATABASE_URL,
    // Optional. Only `prisma migrate diff --from-migrations` needs it; migrate
    // dev creates and drops its own shadow database.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
