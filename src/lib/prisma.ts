import { PrismaClient } from '@prisma/client';

// Reuse a single client (and connection pool) per process; cache it on globalThis
// in development so HMR reloads don't open a new pool each time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
