export const MIN_WEIGHT = 0;
export const MAX_WEIGHT = 1;

/**
 * Parses what the admin typed in a weight input. Returns null for anything
 * that isn't a number in [MIN_WEIGHT, MAX_WEIGHT], including the empty string
 * and partial input such as "0." that the input must still accept while typing.
 */
export const parseWeight = (input: string): number | null => {
  const trimmed = input.trim();
  if (!/^(\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= MIN_WEIGHT && value <= MAX_WEIGHT ? value : null;
};

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Reads the result of an index admin request (delete, toggle, weight). The
 * routes answer { success: true } or { error }, but a crash or the platform in
 * front of them can answer with an HTML page, so a body that isn't JSON falls
 * back to the HTTP status.
 */
export const readActionResult = async (response: Response): Promise<ActionResult> => {
  const fallback = `The server responded with ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
  let data: unknown;
  try {
    data = JSON.parse(await response.text());
  } catch {
    return { ok: false, message: response.ok ? 'The server sent an unreadable response' : fallback };
  }
  const { success, error } = (data && typeof data === 'object' ? data : {}) as { success?: unknown; error?: unknown };
  if (response.ok && success === true) return { ok: true };
  if (typeof error === 'string' && error) return { ok: false, message: error };
  return { ok: false, message: response.ok ? 'The server did not confirm the change' : fallback };
};

/** Sends an index admin request; network failures resolve to an error result too. */
export const sendIndexAction = async (url: string, init: RequestInit): Promise<ActionResult> => {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The request failed' };
  }
  return readActionResult(response);
};
