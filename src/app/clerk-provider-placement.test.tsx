import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/adminAuth', () => ({ redirectNonAdmin: vi.fn() }));
vi.mock('@/utils/fonts', () => ({ lemonMilkFont: { className: 'lemon-milk' } }));
vi.mock('@/app/(main)/navbar', () => ({ default: () => null }));
vi.mock('@clerk/nextjs', () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => <div data-clerk-provider>{children}</div>
}));

const { default: MainLayout } = await import('@/app/(main)/layout');
const { default: AdminLayout } = await import('@/app/(dashboard)/layout');

// Clerk v7 requires ClerkProvider inside <body>, not wrapping <html>.
describe('ClerkProvider placement', () => {
  it.each([
    ['main', async () => MainLayout({ children: null })],
    ['admin', async () => AdminLayout({ children: null })]
  ])('sits inside <body> in the %s layout', async (_name, render) => {
    const html = renderToStaticMarkup(await render());

    expect(html).toMatch(/^<html[^>]*>(<head>.*?<\/head>)?<body><div data-clerk-provider="true">/);
  });
});
