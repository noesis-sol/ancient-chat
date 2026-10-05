// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useUser: vi.fn()
}));

vi.mock('@clerk/nextjs', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const UserButton = Object.assign(Passthrough, {
    MenuItems: Passthrough,
    Link: ({ href, label }: { href: string; label: string }) => <a href={href}>{label}</a>
  });
  return { ...clerk, SignedIn: Passthrough, UserButton };
});

vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => <img alt={alt} /> }));

const { default: Navbar } = await import('@/app/(main)/navbar');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const render = () =>
  act(() => {
    root.render(<Navbar />);
  });

const adminLink = () => container.querySelector('a[href="/admin"]');

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Navbar admin link', () => {
  it('is hidden when signed out', async () => {
    clerk.useAuth.mockReturnValue({ sessionClaims: null });
    clerk.useUser.mockReturnValue({ user: null });

    await render();

    expect(adminLink()).toBeNull();
  });

  it('is hidden for a non-admin, whatever email addresses they have', async () => {
    clerk.useAuth.mockReturnValue({ sessionClaims: { metadata: {} } });
    clerk.useUser.mockReturnValue({
      user: { publicMetadata: {}, emailAddresses: [{ emailAddress: 'michael@noesis.solutions' }] }
    });

    await render();

    expect(adminLink()).toBeNull();
  });

  it('is shown for the admin role in the session claims', async () => {
    clerk.useAuth.mockReturnValue({ sessionClaims: { metadata: { role: 'admin' } } });
    clerk.useUser.mockReturnValue({ user: { publicMetadata: {} } });

    await render();

    expect(adminLink()?.textContent).toBe('Admin');
  });

  it('falls back to the public metadata when the session token has no metadata', async () => {
    clerk.useAuth.mockReturnValue({ sessionClaims: {} });
    clerk.useUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } });

    await render();

    expect(adminLink()).not.toBeNull();
  });
});
