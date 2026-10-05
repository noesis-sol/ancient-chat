// @vitest-environment jsdom
import type { ContextSource } from '@/utils/context-sources';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Message from './message';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const sources: ContextSource[] = [
  { id: 'a-1', index: 'aristotle', text: 'Virtue is a mean.', source: '/aristotle/ethics.txt', filename: 'ethics.txt' },
  { id: 'p-4', index: 'plato', text: 'The unexamined life.', source: '/plato/apology.txt' },
];

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

const render = (element: React.ReactElement) =>
  act(() => {
    root.render(element);
  });

describe('view source', () => {
  it('shows each retrieved chunk under its own source name', () => {
    render(<Message message='Answer' direction='incoming' sources={sources} />);

    expect(container.textContent).toContain('view source');
    const items = [...container.querySelectorAll('li')].map((li) => li.textContent);
    expect(items).toEqual(['Virtue is a mean.-- ethics.txt', 'The unexamined life.-- apology.txt']);
    expect(container.querySelector('a')).toBeNull();
  });

  it('opens the popup belonging to its own message', () => {
    render(
      <>
        <Message message='One' direction='incoming' sources={sources} />
        <Message message='Two' direction='incoming' sources={sources} />
      </>
    );

    const ids = [...container.querySelectorAll('input.modal-toggle')].map((input) => input.id);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      expect(container.querySelectorAll(`label[for="${CSS.escape(id)}"]`)).toHaveLength(2);
    }
  });

  it('keeps the list items across re-renders', () => {
    render(<Message message='Answer' direction='incoming' sources={sources} />);
    const first = container.querySelector('li');
    render(<Message message='Answer' direction='incoming' sources={[...sources]} />);
    expect(container.querySelector('li')).toBe(first);
  });

  it('has no link without sources', () => {
    render(<Message message='Hello' direction='incoming' sources={[]} />);
    expect(container.textContent).not.toContain('view source');
    render(<Message message='Hello' direction='outgoing' />);
    expect(container.textContent).not.toContain('view source');
  });
});
