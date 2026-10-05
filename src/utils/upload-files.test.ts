import { describe, expect, it } from 'vitest';
import { countFiles, EntryReadError, processFileEntry, readUploadError } from './upload-files';

const fileEntry = (fullPath: string, read: { file?: File; error?: Error }): FileSystemEntry =>
  ({
    isFile: true,
    isDirectory: false,
    name: fullPath.split('/').pop(),
    fullPath,
    file: (success: FileCallback, failure?: ErrorCallback) =>
      setTimeout(() => (read.error ? failure?.(read.error as DOMException) : success(read.file!)))
  }) as unknown as FileSystemEntry;

const dirEntry = (fullPath: string, batches: FileSystemEntry[][], error?: Error): FileSystemEntry =>
  ({
    isFile: false,
    isDirectory: true,
    name: fullPath.split('/').pop(),
    fullPath,
    createReader: () => {
      const pending = [...batches, []];
      return {
        readEntries: (success: FileSystemEntriesCallback, failure?: ErrorCallback) =>
          setTimeout(() => (error ? failure?.(error as DOMException) : success(pending.shift() ?? [])))
      };
    }
  }) as unknown as FileSystemEntry;

describe('processFileEntry', () => {
  it('reads a file', async () => {
    const file = new File(['text'], 'a.txt');
    await expect(processFileEntry(fileEntry('/a.txt', { file }))).resolves.toEqual({
      file,
      path: '/a.txt',
      type: 'file'
    });
  });

  it('reads every batch of a folder, recursing into subfolders', async () => {
    const a = new File(['a'], 'a.txt');
    const b = new File(['b'], 'b.txt');
    const c = new File(['c'], 'c.txt');
    const tree = dirEntry('/books', [
      [fileEntry('/books/a.txt', { file: a })],
      [fileEntry('/books/b.txt', { file: b }), dirEntry('/books/sub', [[fileEntry('/books/sub/c.txt', { file: c })]])]
    ]);

    const result = await processFileEntry(tree);

    expect(result).toEqual({
      name: 'books',
      path: '/books',
      type: 'folder',
      children: [
        { file: a, path: '/books/a.txt', type: 'file' },
        { file: b, path: '/books/b.txt', type: 'file' },
        {
          name: 'sub',
          path: '/books/sub',
          type: 'folder',
          children: [{ file: c, path: '/books/sub/c.txt', type: 'file' }]
        }
      ]
    });
    expect(countFiles([result])).toBe(3);
  });

  it('rejects with the path when a file cannot be read', async () => {
    const tree = dirEntry('/books', [
      [fileEntry('/books/ok.txt', { file: new File(['ok'], 'ok.txt') })],
      [fileEntry('/books/locked.txt', { error: new Error('NotReadableError') })]
    ]);

    const error = await processFileEntry(tree).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EntryReadError);
    expect(error).toMatchObject({ path: '/books/locked.txt', message: 'Could not read /books/locked.txt: NotReadableError' });
  });

  it('rejects with the path when a folder cannot be listed', async () => {
    const error = await processFileEntry(dirEntry('/books', [], new Error('SecurityError'))).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EntryReadError);
    expect(error).toMatchObject({ path: '/books' });
  });
});

describe('readUploadError', () => {
  it('reads the error and code from a JSON body', async () => {
    const response = Response.json({ error: 'Too big', code: 'FILE_TOO_LARGE' }, { status: 400 });
    await expect(readUploadError(response)).resolves.toEqual({ message: 'Too big', code: 'FILE_TOO_LARGE' });
  });

  it('falls back to the status for an HTML body', async () => {
    const response = new Response('<html>Request Entity Too Large</html>', {
      status: 413,
      statusText: 'Payload Too Large'
    });
    await expect(readUploadError(response)).resolves.toEqual({
      message: 'The server responded with 413 Payload Too Large',
      code: 'PAYLOAD_TOO_LARGE'
    });
  });

  it('maps a gateway timeout and an unknown status', async () => {
    await expect(readUploadError(new Response('timeout', { status: 504 }))).resolves.toMatchObject({
      code: 'GATEWAY_TIMEOUT'
    });
    await expect(readUploadError(new Response('', { status: 502 }))).resolves.toEqual({
      message: 'The server responded with 502',
      code: 'HTTP_ERROR'
    });
  });

  it('fills in fields missing from a JSON body', async () => {
    await expect(readUploadError(Response.json({}, { status: 500 }))).resolves.toEqual({
      message: 'The server responded with 500',
      code: 'HTTP_ERROR'
    });
    await expect(readUploadError(Response.json(null, { status: 500 }))).resolves.toMatchObject({ code: 'HTTP_ERROR' });
  });
});
