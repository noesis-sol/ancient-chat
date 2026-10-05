import type { Chunk } from './upload-chunks';

// The chunking LangChain's RecursiveCharacterTextSplitter (0.3) did with its
// default separators and keepSeparator, so files uploaded again split exactly
// as the indexes they replace did.

/** Characters per chunk, at most. */
export const CHUNK_SIZE = 1000;

/** Characters the end of one chunk shares with the start of the next, at most. */
export const CHUNK_OVERLAP = 200;

const SEPARATORS = ['\n\n', '\n', ' ', ''];

/**
 * Splits text at the first separator it contains, keeping each separator at
 * the start of the piece after it. With '' it splits into single characters.
 */
function splitOn(text: string, separator: string): string[] {
  const escaped = separator.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
  const pieces = separator ? text.split(new RegExp(`(?=${escaped})`)) : text.split('');
  return pieces.filter((piece) => piece !== '');
}

/**
 * Joins consecutive pieces into trimmed chunks of at most CHUNK_SIZE
 * characters, starting each new chunk with as many of the previous chunk's
 * last pieces as fit in CHUNK_OVERLAP.
 */
function mergePieces(pieces: string[]): string[] {
  const chunks: string[] = [];
  const current: string[] = [];
  let total = 0;
  const flush = () => {
    const chunk = current.join('').trim();
    if (chunk) chunks.push(chunk);
  };

  for (const piece of pieces) {
    if (total + piece.length > CHUNK_SIZE && current.length > 0) {
      flush();
      while (total > CHUNK_OVERLAP || (total + piece.length > CHUNK_SIZE && total > 0)) {
        total -= current.shift()!.length;
      }
    }
    current.push(piece);
    total += piece.length;
  }
  flush();
  return chunks;
}

function splitRecursively(text: string, separators: string[]): string[] {
  // The first separator the text contains; '' (single characters) always matches
  const i = separators.findIndex((separator) => separator === '' || text.includes(separator));
  const separator = separators[i];
  const finer = separator === '' ? [] : separators.slice(i + 1);

  const chunks: string[] = [];
  let short: string[] = [];
  for (const piece of splitOn(text, separator)) {
    if (piece.length < CHUNK_SIZE) {
      short.push(piece);
      continue;
    }
    chunks.push(...mergePieces(short));
    short = [];
    chunks.push(...(finer.length ? splitRecursively(piece, finer) : [piece]));
  }
  chunks.push(...mergePieces(short));
  return chunks;
}

/** Splits text into overlapping chunks, preferring paragraph, then line, then word breaks. */
export function splitText(text: string): string[] {
  return splitRecursively(text, SEPARATORS);
}

const newlines = (text: string): number => text.split('\n').length - 1;

/**
 * Splits a file's text into chunks, each with the file's metadata and
 * `loc.lines`, the first and last line of the file it covers (from 1).
 */
export function splitDocument(text: string, metadata: Record<string, unknown>): Chunk[] {
  const chunks: Chunk[] = [];
  let line = 1;
  let previous: { start: number; end: number } | null = null;

  for (const chunk of splitText(text)) {
    const start = text.indexOf(chunk, (previous?.start ?? -1) + 1);
    if (!previous) {
      line += newlines(text.slice(0, start));
    } else if (previous.end < start) {
      line += newlines(text.slice(previous.end, start));
    } else {
      // The chunk starts inside the overlap with the previous one
      line -= newlines(text.slice(start, previous.end));
    }
    const lines = newlines(chunk);
    chunks.push({ pageContent: chunk, metadata: { ...metadata, loc: { lines: { from: line, to: line + lines } } } });
    line += lines;
    previous = { start, end: start + chunk.length };
  }
  return chunks;
}
