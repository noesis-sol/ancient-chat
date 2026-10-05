// Shared by the prompt API's schema and the admin prompt form, so this module
// must not import anything server-only.
export const MAX_PROMPT_CHARS = 20_000;

// The reason the form should not submit this text, or null when it may. The
// server applies the same rules, so this only spares the round trip.
export function promptTextError(text: string): string | null {
  if (text.trim() === '') return 'Prompt must not be empty';
  if (text.length > MAX_PROMPT_CHARS) {
    return `Prompt must be at most ${MAX_PROMPT_CHARS.toLocaleString('en-US')} characters (it has ${text.length.toLocaleString('en-US')})`;
  }
  return null;
}

// The admin API answers failures with a JSON { error }; fall back when the body
// is not that shape (a proxy's HTML error page, say).
export async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' && body.error) {
      return body.error;
    }
  } catch {
    // Not JSON.
  }
  return fallback;
}
