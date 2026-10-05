// A chunk retrieved from Pinecone for a question. /api/chat sends these with
// the reply so 'view source' can show what the answer was based on.
export type ContextSource = {
  id: string;
  // The Pinecone index the chunk came from.
  index: string;
  text: string;
  // The uploaded file's path and name, from the metadata set on upload.
  source?: string;
  filename?: string;
};

type Match = { id: string; metadata?: Record<string, unknown> };

const stringOrUndefined = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined);

// Returns null for a match without text: there is nothing to answer from or show.
export function toContextSource(index: string, match: Match): ContextSource | null {
  const text = stringOrUndefined(match.metadata?.text);
  if (text === undefined) {
    return null;
  }
  return {
    id: match.id,
    index,
    text,
    source: stringOrUndefined(match.metadata?.source),
    filename: stringOrUndefined(match.metadata?.filename),
  };
}

// The name a source is shown under.
export function sourceLabel(source: ContextSource): string {
  return source.filename ?? source.source?.split('/').filter(Boolean).pop() ?? source.index;
}
