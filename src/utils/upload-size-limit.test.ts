import { describe, expect, it } from 'vitest';
import type { FileItem, FolderItem, UploadItem } from './upload-files';
import { FILE_TOO_LARGE_MESSAGE, MAX_UPLOAD_FILE_SIZE, prepareDrop } from './upload-rules';

const file = (path: string, size: number): FileItem => ({
  file: new File([new Uint8Array(size)], path.split('/').pop()!),
  path,
  type: 'file'
});

const folder = (path: string, children: UploadItem[]): FolderItem => ({
  name: path.split('/').pop()!,
  path,
  type: 'folder',
  children
});

describe('the upload size limit', () => {
  it('is 4 MB, below the 4.5 MB Vercel accepts', () => {
    expect(MAX_UPLOAD_FILE_SIZE).toBe(4 * 1024 * 1024);
    expect(FILE_TOO_LARGE_MESSAGE).toBe('File size exceeds the maximum limit of 4 MB');
  });

  it('keeps files up to the limit and skips larger ones with a warning naming them', () => {
    const { folders, warnings, error } = prepareDrop([
      folder('/plato', [
        file('/plato/republic.txt', MAX_UPLOAD_FILE_SIZE),
        file('/plato/laws.txt', MAX_UPLOAD_FILE_SIZE + 1)
      ])
    ]);

    expect(error).toBeUndefined();
    expect(folders[0].children.map((child) => child.path)).toEqual(['/plato/republic.txt']);
    expect(warnings).toEqual(['Skipped files over 4 MB: /plato/laws.txt']);
  });

  it('rejects a drop whose every file is too large', () => {
    const { folders, warnings, error } = prepareDrop([
      folder('/plato', [file('/plato/laws.txt', MAX_UPLOAD_FILE_SIZE + 1)])
    ]);

    expect(folders).toEqual([]);
    expect(warnings).toEqual(['Skipped files over 4 MB: /plato/laws.txt']);
    expect(error).toEqual({
      code: 'NO_SUPPORTED_FILES',
      message: 'The dropped folders hold no .txt or .md files of at most 4 MB to upload'
    });
  });
});
