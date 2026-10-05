// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IndexUploadModal from './file-upload-modal';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const fileEntry = (fullPath: string): FileSystemEntry =>
  ({
    isFile: true,
    isDirectory: false,
    name: fullPath.split('/').pop(),
    fullPath,
    file: (success: FileCallback) => success(new File([fullPath], fullPath.split('/').pop()!))
  }) as unknown as FileSystemEntry;

const dirEntry = (fullPath: string, children: FileSystemEntry[]): FileSystemEntry =>
  ({
    isFile: false,
    isDirectory: true,
    name: fullPath.split('/').pop(),
    fullPath,
    createReader: () => {
      const pending = [children, []];
      return { readEntries: (success: FileSystemEntriesCallback) => success(pending.shift() ?? []) };
    }
  }) as unknown as FileSystemEntry;

let container: HTMLDivElement;
let root: Root;

const drop = async (entries: FileSystemEntry[]) => {
  const dropZone = container.querySelector('.border-dashed')!;
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { items: entries.map((entry) => ({ webkitGetAsEntry: () => entry })) }
  });
  await act(async () => {
    dropZone.dispatchEvent(event);
  });
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const uploadButton = (): HTMLButtonElement =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Upload Files')!;

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<IndexUploadModal />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('IndexUploadModal upload rules', () => {
  it('lists only the .txt and .md files of a folder and warns about the rest', async () => {
    await drop([
      dirEntry('/My Docs', [
        fileEntry('/My Docs/a.txt'),
        fileEntry('/My Docs/b.md'),
        fileEntry('/My Docs/.DS_Store'),
        fileEntry('/My Docs/paper.pdf')
      ])
    ]);

    const text = container.textContent;
    expect(text).toContain('/My Docs/a.txt');
    expect(text).toContain('/My Docs/b.md');
    expect(text).toContain('index: my-docs');
    expect(text).not.toContain('.DS_Store');
    expect(container.querySelector('.alert-warning')?.textContent).toContain(
      'Skipped files that are not .txt or .md: /My Docs/paper.pdf'
    );
    expect(container.querySelector('.alert-error')).toBeNull();
    expect(uploadButton().disabled).toBe(false);
  });

  it('rejects a loose file', async () => {
    await drop([fileEntry('/notes.txt')]);

    const alertBox = container.querySelector('.alert-error');
    expect(alertBox?.textContent).toContain('Drop a folder; its name becomes the index name');
    expect(alertBox?.textContent).toContain('File: /notes.txt');
    expect(container.textContent).toContain('Drag and drop folders here');
    expect(uploadButton().disabled).toBe(true);
  });

  it('rejects a folder whose name is too long for an index', async () => {
    const name = 'a'.repeat(46);
    await drop([dirEntry(`/${name}`, [fileEntry(`/${name}/a.txt`)])]);

    expect(container.querySelector('.alert-error')?.textContent).toContain(
      'makes an index name of 46 characters; the limit is 45'
    );
    expect(container.textContent).not.toContain(`/${name}/a.txt`);
  });

  it('warns when two folders go into the same index', async () => {
    await drop([
      dirEntry('/My Docs', [fileEntry('/My Docs/a.txt')]),
      dirEntry('/my_docs', [fileEntry('/my_docs/b.txt')])
    ]);

    expect(container.querySelector('.alert-warning')?.textContent).toContain(
      '"My Docs" and "my_docs" both go into the same index, my-docs'
    );
    expect(uploadButton().disabled).toBe(false);
  });
});
