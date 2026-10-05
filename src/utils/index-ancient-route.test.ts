import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({
  getAuth: vi.fn(),
  currentUser: vi.fn()
}));

const indexes = vi.hoisted(() => ({ setIndexAncient: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => clerk);
vi.mock('@/data/indexes.service', () => ({
  IndexesService: class {
    setIndexAncient = indexes.setIndexAncient;
  }
}));

const { PATCH } = await import('@/app/api/indexes/[name]/ancient/route');
const { GET: getPrompt } = await import('@/app/api/prompt/route');

const patch = (body: string) =>
  PATCH(new NextRequest('http://localhost/api/indexes/ethics/ancient', { method: 'PATCH', body }), {
    params: Promise.resolve({ name: 'ethics' })
  });

const signedInAs = (emailAddress: string) => {
  clerk.getAuth.mockReturnValue({ userId: 'user_1' });
  clerk.currentUser.mockResolvedValue({ emailAddresses: [{ emailAddress }] });
};

beforeEach(() => {
  vi.clearAllMocks();
  signedInAs('michael@noesis.solutions');
  indexes.setIndexAncient.mockResolvedValue({});
});

describe('PATCH /api/indexes/[name]/ancient', () => {
  it('assigns the index to an ancient', async () => {
    const response = await patch(JSON.stringify({ ancient: 'plato' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(indexes.setIndexAncient).toHaveBeenCalledWith('ethics', 'plato');
  });

  it('unassigns the index with null', async () => {
    const response = await patch(JSON.stringify({ ancient: null }));

    expect(response.status).toBe(200);
    expect(indexes.setIndexAncient).toHaveBeenCalledWith('ethics', null);
  });

  it('rejects an unknown ancient or a bad body with 400', async () => {
    for (const body of [JSON.stringify({ ancient: 'zeno' }), JSON.stringify({}), 'not json']) {
      const response = await patch(body);
      expect(response.status).toBe(400);
    }
    expect(indexes.setIndexAncient).not.toHaveBeenCalled();
  });

  it('returns 404 for an index that does not exist', async () => {
    indexes.setIndexAncient.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: Prisma.prismaVersion.client
      })
    );

    const response = await patch(JSON.stringify({ ancient: 'plato' }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Index not found' });
  });

  it('is for admins only', async () => {
    signedInAs('someone@example.com');

    const response = await patch(JSON.stringify({ ancient: 'plato' }));

    expect(response.status).toBe(403);
    expect(indexes.setIndexAncient).not.toHaveBeenCalled();
  });
});

describe('GET /api/prompt ancient', () => {
  it('rejects a missing or unknown ancient with 400', async () => {
    for (const query of ['', '?ancient=zeno']) {
      const response = await getPrompt(new NextRequest(`http://localhost/api/prompt${query}`));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Unknown ancient' });
    }
  });
});
