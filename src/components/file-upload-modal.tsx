'use client';
import { File, Folder, Plus, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface FileItem {
  file: File;
  path: string;
  type: 'file';
}

interface FolderItem {
  name: string;
  path: string;
  type: 'folder';
  children: (FileItem | FolderItem)[];
}

type UploadItem = FileItem | FolderItem;

const IndexUploadModal = () => {
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [totalSize, setTotalSize] = useState<number>(0);
  const [uploadedSize, setUploadedSize] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const calculateTotalSize = (items: UploadItem[]): number => {
    return items.reduce((total, item) => {
      if (item.type === 'file') {
        return total + item.file.size;
      } else {
        return total + calculateTotalSize(item.children);
      }
    }, 0);
  };

  useEffect(() => {
    if (files.length > 0) {
      const total = calculateTotalSize(files);
      setTotalSize(total);
    } else {
      setTotalSize(0);
      setUploadedSize(0);
      setUploadProgress(0);
      setCurrentFile('');
      setShowProgress(false);
    }
  }, [files]);

  const processFileEntry = async (entry: FileSystemEntry): Promise<UploadItem> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      return new Promise((resolve) => {
        fileEntry.file((file) => {
          resolve({
            file,
            path: fileEntry.fullPath,
            type: 'file'
          });
        });
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      return new Promise((resolve) => {
        const readAllEntries = async (entries: FileSystemEntry[] = []): Promise<FileSystemEntry[]> => {
          const newEntries = await new Promise<FileSystemEntry[]>((resolve) => {
            reader.readEntries((results) => resolve(results));
          });

          if (newEntries.length) {
            entries.push(...newEntries);
            return readAllEntries(entries);
          }
          return entries;
        };

        readAllEntries().then(async (entries) => {
          const filesInFolder = await Promise.all(entries.map((entry) => processFileEntry(entry)));
          resolve({
            name: dirEntry.name,
            path: dirEntry.fullPath,
            type: 'folder',
            children: filesInFolder
          });
        });
      });
    }
    throw new Error('Invalid entry type');
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (files.length > 0) return; // Disable drop if files exist
      e.preventDefault();
      setIsDragging(false);
      const items = e.dataTransfer.items;
      const uploadedFiles: UploadItem[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry();
        if (item) {
          const result = await processFileEntry(item);
          uploadedFiles.push(result);
        }
      }
      setFiles((prev) => [...prev, ...uploadedFiles]);
    },
    [files]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (files.length > 0) return; // Disable drag over if files exist
      e.preventDefault();
      setIsDragging(true);
    },
    [files]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = (path: string) => {
    const removeRecursively = (items: UploadItem[]): UploadItem[] => {
      return items.reduce((acc: UploadItem[], item) => {
        if (item.path === path) {
          return acc;
        }
        if (item.type === 'folder') {
          return [
            ...acc,
            {
              ...item,
              children: removeRecursively(item.children)
            }
          ];
        }
        return [...acc, item];
      }, []);
    };

    setFiles((prev) => removeRecursively(prev));
  };

  const countFiles = (items: UploadItem[]): number => {
    return items.reduce((count, item) => (item.type === 'file' ? count + 1 : count + countFiles(item.children)), 0);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCancelUpload = async () => {
    if (confirm('Are you sure you want to cancel the upload?')) {
      try {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      } catch (error) {
        console.error('Error during abort:', error);
      }
      setIsUploading(false);
      setShowProgress(false);
      setUploadProgress(0);
      setCurrentFile('');
      setUploadedSize(0);
      alert('Upload cancelled');
    }
  };

  const handleUpload = async () => {
    setIsUploading(true);
    setShowProgress(true);
    abortControllerRef.current = new AbortController();

    try {
      const processItems = async (items: UploadItem[]) => {
        let processed = 0;
        const totalFiles = countFiles(items);

        const processItem = async (item: UploadItem) => {
          try {
            if (abortControllerRef.current?.signal.aborted) {
              throw new Error('Upload cancelled');
            }

            if (item.type === 'file') {
              setCurrentFile(item.path);

              const formData = new FormData();
              formData.append('file', item.file);
              formData.append('path', item.path);
              formData.append('filename', item.file.name);
              formData.append('type', item.file.type);

              const response = await fetch('/api/indexes/upload', {
                method: 'POST',
                body: formData,
                signal: abortControllerRef.current?.signal
              });

              if (!response.ok) {
                throw new Error(`Failed to upload ${item.path}`);
              }

              processed++;
              setUploadedSize((prev) => prev + item.file.size);
              setUploadProgress((processed / totalFiles) * 100);
            } else if (item.type === 'folder') {
              for (const child of item.children) {
                await processItem(child);
              }
            }
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
              throw new Error('Upload cancelled');
            }
            throw error;
          }
        };

        for (const item of items) {
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error('Upload cancelled');
          }
          await processItem(item);
        }
      };

      await processItems(files);

      const modalElement = document.getElementById('index-upload-modal') as HTMLDialogElement;
      if (modalElement) {
        modalElement.close();
      }
      setFiles([]);
      setCurrentFile('');
      setUploadProgress(0);
      setUploadedSize(0);
      setIsUploading(false);
      setShowProgress(false);
      abortControllerRef.current = null;

      alert('Files successfully uploaded!');
    } catch (error) {
      console.error('Error uploading files:', error);
      if ((error as Error).message !== 'Upload cancelled') {
        alert('Error uploading files. Please try again.');
      }
      setUploadProgress(0);
      setCurrentFile('');
      setUploadedSize(0);
      setIsUploading(false);
      setShowProgress(false);
      abortControllerRef.current = null;
    }
  };

  const renderFileTree = (items: UploadItem[], level = 0) => {
    return items.map((item) => (
      <div key={item.path} className='flex flex-col' style={{ marginLeft: `${level * 20}px` }}>
        <div className='flex items-center gap-2 py-1'>
          {item.type === 'folder' ? <Folder className='w-4 h-4' /> : <File className='w-4 h-4' />}
          <span className='flex-1'>{item.path}</span>
          <button className='btn btn-ghost btn-xs' onClick={() => removeFile(item.path)}>
            <X className='w-4 h-4' />
          </button>
        </div>
        {item.type === 'folder' && renderFileTree(item.children, level + 1)}
      </div>
    ));
  };

  return (
    <>
      <button
        className='btn btn-primary'
        onClick={() => {
          const modalElement = document.getElementById('index-upload-modal') as HTMLDialogElement;
          if (modalElement) {
            modalElement.showModal();
          }
        }}
      >
        <Plus className='w-4 h-4 mr-2' />
        Add new indexes
      </button>
      <dialog
        id='index-upload-modal'
        className='modal'
        onClose={(e) => {
          if (isUploading) {
            e.preventDefault();
          }
        }}
      >
        <div className='modal-box max-w-3xl'>
          <h3 className='font-bold text-lg'>Upload Files</h3>
          <div className='mt-4'>
            {files.length === 0 ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  border-2 border-dashed rounded-lg p-8
                  flex flex-col items-center justify-center
                  min-h-[200px] w-full
                  transition-colors duration-200
                  ${isDragging ? 'border-primary bg-base-200' : 'border-base-300'}
                `}
              >
                <Upload className='w-12 h-12 text-base-content opacity-50 mb-4' />
                <p className='text-base-content text-center'>Drag and drop files or folders here</p>
                <p className='text-sm text-base-content opacity-70 mt-2'>Supports multiple files and nested folders</p>
              </div>
            ) : (
              <div className='mt-6'>
                <h3 className='text-lg font-semibold mb-3'>Selected Files</h3>
                <div className='bg-base-200 rounded-lg p-4 max-h-[200px] overflow-y-auto'>{renderFileTree(files)}</div>
                <button className='btn btn-ghost btn-sm mt-4' onClick={() => setFiles([])} disabled={isUploading}>
                  <X className='w-4 h-4 mr-2' />
                  Clear all files
                </button>
              </div>
            )}
            {showProgress && (
              <div className='mt-4 space-y-2'>
                <progress className='progress progress-primary w-full' value={uploadProgress} max='100'></progress>
                <div className='flex justify-between text-sm'>
                  <span className='text-base-content'>{currentFile}</span>
                  <span className='text-base-content'>
                    {formatBytes(uploadedSize)} / {formatBytes(totalSize)}
                  </span>
                </div>
              </div>
            )}
            <div className='modal-action'>
              <form
                method='dialog'
                onSubmit={(e) => {
                  if (isUploading) {
                    e.preventDefault();
                  }
                }}
              >
                <button
                  className='btn btn-ghost mr-2'
                  type='button'
                  onClick={() => {
                    if (isUploading) {
                      handleCancelUpload();
                    } else {
                      const modalElement = document.getElementById('index-upload-modal') as HTMLDialogElement;
                      if (modalElement) {
                        modalElement.close();
                      }
                    }
                  }}
                >
                  {isUploading ? 'Cancel Upload' : 'Cancel'}
                </button>
                <button
                  className='btn btn-primary'
                  onClick={handleUpload}
                  disabled={files.length === 0 || isUploading}
                  type='button'
                >
                  {isUploading ? 'Uploading...' : 'Upload Files'}
                </button>
              </form>
            </div>
          </div>
        </div>
        {!isUploading && (
          <form method='dialog' className='modal-backdrop'>
            <button>close</button>
          </form>
        )}
      </dialog>
    </>
  );
};

export default IndexUploadModal;
