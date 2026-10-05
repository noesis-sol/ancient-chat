import { describe, expect, it } from 'vitest';
import { MAX_PROMPT_CHARS, promptTextError, responseErrorMessage } from './prompt-text';

describe('promptTextError', () => {
  it('accepts text up to the limit', () => {
    expect(promptTextError('Hello')).toBeNull();
    expect(promptTextError('a'.repeat(MAX_PROMPT_CHARS))).toBeNull();
  });

  it.each(['', '   ', '\n\t'])('rejects blank text %j', (text) => {
    expect(promptTextError(text)).toBe('Prompt must not be empty');
  });

  it('rejects text over the limit', () => {
    expect(promptTextError('a'.repeat(MAX_PROMPT_CHARS + 1))).toBe(
      'Prompt must be at most 20,000 characters (it has 20,001)'
    );
  });
});

describe('responseErrorMessage', () => {
  it('returns the error field of a JSON body', async () => {
    const response = Response.json({ error: 'text: Must not be empty' }, { status: 400 });
    expect(await responseErrorMessage(response, 'fallback')).toBe('text: Must not be empty');
  });

  it.each([
    ['a non-JSON body', new Response('Internal Server Error', { status: 500 })],
    ['an empty body', new Response(null, { status: 500 })],
    ['JSON without an error string', Response.json({ error: { code: 1 } }, { status: 400 })],
    ['an empty error string', Response.json({ error: '' }, { status: 400 })],
    ['a JSON array', Response.json(['nope'], { status: 400 })]
  ])('falls back for %s', async (_label, response) => {
    expect(await responseErrorMessage(response, 'fallback')).toBe('fallback');
  });
});
