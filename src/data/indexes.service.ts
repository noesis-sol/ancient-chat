import { IndexList } from '@pinecone-database/pinecone';
import { getPinecone } from '@/lib/pinecone';
import { prisma } from '@/lib/prisma';
import type { Index } from '@/generated/prisma/client';
import { planIndexSync } from './index-sync';
import { NotFoundError, orNotFound } from './not-found';

// The sync in flight in this process, shared so concurrent admin loads run it once.
let syncInFlight: Promise<void> | null = null;

export class IndexesService {
  private prisma = prisma;

  // Admin view: syncs with Pinecone first so it shows Pinecone's current indexes.
  // A failed sync is logged and the rows already in the DB are returned.
  async getIndexes() {
    try {
      await this.syncDatabaseIndexes();
    } catch (error) {
      console.error('Error updating database indexes:', error);
    }

    return await this.prisma.index.findMany();
  }

  async getIndexById(id: string) {
    return await this.prisma.index.findUnique({
      where: {
        id: id
      }
    });
  }

  async createIndex(data: Index) {
    return await this.prisma.index.create({
      data: data
    });
  }

  // Only the weight is editable; id and name follow Pinecone through the sync.
  async updateIndex(name: string, { weight }: { weight: number }) {
    return await orNotFound(
      () =>
        this.prisma.index.update({
          where: {
            name
          },
          data: { weight },
        }),
      `Index "${name}" not found`
    );
  }

  // Chat path: reads the DB only. The admin page keeps the rows in line with Pinecone.
  async getActiveIndexes(ancient: string) {
    return await this.prisma.index.findMany({
      where: {
        is_active: true,
        ancient
      }
    });
  }

  // Assigns the index to an ancient's chat, or to none with null.
  async setIndexAncient(name: string, ancient: string | null) {
    return await this.prisma.index.update({
      where: {
        name
      },
      data: {
        ancient
      }
    });
  }

  async toggleIndex(name: string, isActive: boolean) {
    return await orNotFound(
      () =>
        this.prisma.index.update({
          where: {
            name
          },
          data: {
            is_active: isActive
          }
        }),
      `Index "${name}" not found`
    );
  }

  async deleteIndex(name: string) {
    const index = await this.prisma.index.findUnique({
      where: {
        name
      }
    });

    if (!index) {
      throw new NotFoundError(`Index "${name}" not found`);
    }

    await getPinecone().deleteIndex(index.name);
    return await orNotFound(
      () =>
        this.prisma.index.delete({
          where: {
            name
          }
        }),
      `Index "${name}" not found`
    );
  }

  private syncDatabaseIndexes(): Promise<void> {
    syncInFlight ??= this.updateDatabaseIndexes().finally(() => {
      syncInFlight = null;
    });
    return syncInFlight;
  }

  private async updateDatabaseIndexes() {
    const { indexes }: IndexList = await getPinecone().listIndexes();

    if (!indexes) {
      return;
    }

    const existingIndexes = await this.prisma.index.findMany();
    const { deletes, updates, creates } = planIndexSync(existingIndexes, indexes);

    if (deletes.length === 0 && updates.length === 0 && creates.length === 0) {
      return;
    }

    // Deletes first, then updates, then creates: a recreated or renamed index reuses
    // a name or host that a stale row may still hold. $transaction runs them in order.
    // Each step is idempotent, so a sync racing another process's (e.g. another
    // server instance) skips what that one already applied instead of failing.
    await this.prisma.$transaction([
      this.prisma.index.deleteMany({ where: { id: { in: deletes } } }),
      ...updates.map(({ id, data }) => this.prisma.index.updateMany({ where: { id }, data })),
      this.prisma.index.createMany({ data: creates, skipDuplicates: true })
    ]);
  }
}
