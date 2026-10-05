export interface FileItem {
  file: File;
  path: string;
  type: 'file';
}

export interface FolderItem {
  name: string;
  path: string;
  type: 'folder';
  children: UploadItem[];
}

export type UploadItem = FileItem | FolderItem;

/** A dropped file or folder the browser could not read. */
export class EntryReadError extends Error {
  constructor(
    readonly path: string,
    cause: unknown
  ) {
    super(`Could not read ${path}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = 'EntryReadError';
  }
}

const readFile = (entry: FileSystemFileEntry): Promise<File> =>
  new Promise((resolve, reject) => {
    entry.file(resolve, (error) => reject(new EntryReadError(entry.fullPath, error)));
  });

const readEntriesBatch = (reader: FileSystemDirectoryReader, path: string): Promise<FileSystemEntry[]> =>
  new Promise((resolve, reject) => {
    reader.readEntries(resolve, (error) => reject(new EntryReadError(path, error)));
  });

/** readEntries returns a folder's children in batches; call it until it returns none. */
const readAllEntries = async (entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> => {
  const reader = entry.createReader();
  const entries: FileSystemEntry[] = [];
  for (;;) {
    const batch = await readEntriesBatch(reader, entry.fullPath);
    if (!batch.length) return entries;
    entries.push(...batch);
  }
};

/**
 * Reads a dropped entry, recursing into folders. Rejects with an EntryReadError
 * naming the path when the browser cannot read a file or folder.
 */
export const processFileEntry = async (entry: FileSystemEntry): Promise<UploadItem> => {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    return { file: await readFile(fileEntry), path: fileEntry.fullPath, type: 'file' };
  }
  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const entries = await readAllEntries(dirEntry);
    return {
      name: dirEntry.name,
      path: dirEntry.fullPath,
      type: 'folder',
      children: await Promise.all(entries.map(processFileEntry))
    };
  }
  throw new EntryReadError(entry.fullPath, new Error('not a file or folder'));
};

export const countFiles = (items: UploadItem[]): number =>
  items.reduce((count, item) => (item.type === 'file' ? count + 1 : count + countFiles(item.children)), 0);

export interface UploadErrorBody {
  message: string;
  code: string;
}

const statusCodes: Record<number, string> = {
  413: 'PAYLOAD_TOO_LARGE',
  504: 'GATEWAY_TIMEOUT'
};

/**
 * Reads the error from a failed upload response. The upload route answers with
 * JSON, but the platform in front of it can answer with an HTML page (413, 504),
 * so a body that isn't JSON falls back to the HTTP status.
 */
export const readUploadError = async (response: Response): Promise<UploadErrorBody> => {
  const fallback = {
    message: `The server responded with ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`,
    code: statusCodes[response.status] ?? 'HTTP_ERROR'
  };
  let data: unknown;
  try {
    data = JSON.parse(await response.text());
  } catch {
    return fallback;
  }
  if (!data || typeof data !== 'object') return fallback;
  const { error, code } = data as { error?: unknown; code?: unknown };
  return {
    message: typeof error === 'string' && error ? error : fallback.message,
    code: typeof code === 'string' && code ? code : fallback.code
  };
};
