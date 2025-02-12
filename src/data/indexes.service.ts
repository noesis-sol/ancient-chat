import { IndexList, Pinecone } from '@pinecone-database/pinecone';
import { Index, PrismaClient } from '@prisma/client';

export class IndexesService {
  private pinecone = new Pinecone();
  private prisma = new PrismaClient();

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

  async deleteIndex(id: string) {
    const index = await this.prisma.index.findUnique({
      where: {
        id: id
      }
    });

    if (!index) {
      throw new Error(`Index with id ${id} not found`);
    }

    await this.pinecone.deleteIndex(index.name);
    return await this.prisma.index.delete({
      where: {
        id: id
      }
    });
  }

  private async updateDatabaseIndexes() {
    const { indexes }: IndexList = await this.pinecone.listIndexes();

    if (!indexes) {
      return [];
    }

    const pineconeIndexes = indexes.map((index) => ({
      id: index.host,
      name: index.name,
      is_active: false,
      weight: 0
    }));

    try {
      // Get existing indexes from database
      const existingIndexes = await this.prisma.index.findMany();
      const existingIndexIds = new Set(existingIndexes.map((index) => index.id));
      const pineconeIndexIds = new Set(pineconeIndexes.map((index) => index.id));

      // Prepare operations
      const createOperations = pineconeIndexes
        .filter((index) => !existingIndexIds.has(index.id))
        .map((index) => this.prisma.index.create({ data: index }));

      const updateOperations = pineconeIndexes
        .filter((index) => existingIndexIds.has(index.id))
        .map((index) =>
          this.prisma.index.update({
            where: { id: index.id },
            data: {
              name: index.name
            }
          })
        );

      // Delete indexes that don't exist in Pinecone
      const deleteOperations = existingIndexes
        .filter((index) => !pineconeIndexIds.has(index.id))
        .map((index) =>
          this.prisma.index.delete({
            where: { id: index.id }
          })
        );

      // Execute all operations in a transaction
      await this.prisma.$transaction([...createOperations, ...updateOperations, ...deleteOperations]);

      // Log the sync results
      console.log(`Synced Pinecone indexes:
      Created: ${createOperations.length}
      Updated: ${updateOperations.length}
      Deleted: ${deleteOperations.length}
    `);
    } catch (error) {
      console.error('Error updating database indexes:', error);
      throw error;
    }
  }
}
