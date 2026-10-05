import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { prisma as sharedPrisma } from '@/lib/prisma';
import { orNotFound, NotFoundError } from './not-found';
import { Ancient } from '@/data/ancients';

const defaultPromptText = (ancient: Ancient) =>
  `You are ${ancient.name}, an ancient Greek philosopher. You are answering questions regarding everyday problems that people might face.`;

// The partial unique index "Prompt_single_active_per_ancient_key" allows at most
// one active prompt per ancient, so a second one fails with a unique constraint
// violation.
const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export class PromptService {
  constructor(private prisma: Pick<PrismaClient, 'prompt' | '$transaction'> = sharedPrisma) {}

  // The ancient's active prompt, created from a default the first time.
  async getPrompt(ancient: Ancient) {
    const prompt = await this.findActivePrompt(ancient.slug);
    if (prompt) {
      return prompt;
    }

    try {
      return await this.createPrompt({ ancient: ancient.slug, text: defaultPromptText(ancient), is_active: true });
    } catch (error) {
      // A concurrent first request created the default before us; use theirs.
      if (isUniqueConstraintError(error)) {
        const created = await this.findActivePrompt(ancient.slug);
        if (created) {
          return created;
        }
      }
      throw error;
    }
  }

  async createPrompt({ ancient, text, is_active }: { ancient: string; text: string; is_active: boolean }) {
    return await this.prisma.prompt.create({
      data: {
        ancient,
        text,
        is_active
      }
    });
  }

  // An unknown id throws a NotFoundError; the transaction then leaves the others active.
  async updatePrompt(id:string, { text, is_active = true }: { text: string; is_active?: boolean }) {
    const existing = await this.prisma.prompt.findUnique({ where: { id }, select: { ancient: true } });
    if (!existing) {
      throw new NotFoundError(`Prompt "${id}" not found`);
    }

    const data = { text, is_active };
    if (!is_active) {
      return await orNotFound(() => this.prisma.prompt.update({ where: { id }, data }), `Prompt "${id}" not found`);
    }

    // Deactivate the ancient's other prompts first: the unique index is checked per statement.
    const [, prompt] = await orNotFound(
      () =>
        this.prisma.$transaction([
          this.prisma.prompt.updateMany({
            where: { ancient: existing.ancient, is_active: true, id: { not: id } },
            data: { is_active: false }
          }),
          this.prisma.prompt.update({ where: { id }, data })
        ]),
      `Prompt "${id}" not found`
    );
    return prompt;
  }

  private findActivePrompt(ancient: string) {
    return this.prisma.prompt.findFirst({
      where: { ancient, is_active: true },
      orderBy: { updatedAt: 'desc' }
    });
  }
}
