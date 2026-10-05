import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

vi.mock('@/utils/adminAuth', () => ({ redirectNonAdmin: vi.fn() }));
vi.mock('@/utils/fonts', () => ({ lemonMilkFont: { className: 'lemon-milk' } }));
vi.mock('@clerk/nextjs', () => ({ ClerkProvider: ({ children }: { children: ReactNode }) => children }));

const { default: AdminLayout } = await import('@/app/(dashboard)/layout');

it('draws the mobile drawer toggle as an svg icon, not Material Icons text', async () => {
  const html = renderToStaticMarkup(await AdminLayout({ children: null }));
  const toggle = html.match(/<label[^>]*aria-label="open sidebar"[^>]*>(.*?)<\/label>/)?.[1];

  expect(toggle).toMatch(/^<svg[^>]*lucide-menu/);
  expect(toggle).not.toContain('>menu<');
  expect(html).not.toContain('material-icons');
});
