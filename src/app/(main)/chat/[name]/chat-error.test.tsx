// @vitest-environment jsdom
import { APICallError } from 'ai';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatError from './chat-error';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// The error useChat reports for a failed /api/chat response.
const apiError = (statusCode: number, responseBody: string) =>
  new APICallError({ message: responseBody, url: '/api/chat', requestBodyValues: undefined, statusCode, responseBody });

const render = (error: Error, onRetry = () => {}) =>
  act(() => {
    root.render(<ChatError error={error} onRetry={onRetry} />);
  });

const alertText = () => container.querySelector('[role="alert"]')?.textContent;

describe('ChatError', () => {
  it.each([
    [30, '30 seconds'],
    [1, '1 second'],
    [60, '1 minute'],
    [90, '2 minutes'],
    [5 * 3600, '5 hours'],
  ])('asks to wait when rate limited for %i seconds', (retryAfter, wait) => {
    render(apiError(429, JSON.stringify({ error: 'Too many requests', retryAfter })));

    expect(alertText()).toBe(`You've sent too many messages. Please wait ${wait} and try again. Retry`);
  });

  it('asks to wait a little while without a usable retryAfter', () => {
    render(apiError(429, 'Too Many Requests'));

    expect(alertText()).toContain('Please wait a little while and try again.');
  });

  it.each([
    ['a server error', apiError(500, JSON.stringify({ error: 'Internal server error' }))],
    ['a network error', new TypeError('Failed to fetch')],
  ])('shows the generic message for %s', (_case, error) => {
    render(error);

    expect(alertText()).toBe('Something went wrong while getting a reply. Retry');
  });

  it('retries from the button', () => {
    const onRetry = vi.fn();
    render(apiError(429, JSON.stringify({ retryAfter: 10 })), onRetry);

    act(() => container.querySelector('button')!.click());

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
