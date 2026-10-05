import { isValidElement } from 'react';
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

const getIndexes = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => clerk);
vi.mock('next/navigation', () => navigation);
vi.mock('@/utils/fonts', () => ({ lemonMilkFont: { className: 'lemon-milk' } }));
vi.mock('@/data/indexes.service', () => ({
  IndexesService: class {
    getIndexes = getIndexes;
  }
}));
vi.mock('@/components/accordion', () => ({ default: () => null }));
vi.mock('@/components/file-upload-modal', () => ({ default: () => null }));

const { default: AdminLayout } = await import('@/app/(dashboard)/layout');
const { default: AdminPage } = await import('@/app/(dashboard)/admin/page');
const { default: EditPromptPage } = await import('@/app/(dashboard)/admin/prompt/page');

const redirectToSignIn = vi.fn(() => {
  throw new Error('NEXT_REDIRECT /sign-in');
});

const signedOut = () => clerk.auth.mockResolvedValue({ userId: null, sessionClaims: null, redirectToSignIn });

const signedInAs = (role: string) =>
  clerk.auth.mockResolvedValue({ userId: 'user_1', sessionClaims: { metadata: { role } } });

const views = [
  { name: 'the (dashboard) layout', render: () => AdminLayout({ children: null }) },
  { name: '/admin', render: () => AdminPage() },
  { name: '/admin/prompt', render: () => EditPromptPage() }
];

beforeEach(() => {
  vi.clearAllMocks();
  getIndexes.mockResolvedValue([]);
});

describe.each(views)('$name', ({ render }) => {
  it('sends a signed-out visitor to sign in', async () => {
    signedOut();

    await expect(render()).rejects.toThrow('NEXT_REDIRECT /sign-in');
    expect(redirectToSignIn).toHaveBeenCalledOnce();
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it('redirects a signed-in non-admin home', async () => {
    signedInAs('member');

    await expect(render()).rejects.toThrow('NEXT_REDIRECT /');
    expect(navigation.redirect).toHaveBeenCalledWith('/');
  });

  it('renders for an admin', async () => {
    signedInAs('admin');

    expect(isValidElement(await render())).toBe(true);
    expect(navigation.redirect).not.toHaveBeenCalled();
  });
});

it('does not load indexes for a non-admin', async () => {
  signedInAs('member');

  await expect(AdminPage()).rejects.toThrow('NEXT_REDIRECT /');
  expect(getIndexes).not.toHaveBeenCalled();
});
