// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PROMPT_CHARS } from '@/utils/prompt-text';
import EditPromptPage from './prompt-editor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

const render = () =>
  act(async () => {
    root.render(<EditPromptPage />);
  });

const textarea = () => container.querySelector('textarea')!;

// React tracks the textarea's value, so set it through the native setter for onChange to fire.
const type = (value: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea(), value);
    textarea().dispatchEvent(new Event('input', { bubbles: true }));
  });

const submit = () =>
  act(async () => {
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

const alertText = (kind: 'error' | 'success') => container.querySelector(`.alert-${kind}`)?.textContent ?? null;

const putCalls = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT');

beforeEach(async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ id: 'p1', text: 'You are a helpful guide.' }));
  vi.stubGlobal('fetch', fetchMock);
  await render();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('EditPromptPage saving', () => {
  it('shows the error message the API returns', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Prompt not found' }, 404));
    await submit();

    expect(putCalls()).toHaveLength(1);
    expect(alertText('error')).toBe('Prompt not found');
    expect(alertText('success')).toBeNull();
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }));
    await submit();

    expect(alertText('error')).toBe('Failed to update prompt');
  });

  it('does not send blank text', async () => {
    await type('   \n ');
    await submit();

    expect(putCalls()).toHaveLength(0);
    expect(alertText('error')).toBe('Prompt must not be empty');
  });

  it('does not send text over the limit, and flags the count', async () => {
    await type('a'.repeat(MAX_PROMPT_CHARS + 1));
    expect(container.querySelector('.text-error')?.textContent).toBe('20,001 / 20,000');

    await submit();

    expect(putCalls()).toHaveLength(0);
    expect(alertText('error')).toBe('Prompt must be at most 20,000 characters (it has 20,001)');
  });

  it('clears a validation error once a valid save succeeds', async () => {
    await type('');
    await submit();
    expect(alertText('error')).not.toBeNull();

    await type('New prompt');
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'p1', text: 'New prompt' }));
    await submit();

    expect(putCalls()).toEqual([
      ['/api/prompt/p1', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'New prompt' }) }]
    ]);
    expect(alertText('error')).toBeNull();
    expect(alertText('success')).toBe('Prompt updated successfully!');
  });
});
