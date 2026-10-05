import { APICallError } from 'ai';

function waitText(seconds: number): string {
  const [amount, unit] =
    seconds < 60 ? [seconds, 'second'] : seconds < 3600 ? [Math.ceil(seconds / 60), 'minute'] : [Math.ceil(seconds / 3600), 'hour'];
  return `${amount} ${unit}${amount === 1 ? '' : 's'}`;
}

function retryAfter(responseBody: string | undefined): number | undefined {
  try {
    const value = (JSON.parse(responseBody ?? '') as { retryAfter?: unknown }).retryAfter;
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.ceil(value) : undefined;
  } catch {
    return undefined;
  }
}

// What the chat shows when /api/chat turned a message away with 429, or
// undefined for any other error. useChat reports a failed response as an
// APICallError with its status and body; the body carries `retryAfter`.
export function rateLimitMessage(error: unknown): string | undefined {
  if (!APICallError.isInstance(error) || error.statusCode !== 429) {
    return undefined;
  }
  const seconds = retryAfter(error.responseBody);
  const wait = seconds === undefined ? 'a little while' : waitText(seconds);
  return `You've sent too many messages. Please wait ${wait} and try again.`;
}
