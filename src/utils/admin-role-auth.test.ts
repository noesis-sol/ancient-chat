import { beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({
  auth: vi.fn(),
  getAuth: vi.fn(),
  currentUser: vi.fn()
}));

const navigation = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  })
}));

vi.mock('@clerk/nextjs/server', () => clerk);
vi.mock('next/navigation', () => navigation);

const { hasAdminRole } = await import('@/utils/admin-role');
const { isAdmin, redirectNonAdmin } = await import('@/utils/adminAuth');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('hasAdminRole', () => {
  it('accepts the admin role', () => {
    expect(hasAdminRole({ role: 'admin' })).toBe(true);
  });

  it.each([
    ['another role', { role: 'member' }],
    ['no role', {}],
    ['no metadata', undefined],
    ['null', null],
    ['a bare string', 'admin']
  ])('rejects %s', (_, metadata) => {
    expect(hasAdminRole(metadata)).toBe(false);
  });
});

describe('isAdmin', () => {
  it('rejects a signed-out user without loading a profile', async () => {
    await expect(isAdmin({ userId: null, sessionClaims: null })).resolves.toBe(false);
    expect(clerk.currentUser).not.toHaveBeenCalled();
  });

  it('accepts the admin role from the session claims without loading the user', async () => {
    await expect(isAdmin({ userId: 'user_1', sessionClaims: { metadata: { role: 'admin' } } })).resolves.toBe(true);
    expect(clerk.currentUser).not.toHaveBeenCalled();
  });

  it('rejects another role in the session claims without loading the user', async () => {
    clerk.currentUser.mockResolvedValue({ publicMetadata: { role: 'admin' } });

    await expect(isAdmin({ userId: 'user_1', sessionClaims: { metadata: {} } })).resolves.toBe(false);
    expect(clerk.currentUser).not.toHaveBeenCalled();
  });

  it('falls back to the public metadata when the session token has no metadata', async () => {
    clerk.currentUser.mockResolvedValue({ publicMetadata: { role: 'admin' } });

    await expect(isAdmin({ userId: 'user_1', sessionClaims: {} })).resolves.toBe(true);
  });

  it('rejects a user with no role in the public metadata', async () => {
    clerk.currentUser.mockResolvedValue({ publicMetadata: {} });

    await expect(isAdmin({ userId: 'user_1' })).resolves.toBe(false);
  });

  it('ignores email addresses, verified or not', async () => {
    clerk.currentUser.mockResolvedValue({
      publicMetadata: {},
      emailAddresses: [
        { emailAddress: 'michael@noesis.solutions', verification: { status: 'unverified' } },
        { emailAddress: 'adam@agr-series.com', verification: { status: 'verified' } }
      ]
    });

    await expect(isAdmin({ userId: 'user_1', sessionClaims: {} })).resolves.toBe(false);
  });
});

describe('redirectNonAdmin', () => {
  it('redirects a signed-out visitor home', async () => {
    clerk.auth.mockResolvedValue({ userId: null, sessionClaims: null });

    await expect(redirectNonAdmin()).rejects.toThrow('NEXT_REDIRECT /');
    expect(navigation.redirect).toHaveBeenCalledWith('/');
  });

  it('redirects a signed-in non-admin home', async () => {
    clerk.auth.mockResolvedValue({ userId: 'user_1', sessionClaims: { metadata: { role: 'member' } } });

    await expect(redirectNonAdmin()).rejects.toThrow('NEXT_REDIRECT /');
  });

  it('lets an admin through', async () => {
    clerk.auth.mockResolvedValue({ userId: 'user_1', sessionClaims: { metadata: { role: 'admin' } } });

    await expect(redirectNonAdmin()).resolves.toBeUndefined();
    expect(navigation.redirect).not.toHaveBeenCalled();
  });
});
