import { describe, expect, it } from 'vitest';
import { CHUNK_OVERLAP, CHUNK_SIZE, splitDocument, splitText } from './text-splitter';

const sentence = (n: number) => `Sentence ${n} of the dialogue, in which Socrates asks what justice is.`;
const sentences = (from: number, count: number, separator: string) =>
  Array.from({ length: count }, (_, i) => sentence(from + i)).join(separator);

// Short paragraphs, a paragraph too long for one chunk on one line (split at
// spaces) and on many lines (split at line breaks), and a word longer than a
// chunk (split into characters).
const sample = [
  '# Republic, Book I',
  sentences(1, 3, ' '),
  sentences(4, 20, ' '),
  sentences(30, 18, '\n'),
  sentences(50, 4, ' '),
  'ΣΩΚΡΑΤΗΣ'.repeat(150),
  sentences(60, 2, ' ')
].join('\n\n');

// How long the longest end of `before` that `after` starts with is.
const sharedLength = (before: string, after: string): number => {
  for (let start = 0; start < before.length; start++) {
    if (after.startsWith(before.slice(start))) return before.length - start;
  }
  return 0;
};

const metadata = { source: 'plato/republic.md', filename: 'republic.md', type: 'text/markdown' };

describe('splitDocument', () => {
  // Recorded from LangChain's RecursiveCharacterTextSplitter (chunkSize 1000,
  // chunkOverlap 200), which split every index uploaded before this module
  it('splits the sample text as LangChain did', () => {
    expect(splitDocument(sample, metadata)).toMatchSnapshot();
  });

  it('gives a short text one chunk covering all its lines', () => {
    expect(splitDocument('\n\n  First line\nsecond line  \n', metadata)).toEqual([
      { pageContent: 'First line\nsecond line', metadata: { ...metadata, loc: { lines: { from: 3, to: 4 } } } }
    ]);
  });

  it('gives a blank text no chunks', () => {
    expect(splitDocument(' \n\n ', metadata)).toEqual([]);
  });
});

describe('splitText', () => {
  it('keeps chunks within the chunk size and overlaps consecutive ones', () => {
    const chunks = splitText(sentences(1, 100, ' '));

    expect(chunks.length).toBeGreaterThan(5);
    chunks.forEach((chunk) => expect(chunk.length).toBeLessThanOrEqual(CHUNK_SIZE));
    chunks.slice(1).forEach((chunk, i) => {
      const overlap = sharedLength(chunks[i], chunk);
      expect(overlap).toBeGreaterThan(0);
      expect(overlap).toBeLessThanOrEqual(CHUNK_OVERLAP);
    });
  });

  it('breaks at paragraphs before lines and lines before words', () => {
    const paragraph = sentences(1, 10, '\n');

    expect(splitText(`${paragraph}\n\n${paragraph}`)).toEqual([paragraph, paragraph]);
  });
});
