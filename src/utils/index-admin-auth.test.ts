import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({
  getAuth: vi.fn(),
  currentUser: vi.fn()
}));

const indexes = vi.hoisted(() => ({
  deleteIndex: vi.fn(),
  updateIndex: vi.fn(),
  toggleIndex: vi.fn()
}));

const pinecone = vi.hoisted(() => ({
  getPinecone: vi.fn(),
  listIndexes: vi.fn()
}));

vi.mock('@clerk/nextjs/server', () => clerk);

vi.mock('@/data/indexes.service', () => ({
  IndexesService: class {
    deleteIndex = indexes.deleteIndex;
    updateIndex = indexes.updateIndex;
    toggleIndex = indexes.toggleIndex;
  }
}));

vi.mock('@/lib/env', () => ({ env: () => ({ PINECONE_API_KEY: 'test-key' }) }));

vi.mock('@/lib/pinecone', () => ({ getPinecone: pinecone.getPinecone }));

const { withAdmin } = await import('@/utils/adminAuth');
const { GET } = await import('@/app/api/indexes/route');
const { DELETE, PUT } = await import('@/app/api/indexes/[name]/route');
const { PATCH } = await import('@/app/api/indexes/[name]/toggle/route');
const { POST } = await import('@/app/api/indexes/upload/route');

const signedOut = () => {
  clerk.getAuth.mockReturnValue({ userId: null });
  clerk.currentUser.mockResolvedValue(null);
};

const signedInAs = (emailAddress: string) => {
  clerk.getAuth.mockReturnValue({ userId: 'user_1' });
  clerk.currentUser.mockResolvedValue({ emailAddresses: [{ emailAddress }] });
};

const nameParams = () => ({ params: Promise.resolve({ name: 'plato' }) });

const jsonRequest = (url: string, method: string, body: unknown) =>
  new NextRequest(url, { method, body: JSON.stringify(body) });

// A form with a path but no file: an admin gets past the guard and hits the 400 for the missing file.
const uploadRequest = () => {
  const form = new FormData();
  form.append('path', 'plato/republic.txt');
  return new NextRequest('http://localhost/api/indexes/upload', { method: 'POST', body: form });
};

type Route = {
  name: string;
  call: () => Promise<Response>;
  // Whatever the handler would touch; none of it may run for a rejected request.
  effects: () => ReturnType<typeof vi.fn>[];
  admin: (response: Response) => Promise<void>;
};

const routes: Route[] = [
  {
    name: 'GET /api/indexes',
    call: () => GET(new NextRequest('http://localhost/api/indexes')),
    effects: () => [pinecone.getPinecone, pinecone.listIndexes],
    admin: async (response) => {
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ indexes: [{ name: 'plato' }] });
    }
  },
  {
    name: 'DELETE /api/indexes/[name]',
    call: () => DELETE(new NextRequest('http://localhost/api/indexes/plato', { method: 'DELETE' }), nameParams()),
    effects: () => [indexes.deleteIndex],
    admin: async (response) => {
      expect(response.status).toBe(200);
      expect(indexes.deleteIndex).toHaveBeenCalledWith('plato');
    }
  },
  {
    name: 'PUT /api/indexes/[name]',
    call: () =>
      PUT(jsonRequest('http://localhost/api/indexes/plato', 'PUT', { weight: 0.5 }), nameParams()),
    effects: () => [indexes.updateIndex],
    admin: async (response) => {
      expect(response.status).toBe(200);
      expect(indexes.updateIndex).toHaveBeenCalledWith('plato', { weight: 0.5 });
    }
  },
  {
    name: 'PATCH /api/indexes/[name]/toggle',
    call: () =>
      PATCH(jsonRequest('http://localhost/api/indexes/plato/toggle', 'PATCH', { isActive: true }), nameParams()),
    effects: () => [indexes.toggleIndex],
    admin: async (response) => {
      expect(response.status).toBe(200);
      expect(indexes.toggleIndex).toHaveBeenCalledWith('plato', true);
    }
  },
  {
    name: 'POST /api/indexes/upload',
    call: () => POST(uploadRequest()),
    effects: () => [pinecone.getPinecone, pinecone.listIndexes],
    admin: async (response) => {
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'NO_FILE' });
    }
  }
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  pinecone.getPinecone.mockReturnValue({ listIndexes: pinecone.listIndexes });
  pinecone.listIndexes.mockResolvedValue({ indexes: [{ name: 'plato' }] });
});

describe.each(routes)('$name', ({ call, effects, admin }) => {
  it('returns 401 when signed out', async () => {
    signedOut();

    const response = await call();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    for (const effect of effects()) expect(effect).not.toHaveBeenCalled();
  });

  it('returns 403 for a signed-in non-admin', async () => {
    signedInAs('someone@example.com');

    const response = await call();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    for (const effect of effects()) expect(effect).not.toHaveBeenCalled();
  });

  it('runs the handler for an admin', async () => {
    signedInAs('michael@noesis.solutions');

    await admin(await call());
  });
});

describe('withAdmin', () => {
  it('passes the request and the route context through to the handler', async () => {
    signedInAs('michael@noesis.solutions');
    const handler = vi.fn<(request: NextRequest, context: ReturnType<typeof nameParams>) => Promise<Response>>(
      async () => new Response('ok')
    );
    const request = new NextRequest('http://localhost/api/indexes/plato');
    const context = nameParams();

    const response = await withAdmin(handler)(request, context);

    expect(handler).toHaveBeenCalledWith(request, context);
    expect(await response.text()).toBe('ok');
  });

  it('does not call the handler for a non-admin', async () => {
    signedInAs('someone@example.com');
    const handler = vi.fn(async () => new Response('ok'));

    const response = await withAdmin(handler)(new NextRequest('http://localhost/api/indexes'));

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});
