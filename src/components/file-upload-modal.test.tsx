// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import IndexUploadModal from './file-upload-modal';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

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
    file: (success: FileCallback) => success(new File([fullPath], fullPath.split('/').pop()!, { type: 'text/plain' }))
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

/** Lets the upload loop run: every fetch, state update and re-render inside act. */
const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });

let container: HTMLDivElement;
let root: Root;
let fetchMock: Mock<typeof fetch>;
let closeMock: Mock<() => void>;

const button = (label: string): HTMLButtonElement => {
  const match = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  if (!match) throw new Error(`No button labelled ${label}`);
  return match;
};

const dropFolder = async () => {
  const entry = dirEntry('/docs', [fileEntry('/docs/a.txt'), fileEntry('/docs/b.txt'), fileEntry('/docs/c.txt')]);
  const dropZone = container.querySelector('.border-dashed')!;
  const drop = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(drop, 'dataTransfer', { value: { items: [{ webkitGetAsEntry: () => entry }] } });
  await act(async () => {
    dropZone.dispatchEvent(drop);
  });
  await settle();
};

const upload = async () => {
  await act(async () => {
    button('Upload Files').click();
  });
  await settle();
};

beforeEach(() => {
  refresh.mockReset();
  closeMock = vi.fn();
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = closeMock;
  vi.stubGlobal('alert', vi.fn());
  vi.stubGlobal('confirm', vi.fn());
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
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

describe('IndexUploadModal', () => {
  it('lists the files of a dropped folder', async () => {
    await dropFolder();
    for (const path of ['/docs', '/docs/a.txt', '/docs/b.txt', '/docs/c.txt']) {
      expect(container.textContent).toContain(path);
    }
    expect(button('Upload Files').disabled).toBe(false);
  });

  it('uploads every file, then clears the list and closes the modal', async () => {
    fetchMock.mockImplementation(async () => Response.json({ ok: true }));
    await dropFolder();
    await upload();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const paths = fetchMock.mock.calls.map(([, init]) => (init?.body as FormData).get('path'));
    expect(paths).toEqual(['/docs/a.txt', '/docs/b.txt', '/docs/c.txt']);
    expect(button('Upload Files')).toBeTruthy();
    expect(container.textContent).not.toContain('Uploading...');
    expect(container.textContent).not.toContain('/docs/a.txt');
    expect(container.textContent).toContain('Drag and drop files or folders here');
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role=alert]')).toBeNull();
    expect(alert).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('stops at a failed file, shows its error and keeps the modal open', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json({ error: 'too big', code: 'FILE_TOO_LARGE' }, { status: 500 }))
      .mockResolvedValue(Response.json({ ok: true }));
    await dropFolder();
    await upload();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const alertBox = container.querySelector('[role=alert]');
    expect(alertBox?.textContent).toContain('File size exceeds the maximum limit of 10MB');
    expect(alertBox?.textContent).toContain('File: /docs/b.txt');
    expect(button('Upload Files')).toBeTruthy();
    expect(button('Cancel').disabled).toBe(false);
    expect(button('Clear all files').disabled).toBe(false);
    expect(closeMock).not.toHaveBeenCalled();
    for (const path of ['/docs/a.txt', '/docs/b.txt', '/docs/c.txt']) {
      expect(container.textContent).toContain(path);
    }
    // The first file reached its index, so the list behind the modal refreshes.
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });
});
