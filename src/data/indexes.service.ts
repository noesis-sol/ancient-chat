import { IndexList, Pinecone } from '@pinecone-database/pinecone';
import { Index, PrismaClient } from '@prisma/client';

export class IndexesService {
  private pinecone = new Pinecone();
  private prisma = new PrismaClient();

  async getIndexes() {
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

  async updateIndex(id: string, data: Index) {
    return await this.prisma.index.upsert({
      where: {
        id: id
      },
      update: data,
      create: data
    });
  }

  async getActiveIndexes() {
    let { indexes }: IndexList = await this.pinecone.listIndexes();

    indexes?.forEach(async (index) => {
      const { name, host } = index;
      await this.prisma.index.upsert({
        where: {
          id: index.host
        },
        update: {
          id: index.host,
          name: index.name
        },
        create: {
          id: index.host,
          weight: 0,
          name: name,
          is_active: false
        }
      });
    });

    return await this.prisma.index.findMany({
      where: {
        is_active: true
      }
    });
  }

  async activateIndex(id: string) {
    return await this.prisma.index.update({
      where: {
        id: id
      },
      data: {
        is_active: true
      }
    });
  }

  async deleteIndex(id: string) {
    return await this.prisma.index.delete({
      where: {
        id: id
      }
    });
  }
}
