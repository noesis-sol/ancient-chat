import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PromptService } from './prompt.service';

const prompt = (id: string, is_active = true) => ({
  id,
  text: `prompt ${id}`,
  is_active,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: Prisma.prismaVersion.client,
  });

function fakePrisma() {
  const db = {
    prompt: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(async () => prompt('a')),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return { db, service: new PromptService(db as unknown as PrismaClient) };
}

describe('PromptService.getPrompt', () => {
  it('returns the most recently updated active prompt', async () => {
    const { db, service } = fakePrisma();
    db.prompt.findFirst.mockResolvedValue(prompt('a'));

    await expect(service.getPrompt()).resolves.toMatchObject({ id: 'a' });
    expect(db.prompt.findFirst).toHaveBeenCalledWith({
      where: { is_active: true },
      orderBy: { updatedAt: 'desc' },
    });
    expect(db.prompt.create).not.toHaveBeenCalled();
  });

  it('creates the default prompt when none is active', async () => {
    const { db, service } = fakePrisma();
    db.prompt.findFirst.mockResolvedValue(null);
    db.prompt.create.mockResolvedValue(prompt('default'));

    await expect(service.getPrompt()).resolves.toMatchObject({ id: 'default' });
    expect(db.prompt.create).toHaveBeenCalledWith({
      data: { text: expect.stringContaining('Aristotle'), is_active: true },
    });
  });

  it('returns the default a concurrent request created first', async () => {
    const { db, service } = fakePrisma();
    db.prompt.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(prompt('theirs'));
    db.prompt.create.mockRejectedValue(uniqueViolation());

    await expect(service.getPrompt()).resolves.toMatchObject({ id: 'theirs' });
    expect(db.prompt.create).toHaveBeenCalledTimes(1);
  });

  it('rethrows other errors', async () => {
    const { db, service } = fakePrisma();
    db.prompt.findFirst.mockResolvedValue(null);
    db.prompt.create.mockRejectedValue(new Error('connection refused'));

    await expect(service.getPrompt()).rejects.toThrow('connection refused');
  });
});

describe('PromptService.updatePrompt', () => {
  it('deactivates the other prompts in the same transaction, before activating', async () => {
    const { db, service } = fakePrisma();

    await expect(service.updatePrompt('a', { text: 'new' })).resolves.toMatchObject({ id: 'a' });
    expect(db.prompt.updateMany).toHaveBeenCalledWith({
      where: { is_active: true, id: { not: 'a' } },
      data: { is_active: false },
    });
    expect(db.prompt.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { text: 'new', is_active: true },
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    // A batch transaction runs its operations in array order.
    const [deactivate, activate] = db.$transaction.mock.calls[0][0];
    expect(deactivate).toBe(db.prompt.updateMany.mock.results[0].value);
    expect(activate).toBe(db.prompt.update.mock.results[0].value);
  });

  it('leaves the other prompts alone when deactivating', async () => {
    const { db, service } = fakePrisma();

    await service.updatePrompt('a', { text: 'new', is_active: false });
    expect(db.prompt.updateMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
