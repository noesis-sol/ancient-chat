import { Prisma, PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, pinecone } = vi.hoisted(() => ({
  db: {
    index: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  },
  pinecone: { deleteIndex: vi.fn() }
}));

vi.mock('@/lib/pinecone', () => ({ getPinecone: () => pinecone }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));

import { IndexesService } from './indexes.service';
import { NotFoundError, orNotFound } from './not-found';
import { PromptService } from './prompt.service';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('Record to update not found.', {
    code,
    clientVersion: Prisma.prismaVersion.client
  });

const row = { id: 'host-plato', name: 'plato', is_active: true, weight: 1 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('orNotFound', () => {
  it('passes the result through', async () => {
    await expect(orNotFound(async () => 'ok', 'missing')).resolves.toBe('ok');
  });

  it('turns P2025 into a NotFoundError with the message', async () => {
    const result = orNotFound(() => Promise.reject(prismaError('P2025')), 'Index "plato" not found');

    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    await expect(result).rejects.toThrow('Index "plato" not found');
  });

  it('rethrows other errors unchanged', async () => {
    const error = prismaError('P2002');

    await expect(orNotFound(() => Promise.reject(error), 'missing')).rejects.toBe(error);
  });
});

describe('IndexesService', () => {
  it('updateIndex writes only the weight', async () => {
    db.index.update.mockResolvedValue({ ...row, weight: 0.5 });

    await new IndexesService().updateIndex('plato', { weight: 0.5 });

    expect(db.index.update).toHaveBeenCalledWith({ where: { name: 'plato' }, data: { weight: 0.5 } });
  });

  it('updateIndex throws a NotFoundError for an unknown name', async () => {
    db.index.update.mockRejectedValue(prismaError('P2025'));

    await expect(new IndexesService().updateIndex('plato', { weight: 0.5 })).rejects.toThrow(
      new NotFoundError('Index "plato" not found')
    );
  });

  it('toggleIndex throws a NotFoundError for an unknown name', async () => {
    db.index.update.mockRejectedValue(prismaError('P2025'));

    await expect(new IndexesService().toggleIndex('plato', true)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deleteIndex throws a NotFoundError without touching Pinecone for an unknown name', async () => {
    db.index.findUnique.mockResolvedValue(null);

    await expect(new IndexesService().deleteIndex('plato')).rejects.toBeInstanceOf(NotFoundError);
    expect(pinecone.deleteIndex).not.toHaveBeenCalled();
  });

  it('deleteIndex throws a NotFoundError when the row goes away after the Pinecone delete', async () => {
    db.index.findUnique.mockResolvedValue(row);
    db.index.delete.mockRejectedValue(prismaError('P2025'));

    await expect(new IndexesService().deleteIndex('plato')).rejects.toBeInstanceOf(NotFoundError);
    expect(pinecone.deleteIndex).toHaveBeenCalledWith('plato');
  });
});

describe('PromptService.updatePrompt', () => {
  const fakePrisma = () => {
    const prompt = {
      // The row is found when looked up, then gone by the time it is written.
      findUnique: vi.fn(async () => ({ ancient: 'aristotle' })),
      update: vi.fn(() => Promise.reject(prismaError('P2025'))),
      updateMany: vi.fn(async () => ({ count: 1 }))
    };
    const $transaction = vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops));
    return new PromptService({ prompt, $transaction } as unknown as PrismaClient);
  };

  it('throws a NotFoundError for an unknown id', async () => {
    await expect(fakePrisma().updatePrompt('missing', { text: 'Hi' })).rejects.toThrow(
      new NotFoundError('Prompt "missing" not found')
    );
  });

  it('throws a NotFoundError for an unknown id when deactivating', async () => {
    await expect(fakePrisma().updatePrompt('missing', { text: 'Hi', is_active: false })).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
