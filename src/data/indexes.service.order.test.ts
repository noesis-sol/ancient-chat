import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({ db: { index: { findMany: vi.fn() } } }));

vi.mock('@/lib/pinecone', () => ({ getPinecone: vi.fn(), deleteIndex: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));

import { IndexesService } from './indexes.service';

beforeEach(() => {
  vi.clearAllMocks();
  db.index.findMany.mockResolvedValue([]);
});

describe('IndexesService.getActiveIndexes order', () => {
  // allocateChunks gives a tied remainder to the earlier index, so the order
  // must not follow Postgres row order, which can change between requests.
  it('orders the active indexes by name', async () => {
    await new IndexesService().getActiveIndexes('plato');

    expect(db.index.findMany).toHaveBeenCalledWith({
      where: { is_active: true, ancient: 'plato' },
      orderBy: { name: 'asc' }
    });
  });
});
