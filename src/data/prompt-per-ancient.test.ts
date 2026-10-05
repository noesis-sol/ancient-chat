import { PrismaClient } from '@/generated/prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { findAncient } from './ancients';
import { NotFoundError } from './not-found';
import { PromptService } from './prompt.service';

const plato = findAncient('plato')!;

function fakePrisma() {
  const db = {
    prompt: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(async ({ data }: { data: object }) => ({ id: 'new', ...data })),
      update: vi.fn(async () => ({ id: 'p' })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return { db, service: new PromptService(db as unknown as PrismaClient) };
}

describe('PromptService per ancient', () => {
  it("reads the ancient's own active prompt", async () => {
    const { db, service } = fakePrisma();
    db.prompt.findFirst.mockResolvedValue({ id: 'p', ancient: 'plato', text: 'You are Plato.' });

    await expect(service.getPrompt(plato)).resolves.toMatchObject({ id: 'p' });
    expect(db.prompt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ancient: 'plato', is_active: true } })
    );
  });

  it('creates a default prompt that names the ancient', async () => {
    const { db, service } = fakePrisma();
    db.prompt.findFirst.mockResolvedValue(null);

    await service.getPrompt(plato);
    expect(db.prompt.create).toHaveBeenCalledWith({
      data: { ancient: 'plato', text: expect.stringMatching(/^You are Plato,/), is_active: true },
    });
  });

  it("deactivates only the same ancient's prompts when activating one", async () => {
    const { db, service } = fakePrisma();
    db.prompt.findUnique.mockResolvedValue({ ancient: 'plato' });

    await service.updatePrompt('p', { text: 'You are Plato.' });
    expect(db.prompt.findUnique).toHaveBeenCalledWith({ where: { id: 'p' }, select: { ancient: true } });
    expect(db.prompt.updateMany).toHaveBeenCalledWith({
      where: { ancient: 'plato', is_active: true, id: { not: 'p' } },
      data: { is_active: false },
    });
  });

  it('throws a NotFoundError when updating a prompt that does not exist', async () => {
    const { db, service } = fakePrisma();
    db.prompt.findUnique.mockResolvedValue(null);

    await expect(service.updatePrompt('missing', { text: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.updatePrompt('missing', { text: 'x', is_active: false })).rejects.toBeInstanceOf(NotFoundError);
    expect(db.prompt.update).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
