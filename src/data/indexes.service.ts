import { IndexList, Pinecone } from '@pinecone-database/pinecone';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { Index } from '@prisma/client';
import { planIndexSync } from './index-sync';

// The sync in flight in this process, shared so concurrent admin loads run it once.
let syncInFlight: Promise<void> | null = null;

export class IndexesService {
  private _pinecone?: Pinecone;
  private prisma = prisma;

  // Created on first use: env() throws when PINECONE_API_KEY is unset,
  // which breaks `next build` for routes that instantiate this service at module scope.
  private get pinecone() {
    return (this._pinecone ??= new Pinecone({ apiKey: env().PINECONE_API_KEY }));
  }

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

  async updateIndex(name: string, data: Index) {
    return await this.prisma.index.update({
      where: {
        name
      },
      data,
    });
  }

  // Chat path: reads the DB only. The admin page keeps the rows in line with Pinecone.
  async getActiveIndexes() {
    return await this.prisma.index.findMany({
      where: {
        is_active: true
      }
    });
  }

  async toggleIndex(name: string, isActive: boolean) {
    return await this.prisma.index.update({
      where: {
        name
      },
      data: {
        is_active: isActive
      }
    });
  }

  async deleteIndex(name: string) {
    const index = await this.prisma.index.findUnique({
      where: {
        name
      }
    });

    if (!index) {
      throw new Error(`Index with id ${name} not found`);
    }

    await this.pinecone.deleteIndex(index.name);
    return await this.prisma.index.delete({
      where: {
        name
      }
    });
  }

  private syncDatabaseIndexes(): Promise<void> {
    syncInFlight ??= this.updateDatabaseIndexes().finally(() => {
      syncInFlight = null;
    });
    return syncInFlight;
  }

  private async updateDatabaseIndexes() {
    const { indexes }: IndexList = await this.pinecone.listIndexes();

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
