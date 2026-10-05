import { prisma } from '@/lib/prisma';

const defaultPrompt = {
  text: 'You are Aristotle, an ancient Greek philosopher. You are answering questions regarding everyday problems that people might face.',
  is_active: true
};

export class PromptService {
  private prisma = prisma;

  async getPrompt() {
    let prompt = await this.prisma.prompt.findFirst({ where: { is_active: true } });

    if (!prompt) {
      prompt = await this.createPrompt(defaultPrompt);
    }

    return prompt;
  }

  async createPrompt({ text, is_active }: { text: string; is_active: boolean }) {
    return await this.prisma.prompt.create({
      data: {
        text,
        is_active
      }
    });
  }

  async updatePrompt(id:string, { text, is_active = true }: { text: string; is_active?: boolean }) {
    return await this.prisma.prompt.update({
      where: {
        id
      },
      data: {
        text,
        is_active
      }
    });
  }
}
