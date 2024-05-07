/**
 * Generator function that streams the response body from a fetch request.
 */
export async function* streamingFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);

  if (response == null || !response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    try {
      const val = decoder.decode(value);
      const replaced = val.replace(/0:|"/g, '').split('\n');
      yield replaced;
    } catch (e: any) {
      console.warn(e.message);
    }
  }
}
