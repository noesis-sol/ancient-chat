// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccordionSection, { type AccordionItem } from './accordion';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = (id: string, overrides: Partial<AccordionItem> = {}): AccordionItem => ({
  id,
  title: `index-${id}`,
  content: `Content of ${id}`,
  isActive: true,
  weight: 1,
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

const click = (element: Element) =>
  act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

// React tracks the input's value, so set it through the native setter for onChange to fire.
const type = (input: HTMLInputElement, value: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

const rowTitles = () => Array.from(container.querySelectorAll('span.font-medium')).map((el) => el.textContent);

const expandButton = (title: string) => container.querySelector<HTMLButtonElement>(`button[aria-label$=" ${title}"]`)!;

const isExpanded = (title: string) => expandButton(title).getAttribute('aria-expanded') === 'true';

const rowFor = (title: string) => expandButton(title).closest('div.border')!;

const buttonByText = (scope: ParentNode, text: string) =>
  Array.from(scope.querySelectorAll('button')).find((button) => button.textContent === text)!;

const dialog = () => container.querySelector('dialog')!;

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

describe('AccordionSection', () => {
  it('shows an empty state when there are no indexes', () => {
    render([]);
    expect(container.textContent).toContain('No indexes yet');
  });

  it('replaces the list when refreshed props arrive', () => {
    render([item('a'), item('b')]);
    expect(rowTitles()).toEqual(['index-a', 'index-b']);

    render([item('b'), item('c')]);
    expect(rowTitles()).toEqual(['index-b', 'index-c']);

    render([]);
    expect(container.textContent).toContain('No indexes yet');
  });

  it('keeps the open row open when another row is deleted', async () => {
    render([item('a'), item('b'), item('c')]);
    await click(expandButton('index-b'));
    expect(isExpanded('index-b')).toBe(true);

    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    await click(buttonByText(rowFor('index-a'), 'Delete'));
    expect(dialog().className).toContain('modal-open');
    await click(buttonByText(dialog(), 'Delete'));

    expect(fetchMock).toHaveBeenCalledWith('/api/indexes/index-a', { method: 'DELETE' });
    expect(rowTitles()).toEqual(['index-b', 'index-c']);
    expect(isExpanded('index-b')).toBe(true);
    expect(isExpanded('index-c')).toBe(false);
    expect(dialog().className).not.toContain('modal-open');
  });

  it('shows the error inside the delete dialog and keeps the row when delete fails', async () => {
    render([item('a'), item('b')]);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Index is locked' }, 409));
    await click(buttonByText(rowFor('index-a'), 'Delete'));
    await click(buttonByText(dialog(), 'Delete'));

    const alert = dialog().querySelector('[role="alert"]');
    expect(alert?.textContent).toBe('Could not delete "index-a": Index is locked');
    expect(dialog().className).toContain('modal-open');
    expect(rowTitles()).toEqual(['index-a', 'index-b']);

    await click(buttonByText(dialog(), 'Cancel'));
    expect(dialog().className).not.toContain('modal-open');
    expect(dialog().querySelector('[role="alert"]')).toBeNull();
  });

  it('shows a toast and leaves the toggle unchanged when toggling fails', async () => {
    render([item('a', { isActive: true })]);
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }));
    const toggle = container.querySelector<HTMLInputElement>('input[aria-label="index-a active"]')!;
    await click(toggle);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/indexes/index-a/toggle',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ isActive: false }) }),
    );
    const toast = container.querySelector('.toast [role="alert"]');
    expect(toast?.textContent).toContain('Could not deactivate "index-a": The server responded with 502');
    expect(toggle.checked).toBe(true);
    expect(toggle.disabled).toBe(false);

    await click(container.querySelector('button[aria-label="Dismiss"]')!);
    expect(container.querySelector('.toast')).toBeNull();
  });

  it('shows a toast when saving the weight fails', async () => {
    render([item('a', { weight: 1 })]);
    fetchMock.mockRejectedValueOnce(new Error('Network down'));
    const input = container.querySelector<HTMLInputElement>('#weight-a')!;
    await type(input, '0.5');
    await click(buttonByText(rowFor('index-a'), 'Save'));

    const toast = container.querySelector('.toast [role="alert"]');
    expect(toast?.textContent).toContain('Could not save the weight of "index-a": Network down');
    expect(input.value).toBe('0.5');
  });

  it('accepts partial weight input and saves once it is a valid number', async () => {
    render([item('a', { weight: 1 })]);
    const input = container.querySelector<HTMLInputElement>('#weight-a')!;
    const save = buttonByText(rowFor('index-a'), 'Save');
    expect(input.value).toBe('1');
    expect(save.disabled).toBe(true);

    await type(input, '');
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(save.disabled).toBe(true);

    await type(input, '0.');
    expect(input.value).toBe('0.');
    expect(save.disabled).toBe(false);

    await type(input, '1.5');
    expect(input.value).toBe('1.5');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(container.textContent).toContain('Enter a number from 0 to 1.');
    expect(save.disabled).toBe(true);

    await type(input, '0.25');
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(save.disabled).toBe(false);

    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    await click(save);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/indexes/index-a',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ weight: 0.25 }) }),
    );
    expect(input.value).toBe('0.25');
    expect(save.disabled).toBe(true);
  });
});
