import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from '@/lib/env';

// Reuse a single client (and connection pool) per process; cache it on globalThis
// in development so HMR reloads don't open a new pool each time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  // The adapter opens its pg pool on the first query, which is when this getter
  // runs. Reading env() at module scope would throw during `next build`, which
  // imports this module with DATABASE_URL unset.
  const adapter = new PrismaPg({
    get connectionString() {
      return env().DATABASE_URL;
    },
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
