import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listIndexes, db } = vi.hoisted(() => {
  const db = {
    index: {
      findMany: vi.fn(),
      deleteMany: vi.fn((args: unknown) => ({ op: 'deleteMany', args })),
      updateMany: vi.fn((args: unknown) => ({ op: 'updateMany', args })),
      createMany: vi.fn((args: unknown) => ({ op: 'createMany', args })),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    $transaction: vi.fn(async (ops: unknown[]) => ops)
  };
  return { listIndexes: vi.fn(), db };
});

vi.mock('@/lib/pinecone', () => ({ getPinecone: () => ({ listIndexes }) }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));

import { IndexesService } from './indexes.service';

const activeRow = { id: 'host-a', name: 'a', is_active: true, weight: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  db.index.findMany.mockResolvedValue([activeRow]);
  listIndexes.mockResolvedValue({ indexes: [{ name: 'a', host: 'host-a' }] });
});

describe('IndexesService.getActiveIndexes', () => {
  it("reads the ancient's active rows from the DB only: no Pinecone call and no writes", async () => {
    const rows = await new IndexesService().getActiveIndexes('aristotle');

    expect(rows).toEqual([activeRow]);
    expect(db.index.findMany).toHaveBeenCalledWith({ where: { is_active: true, ancient: 'aristotle' } });
    expect(listIndexes).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('IndexesService.getIndexes', () => {
  it('syncs new Pinecone indexes with idempotent writes', async () => {
    listIndexes.mockResolvedValue({
      indexes: [
        { name: 'a', host: 'host-a2' },
        { name: 'b', host: 'host-b' }
      ]
    });

    await new IndexesService().getIndexes();

    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(db.index.updateMany).toHaveBeenCalledWith({
      where: { id: 'host-a' },
      data: { id: 'host-a2', name: 'a' }
    });
    expect(db.index.createMany).toHaveBeenCalledWith({
      data: [{ id: 'host-b', name: 'b', is_active: false, weight: 1 }],
      skipDuplicates: true
    });
  });

  it('writes nothing when the DB already matches Pinecone', async () => {
    await new IndexesService().getIndexes();

    expect(listIndexes).toHaveBeenCalledOnce();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('returns the DB rows when the Pinecone call fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    listIndexes.mockRejectedValue(new Error('control plane down'));

    await expect(new IndexesService().getIndexes()).resolves.toEqual([activeRow]);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('shares one sync between concurrent calls', async () => {
    let release!: () => void;
    listIndexes.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve({ indexes: [{ name: 'a', host: 'host-a' }] });
      })
    );

    const loads = [new IndexesService().getIndexes(), new IndexesService().getIndexes()];
    release();
    await Promise.all(loads);

    expect(listIndexes).toHaveBeenCalledOnce();

    await new IndexesService().getIndexes();
    expect(listIndexes).toHaveBeenCalledTimes(2);
  });
});
