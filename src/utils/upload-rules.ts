import { sanitizeIndexName } from './index-upload';
import type { FolderItem, UploadItem } from './upload-files';

/** Pinecone rejects longer index names. */
export const MAX_INDEX_NAME_LENGTH = 45;

/** Only plain text is indexed: the route reads every file with file.text(). */
export const SUPPORTED_EXTENSIONS = ['.txt', '.md'];

/** OS files that turn up inside dropped folders. Dotfiles are ignored as well. */
const JUNK_FILES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);

export const LOOSE_FILE_MESSAGE = 'Drop a folder; its name becomes the index name';

export interface UploadRuleError {
  code: string;
  message: string;
}

/** Dotfiles, dot-folders and OS junk such as .DS_Store, Thumbs.db and desktop.ini. */
export const isIgnoredName = (name: string): boolean => name.startsWith('.') || JUNK_FILES.has(name.toLowerCase());

/** Whether a file name ends in .txt or .md, in any case. */
export const isSupportedFile = (name: string): boolean => {
  const lower = name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => lower.endsWith(extension) && lower.length > extension.length);
};

/** Turns a folder name into an index name, or explains why it cannot be one. */
export const checkIndexName = (folderName: string): { indexName: string } | UploadRuleError => {
  const indexName = sanitizeIndexName(folderName);
  if (!indexName) {
    return {
      code: 'INVALID_INDEX_NAME',
      message: `The folder name "${folderName}" has no letters or digits to make an index name from`
    };
  }
  if (indexName.length > MAX_INDEX_NAME_LENGTH) {
    return {
      code: 'INDEX_NAME_TOO_LONG',
      message: `The folder name "${folderName}" makes an index name of ${indexName.length} characters; the limit is ${MAX_INDEX_NAME_LENGTH}`
    };
  }
  return { indexName };
};

/**
 * Checks an uploaded file's path, which starts with the dropped folder: a .txt or
 * .md file inside a folder, with no hidden or system file or folder on the way.
 * Returns the index the folder's name maps to.
 */
export const checkUploadPath = (path: string): { indexName: string } | UploadRuleError => {
  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2) {
    return { code: 'NO_ROOT_FOLDER', message: `${LOOSE_FILE_MESSAGE}: ${path || '(no path)'}` };
  }
  if (segments.some(isIgnoredName)) {
    return { code: 'IGNORED_FILE', message: `Hidden and system files are not indexed: ${path}` };
  }
  if (!isSupportedFile(segments[segments.length - 1])) {
    return {
      code: 'UNSUPPORTED_FILE_TYPE',
      message: `Only ${SUPPORTED_EXTENSIONS.join(' and ')} files can be indexed: ${path}`
    };
  }
  return checkIndexName(segments[0]);
};

/** Index names that more than one folder maps to, with those folders' names. */
export const findIndexNameCollisions = (folderNames: string[]): Map<string, string[]> => {
  const byIndex = new Map<string, string[]>();
  for (const name of folderNames) {
    const indexName = sanitizeIndexName(name);
    byIndex.set(indexName, [...(byIndex.get(indexName) ?? []), name]);
  }
  return new Map([...byIndex].filter(([, names]) => names.length > 1));
};

export interface PreparedDrop {
  folders: FolderItem[];
  warnings: string[];
  error?: UploadRuleError & { filePath?: string };
}

const MAX_LISTED_FILES = 5;

const listPaths = (paths: string[]): string =>
  paths.length > MAX_LISTED_FILES
    ? `${paths.slice(0, MAX_LISTED_FILES).join(', ')} and ${paths.length - MAX_LISTED_FILES} more`
    : paths.join(', ');

/**
 * Keeps the .txt and .md files of a dropped folder. Hidden and system files are
 * left out silently, other files with a warning naming them, and folders left
 * empty are dropped.
 */
const filterFolder = (folder: FolderItem, unsupported: string[]): FolderItem => ({
  ...folder,
  children: folder.children.flatMap((child): UploadItem[] => {
    if (isIgnoredName(child.type === 'file' ? child.file.name : child.name)) return [];
    if (child.type === 'folder') {
      const filtered = filterFolder(child, unsupported);
      return filtered.children.length ? [filtered] : [];
    }
    if (!isSupportedFile(child.file.name)) {
      unsupported.push(child.path);
      return [];
    }
    return [child];
  })
});

/**
 * Applies the upload rules to what was dropped on the modal: folders only, each
 * named so it makes a valid index name, holding only .txt and .md files. Returns
 * the folders to upload and warnings to show, or an error that rejects the drop.
 */
export const prepareDrop = (items: UploadItem[]): PreparedDrop => {
  const reject = (error: PreparedDrop['error']): PreparedDrop => ({ folders: [], warnings: [], error });
  const dropped = items.filter((item) => !isIgnoredName(item.type === 'file' ? item.file.name : item.name));

  const looseFile = dropped.find((item) => item.type === 'file');
  if (looseFile) {
    return reject({ code: 'LOOSE_FILE', message: LOOSE_FILE_MESSAGE, filePath: looseFile.path });
  }

  const unsupported: string[] = [];
  const folders: FolderItem[] = [];
  for (const item of dropped as FolderItem[]) {
    const check = checkIndexName(item.name);
    if ('code' in check) return reject({ ...check, filePath: item.path });
    const folder = filterFolder(item, unsupported);
    if (folder.children.length) folders.push(folder);
  }

  const warnings: string[] = [];
  if (unsupported.length) {
    warnings.push(`Skipped files that are not ${SUPPORTED_EXTENSIONS.join(' or ')}: ${listPaths(unsupported)}`);
  }
  for (const [indexName, names] of findIndexNameCollisions(folders.map((folder) => folder.name))) {
    const quoted = names.map((name) => `"${name}"`).join(' and ');
    warnings.push(`${quoted} ${names.length === 2 ? 'both' : 'all'} go into the same index, ${indexName}`);
  }

  if (!folders.length) {
    return {
      folders,
      warnings,
      error: {
        code: 'NO_SUPPORTED_FILES',
        message: `The dropped folders hold no ${SUPPORTED_EXTENSIONS.join(' or ')} files to upload`
      }
    };
  }
  return { folders, warnings };
};
