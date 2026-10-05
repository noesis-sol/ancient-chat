import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as sharedPrisma } from '@/lib/prisma';
import { orNotFound } from './not-found';

const defaultPrompt = {
  text: 'You are Aristotle, an ancient Greek philosopher. You are answering questions regarding everyday problems that people might face.',
  is_active: true
};

// The partial unique index "Prompt_single_active_key" allows at most one active
// prompt, so a second active row fails with a unique constraint violation.
const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export class PromptService {
  constructor(private prisma: Pick<PrismaClient, 'prompt' | '$transaction'> = sharedPrisma) {}

  async getPrompt() {
    const prompt = await this.findActivePrompt();
    if (prompt) {
      return prompt;
    }

    try {
      return await this.createPrompt(defaultPrompt);
    } catch (error) {
      // A concurrent first request created the default before us; use theirs.
      if (isUniqueConstraintError(error)) {
        const created = await this.findActivePrompt();
        if (created) {
          return created;
        }
      }
      throw error;
    }
  }

  async createPrompt({ text, is_active }: { text: string; is_active: boolean }) {
    return await this.prisma.prompt.create({
      data: {
        text,
        is_active
      }
    });
  }

  // An unknown id throws a NotFoundError; the transaction then leaves the others active.
  async updatePrompt(id:string, { text, is_active = true }: { text: string; is_active?: boolean }) {
    const data = { text, is_active };
    if (!is_active) {
      return await orNotFound(() => this.prisma.prompt.update({ where: { id }, data }), `Prompt "${id}" not found`);
    }

    // Deactivate the others first: the unique index is checked per statement.
    const [, prompt] = await orNotFound(
      () =>
        this.prisma.$transaction([
          this.prisma.prompt.updateMany({
            where: { is_active: true, id: { not: id } },
            data: { is_active: false }
          }),
          this.prisma.prompt.update({ where: { id }, data })
        ]),
      `Prompt "${id}" not found`
    );
    return prompt;
  }

  private findActivePrompt() {
    return this.prisma.prompt.findFirst({
      where: { is_active: true },
      orderBy: { updatedAt: 'desc' }
    });
  }
}
