import { describe, expect, it } from 'vitest';
import type { FileItem, FolderItem, UploadItem } from './upload-files';
import {
  checkIndexName,
  checkUploadPath,
  findIndexNameCollisions,
  isIgnoredName,
  isSupportedFile,
  LOOSE_FILE_MESSAGE,
  MAX_INDEX_NAME_LENGTH,
  prepareDrop
} from './upload-rules';

const file = (path: string): FileItem => ({ file: new File(['text'], path.split('/').pop()!), path, type: 'file' });

const folder = (path: string, children: UploadItem[]): FolderItem => ({
  name: path.split('/').pop()!,
  path,
  type: 'folder',
  children
});

const paths = (items: UploadItem[]): string[] =>
  items.flatMap((item) => (item.type === 'file' ? [item.path] : [item.path, ...paths(item.children)]));

describe('isIgnoredName', () => {
  it('ignores dotfiles and dot-folders', () => {
    expect(isIgnoredName('.DS_Store')).toBe(true);
    expect(isIgnoredName('.git')).toBe(true);
    expect(isIgnoredName('._notes.txt')).toBe(true);
  });

  it('ignores Windows junk in any case', () => {
    expect(isIgnoredName('Thumbs.db')).toBe(true);
    expect(isIgnoredName('thumbs.db')).toBe(true);
    expect(isIgnoredName('desktop.ini')).toBe(true);
    expect(isIgnoredName('Desktop.ini')).toBe(true);
  });

  it('keeps ordinary names', () => {
    expect(isIgnoredName('notes.txt')).toBe(false);
    expect(isIgnoredName('plato')).toBe(false);
    expect(isIgnoredName('my.thumbs.db.txt')).toBe(false);
  });
});

describe('isSupportedFile', () => {
  it('accepts .txt and .md in any case', () => {
    for (const name of ['a.txt', 'a.md', 'A.TXT', 'Readme.MD', 'book.1.txt']) {
      expect(isSupportedFile(name)).toBe(true);
    }
  });

  it('rejects other types and names without a stem', () => {
    for (const name of ['a.pdf', 'a.docx', 'a.png', 'a.txt.pdf', 'a.markdown', 'txt', 'atxt', '.txt', 'a']) {
      expect(isSupportedFile(name)).toBe(false);
    }
  });
});

describe('checkIndexName', () => {
  it('returns the sanitized name', () => {
    expect(checkIndexName('My Docs')).toEqual({ indexName: 'my-docs' });
  });

  it('rejects a name with no letters or digits', () => {
    expect(checkIndexName('___')).toEqual({
      code: 'INVALID_INDEX_NAME',
      message: 'The folder name "___" has no letters or digits to make an index name from'
    });
  });

  it(`accepts ${MAX_INDEX_NAME_LENGTH} characters and rejects more`, () => {
    expect(checkIndexName('a'.repeat(MAX_INDEX_NAME_LENGTH))).toEqual({ indexName: 'a'.repeat(MAX_INDEX_NAME_LENGTH) });
    expect(checkIndexName('a'.repeat(MAX_INDEX_NAME_LENGTH + 1))).toEqual({
      code: 'INDEX_NAME_TOO_LONG',
      message: `The folder name "${'a'.repeat(46)}" makes an index name of 46 characters; the limit is 45`
    });
  });

  it('measures the sanitized name, not the folder name', () => {
    expect(checkIndexName(`__${'a'.repeat(MAX_INDEX_NAME_LENGTH)}__`)).toEqual({
      indexName: 'a'.repeat(MAX_INDEX_NAME_LENGTH)
    });
  });
});

describe('checkUploadPath', () => {
  it('returns the index of the root folder for a .txt or .md file', () => {
    expect(checkUploadPath('/My Docs/book.txt')).toEqual({ indexName: 'my-docs' });
    expect(checkUploadPath('plato/republic/BOOK1.MD')).toEqual({ indexName: 'plato' });
  });

  it('rejects a path without a root folder', () => {
    expect(checkUploadPath('/notes.txt')).toEqual({ code: 'NO_ROOT_FOLDER', message: `${LOOSE_FILE_MESSAGE}: /notes.txt` });
    expect(checkUploadPath('notes.txt')).toMatchObject({ code: 'NO_ROOT_FOLDER' });
    expect(checkUploadPath('/')).toMatchObject({ code: 'NO_ROOT_FOLDER' });
  });

  it('rejects hidden and system files anywhere in the path', () => {
    for (const path of ['/docs/.DS_Store', '/docs/Thumbs.db', '/docs/.git/notes.txt', '/.hidden/notes.txt']) {
      expect(checkUploadPath(path)).toEqual({ code: 'IGNORED_FILE', message: `Hidden and system files are not indexed: ${path}` });
    }
  });

  it('rejects other file types, naming the file', () => {
    expect(checkUploadPath('/docs/paper.pdf')).toEqual({
      code: 'UNSUPPORTED_FILE_TYPE',
      message: 'Only .txt and .md files can be indexed: /docs/paper.pdf'
    });
  });

  it('rejects a root folder that makes a bad index name', () => {
    expect(checkUploadPath('/___/a.txt')).toMatchObject({ code: 'INVALID_INDEX_NAME' });
    expect(checkUploadPath(`/${'a'.repeat(46)}/a.txt`)).toMatchObject({ code: 'INDEX_NAME_TOO_LONG' });
  });
});

