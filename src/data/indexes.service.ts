import { IndexList, Pinecone } from '@pinecone-database/pinecone';
import { prisma } from '@/lib/prisma';
import { Index } from '@prisma/client';
import { planIndexSync } from './index-sync';

export class IndexesService {
  private pinecone = new Pinecone();
  private prisma = prisma;

  async getIndexes() {
    await this.updateDatabaseIndexes();

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

  async getActiveIndexes() {
    await this.updateDatabaseIndexes();

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

  private async updateDatabaseIndexes() {
    const { indexes }: IndexList = await this.pinecone.listIndexes();

    if (!indexes) {
      return [];
    }

    try {
      const existingIndexes = await this.prisma.index.findMany();
      const { deletes, updates, creates } = planIndexSync(existingIndexes, indexes);

      // Deletes first, then updates, then creates: a recreated or renamed index reuses
      // a name or host that a stale row may still hold. $transaction runs them in order.
      await this.prisma.$transaction([
        ...deletes.map((id) => this.prisma.index.delete({ where: { id } })),
        ...updates.map(({ id, data }) => this.prisma.index.update({ where: { id }, data })),
        ...creates.map((data) => this.prisma.index.create({ data }))
      ]);
    } catch (error) {
      console.error('Error updating database indexes:', error);
      throw error;
    }
  }
}
