import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.hoisted(() => vi.fn());

// clerkMiddleware becomes the bare handler, so a test can pass its own auth.
vi.mock('@clerk/nextjs/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clerk/nextjs/server')>()),
  clerkMiddleware: (handler: unknown) => handler,
  clerkClient: async () => ({ users: { getUser } })
}));

const { default: proxy, config } = (await import('@/proxy')) as unknown as {
  default: (auth: unknown, req: NextRequest) => Promise<Response | undefined>;
  config: { matcher: string[] };
};

type Claims = CustomJwtSessionClaims | null;

const fakeAuth = (userId: string | null, sessionClaims: Claims = null) => {
  const protect = vi.fn();
  const redirectToSignIn = vi.fn(() => new Response(null, { status: 307, headers: { location: '/sign-in' } }));
  const auth = Object.assign(async () => ({ userId, sessionClaims, redirectToSignIn }), { protect });
  return { auth, protect, redirectToSignIn };
};

const signedOut = () => fakeAuth(null);
const signedInAs = (role: string) => fakeAuth('user_1', { metadata: { role } });

const run = (auth: unknown, path: string) => proxy(auth, new NextRequest(new URL(path, 'http://localhost')));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('proxy matcher', () => {
  it.each(['/', '/chat', '/chat/plato', '/admin', '/admin/prompt', '/admin/x.y', '/chat/a.b', '/admin.json'])(
    'runs for the page %s',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    }
  );

  it.each(['/api/chat', '/api/prompt', '/api/prompt/42', '/api/indexes/a.b/toggle', '/api/indexes/upload'])(
    'runs for the API route %s',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    }
  );

  it.each(['/_next/static/chunks/main.js', '/favicon.ico', '/images/logo.png', '/fonts/lemon.woff2', '/styles.css'])(
    'skips the static file %s',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    }
  );
});

describe('/chat', () => {
  it('protects /chat routes', async () => {
    const { auth, protect } = signedOut();

    await run(auth, '/chat/plato');

    expect(protect).toHaveBeenCalledOnce();
  });

  it('leaves the home page public', async () => {
    const { auth, protect } = signedOut();

    await expect(run(auth, '/')).resolves.toBeUndefined();
    expect(protect).not.toHaveBeenCalled();
  });
});

describe('admin pages', () => {
  it.each(['/admin', '/admin/prompt', '/admin/x.y'])('send a signed-out visitor of %s to sign in', async (path) => {
    const { auth, redirectToSignIn } = signedOut();

    const response = await run(auth, path);

    expect(redirectToSignIn).toHaveBeenCalledOnce();
    expect(response?.status).toBe(307);
  });

  it.each(['/admin', '/admin/prompt'])('send a non-admin on %s to the home page', async (path) => {
    const response = await run(signedInAs('member').auth, path);

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe('http://localhost/');
  });

  it('let an admin through', async () => {
    await expect(run(signedInAs('admin').auth, '/admin/prompt')).resolves.toBeUndefined();
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe('admin APIs', () => {
  const adminApis = ['/api/indexes', '/api/indexes/a.b/toggle', '/api/indexes/upload', '/api/prompt', '/api/prompt/42'];

  it.each(adminApis)('answer 401 to a signed-out caller of %s', async (path) => {
    const response = await run(signedOut().auth, path);

    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it.each(adminApis)('answer 403 to a non-admin caller of %s', async (path) => {
    const response = await run(signedInAs('member').auth, path);

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('let an admin through', async () => {
    await expect(run(signedInAs('admin').auth, '/api/prompt/42')).resolves.toBeUndefined();
  });

  it('leave the chat API to its own handler', async () => {
    await expect(run(signedOut().auth, '/api/chat')).resolves.toBeUndefined();
  });
});

describe('a session token without the metadata claim', () => {
  it('falls back to the public metadata from the Backend API', async () => {
    getUser.mockResolvedValue({ publicMetadata: { role: 'admin' } });

    await expect(run(fakeAuth('user_1', {}).auth, '/api/indexes')).resolves.toBeUndefined();
    expect(getUser).toHaveBeenCalledWith('user_1');
  });

  it('rejects a user whose public metadata has no admin role', async () => {
    getUser.mockResolvedValue({ publicMetadata: {} });

    const response = await run(fakeAuth('user_1', {}).auth, '/admin');

    expect(response?.headers.get('location')).toBe('http://localhost/');
  });
});
