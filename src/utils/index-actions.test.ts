import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseWeight, readActionResult, sendIndexAction } from './index-actions';

describe('parseWeight', () => {
  it('accepts numbers in [0, 1]', () => {
    expect(parseWeight('0')).toBe(0);
    expect(parseWeight('1')).toBe(1);
    expect(parseWeight('0.25')).toBe(0.25);
    expect(parseWeight('.5')).toBe(0.5);
    expect(parseWeight(' 0.3 ')).toBe(0.3);
  });

  it('treats a trailing dot as the number before it', () => {
    expect(parseWeight('0.')).toBe(0);
  });

  it('rejects empty, out-of-range and non-numeric input', () => {
    for (const input of ['', ' ', '.', '-0.1', '1.01', '2', 'abc', '0.5x', '1e-1', 'NaN', 'Infinity']) {
      expect(parseWeight(input)).toBeNull();
    }
  });
});

const response = (body: string, status = 200, statusText = '') => new Response(body, { status, statusText });

describe('readActionResult', () => {
  it('is ok when the route confirms success', async () => {
    await expect(readActionResult(response('{"success":true}'))).resolves.toEqual({ ok: true });
  });

  it('uses the error the route sent', async () => {
    await expect(readActionResult(response('{"error":"Unauthorized"}', 401))).resolves.toEqual({
      ok: false,
      message: 'Unauthorized'
    });
  });

  it('falls back to the status when the body is not JSON', async () => {
    await expect(readActionResult(response('<html>oops</html>', 500, 'Internal Server Error'))).resolves.toEqual({
      ok: false,
      message: 'The server responded with 500 Internal Server Error'
    });
  });

  it('fails when a 200 does not confirm success', async () => {
    await expect(readActionResult(response('{"success":false}'))).resolves.toEqual({
      ok: false,
      message: 'The server did not confirm the change'
    });
    await expect(readActionResult(response('<html></html>'))).resolves.toEqual({
      ok: false,
      message: 'The server sent an unreadable response'
    });
  });

  it('does not treat success: true on an error status as ok', async () => {
    await expect(readActionResult(response('{"success":true}', 502))).resolves.toEqual({
      ok: false,
      message: 'The server responded with 502'
    });
  });
});

describe('sendIndexAction', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('turns a network failure into an error result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(sendIndexAction('/api/indexes/a', { method: 'DELETE' })).resolves.toEqual({
      ok: false,
      message: 'Failed to fetch'
    });
  });

  it('reads the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('{"success":true}'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(sendIndexAction('/api/indexes/a', { method: 'DELETE' })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/indexes/a', { method: 'DELETE' });
  });
});