describe('findIndexNameCollisions', () => {
  it('groups folders that map to the same index', () => {
    expect(findIndexNameCollisions(['My Docs', 'my_docs', 'plato', 'MY-DOCS'])).toEqual(
      new Map([['my-docs', ['My Docs', 'my_docs', 'MY-DOCS']]])
    );
  });

  it('is empty when every folder has its own index', () => {
    expect(findIndexNameCollisions(['plato', 'aristotle'])).toEqual(new Map());
  });
});

describe('prepareDrop', () => {
  it('keeps .txt and .md files, silently skipping hidden and system files', () => {
    const result = prepareDrop([
      folder('/docs', [
        file('/docs/a.txt'),
        file('/docs/b.MD'),
        file('/docs/.DS_Store'),
        file('/docs/Thumbs.db'),
        folder('/docs/.git', [file('/docs/.git/HEAD.txt')]),
        folder('/docs/sub', [file('/docs/sub/c.txt'), file('/docs/sub/desktop.ini')])
      ])
    ]);

    expect(result.error).toBeUndefined();
    expect(result.warnings).toEqual([]);
    expect(paths(result.folders)).toEqual(['/docs', '/docs/a.txt', '/docs/b.MD', '/docs/sub', '/docs/sub/c.txt']);
  });

  it('skips other file types with a warning naming them, and drops folders left empty', () => {
    const result = prepareDrop([
      folder('/docs', [file('/docs/a.txt'), file('/docs/paper.pdf'), folder('/docs/img', [file('/docs/img/x.png')])])
    ]);

    expect(paths(result.folders)).toEqual(['/docs', '/docs/a.txt']);
    expect(result.warnings).toEqual(['Skipped files that are not .txt or .md: /docs/paper.pdf, /docs/img/x.png']);
  });

  it('shortens a long list of skipped files', () => {
    const pdfs = Array.from({ length: 7 }, (_, i) => file(`/docs/${i}.pdf`));
    const { warnings } = prepareDrop([folder('/docs', [file('/docs/a.txt'), ...pdfs])]);

    expect(warnings).toEqual([
      'Skipped files that are not .txt or .md: /docs/0.pdf, /docs/1.pdf, /docs/2.pdf, /docs/3.pdf, /docs/4.pdf and 2 more'
    ]);
  });

  it('rejects a loose file', () => {
    expect(prepareDrop([folder('/docs', [file('/docs/a.txt')]), file('/notes.txt')])).toEqual({
      folders: [],
      warnings: [],
      error: { code: 'LOOSE_FILE', message: 'Drop a folder; its name becomes the index name', filePath: '/notes.txt' }
    });
  });

  it('ignores a loose system file instead of rejecting it', () => {
    const result = prepareDrop([folder('/docs', [file('/docs/a.txt')]), file('/.DS_Store')]);

    expect(result.error).toBeUndefined();
    expect(paths(result.folders)).toEqual(['/docs', '/docs/a.txt']);
  });

  it('rejects a folder whose name makes a bad index name', () => {
    const long = 'a'.repeat(46);
    expect(prepareDrop([folder(`/${long}`, [file(`/${long}/a.txt`)])]).error).toMatchObject({
      code: 'INDEX_NAME_TOO_LONG',
      filePath: `/${long}`
    });
    expect(prepareDrop([folder('/___', [file('/___/a.txt')])]).error).toMatchObject({
      code: 'INVALID_INDEX_NAME',
      filePath: '/___'
    });
  });

  it('warns when folders go into the same index', () => {
    const result = prepareDrop([
      folder('/My Docs', [file('/My Docs/a.txt')]),
      folder('/my_docs', [file('/my_docs/b.txt')])
    ]);

    expect(result.error).toBeUndefined();
    expect(result.folders).toHaveLength(2);
    expect(result.warnings).toEqual(['"My Docs" and "my_docs" both go into the same index, my-docs']);
  });

  it('rejects a drop with no .txt or .md files, keeping the warning', () => {
    const result = prepareDrop([folder('/docs', [file('/docs/paper.pdf'), file('/docs/.DS_Store')])]);

    expect(result.folders).toEqual([]);
    expect(result.warnings).toEqual(['Skipped files that are not .txt or .md: /docs/paper.pdf']);
    expect(result.error).toMatchObject({ code: 'NO_SUPPORTED_FILES' });
  });

  it('skips a dropped dot-folder', () => {
    expect(prepareDrop([folder('/.config', [file('/.config/a.txt')])]).error).toMatchObject({
      code: 'NO_SUPPORTED_FILES'
    });
  });
});
