// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccordionSection, { type AccordionItem } from './accordion';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = (overrides: Partial<AccordionItem> = {}): AccordionItem => ({
  id: 'a',
  title: 'ethics',
  content: 'host-a',
  isActive: true,
  weight: 1,
  ancient: 'aristotle',
  ...overrides,
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

const render = (data: AccordionItem[]) =>
  act(() => {
    root.render(<AccordionSection data={data} />);
  });

const picker = () => container.querySelector<HTMLSelectElement>('select[aria-label="ethics ancient"]')!;

// React tracks the select's value, so set it through the native setter for onChange to fire.
const choose = (value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(picker(), value);
    picker().dispatchEvent(new Event('change', { bubbles: true }));
  });

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('AccordionSection ancient picker', () => {
  it("shows the index's ancient, with disabled ancients marked and a no-ancient option", () => {
    render([item()]);

    expect(picker().value).toBe('aristotle');
    const labels = Array.from(picker().options).map((option) => option.textContent);
    expect(labels).toContain('No ancient');
    expect(labels).toContain('Aristotle');
    expect(labels).toContain('Plato (disabled)');
  });

  it('shows an unassigned index as no ancient', () => {
    render([item({ ancient: null })]);

    expect(picker().value).toBe('');
  });

  it('assigns the index to the chosen ancient', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    render([item()]);

    await choose('plato');

    expect(fetchMock).toHaveBeenCalledWith('/api/indexes/ethics/ancient', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ancient: 'plato' }),
    });
    expect(picker().value).toBe('plato');
  });

  it('sends null for no ancient', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    render([item()]);

    await choose('');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ancient: null });
    expect(picker().value).toBe('');
  });

  it('keeps the old ancient and shows a toast when the change fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Forbidden' }, 403));
    render([item()]);

    await choose('plato');

    expect(picker().value).toBe('aristotle');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not change the ancient of "ethics": Forbidden'
    );
  });
});
