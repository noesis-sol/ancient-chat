import { describe, expect, it } from 'vitest';
import { cleanMetadata, getRootFolderName, sanitizeIndexName } from './index-upload';

describe('sanitizeIndexName', () => {
  it('lowercases and keeps letters, digits and hyphens', () => {
    expect(sanitizeIndexName('Plato-Republic2')).toBe('plato-republic2');
  });

  it('drops a leading slash', () => {
    expect(sanitizeIndexName('/plato')).toBe('plato');
  });

  it('replaces invalid characters with single hyphens', () => {
    expect(sanitizeIndexName('marcus aurelius')).toBe('marcus-aurelius');
    expect(sanitizeIndexName('my_folder.name')).toBe('my-folder-name');
    expect(sanitizeIndexName('a  __  b')).toBe('a-b');
    expect(sanitizeIndexName('a--b')).toBe('a-b');
  });

  it('trims hyphens from both ends', () => {
    expect(sanitizeIndexName('_plato_')).toBe('plato');
    expect(sanitizeIndexName('--plato--')).toBe('plato');
  });

  it('replaces non-ASCII letters', () => {
    expect(sanitizeIndexName('Σωκράτης notes')).toBe('notes');
    expect(sanitizeIndexName('café')).toBe('caf');
  });

  it('returns an empty string when nothing valid is left', () => {
    expect(sanitizeIndexName('')).toBe('');
    expect(sanitizeIndexName('/')).toBe('');
    expect(sanitizeIndexName('___')).toBe('');
  });
});

describe('getRootFolderName', () => {
  it('returns the first path segment', () => {
    expect(getRootFolderName('plato/republic/book1.txt')).toBe('plato');
  });

  it('ignores a leading slash', () => {
    expect(getRootFolderName('/plato/republic.txt')).toBe('plato');
  });

  it('returns the name itself for a path with no folder', () => {
    expect(getRootFolderName('notes.txt')).toBe('notes.txt');
  });

  it('returns an empty string for an empty path', () => {
    expect(getRootFolderName('')).toBe('');
    expect(getRootFolderName('/')).toBe('');
  });
});

describe('cleanMetadata', () => {
  it('keeps strings, numbers, booleans and string arrays as they are', () => {
    const metadata = { source: 'a/b.txt', page: 3, draft: false, tags: ['x', 'y'], empty: [] };
    expect(cleanMetadata(metadata)).toEqual(metadata);
  });

  it('serialises objects and mixed arrays to JSON', () => {
    expect(
      cleanMetadata({
        loc: { lines: { from: 1, to: 10 } },
        mixed: ['a', 1],
      })
    ).toEqual({
      loc: '{"lines":{"from":1,"to":10}}',
      mixed: '["a",1]',
    });
  });

  it('drops null and undefined values', () => {
    expect(cleanMetadata({ a: null, b: undefined, c: 'kept' })).toEqual({ c: 'kept' });
  });

  it('returns an empty object for empty metadata', () => {
    expect(cleanMetadata({})).toEqual({});
  });
});
