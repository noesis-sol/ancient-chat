'use client';
import { sanitizeIndexName } from '@/utils/index-upload';
import { countFiles, EntryReadError, processFileEntry, readUploadError, type UploadItem } from '@/utils/upload-files';
import { FILE_TOO_LARGE_MESSAGE, prepareDrop, SUPPORTED_EXTENSIONS } from '@/utils/upload-rules';
import { File, Folder, Plus, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ErrorState {
  message: string;
  code: string;
  filePath?: string;
}

const calculateTotalSize = (items: UploadItem[]): number => {
  return items.reduce((total, item) => {
    if (item.type === 'file') {
      return total + item.file.size;
    } else {
      return total + calculateTotalSize(item.children);
    }
  }, 0);
};

const IndexUploadModal = () => {
  const router = useRouter();
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [totalSize, setTotalSize] = useState<number>(0);
  const [uploadedSize, setUploadedSize] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (files.length > 0) {
      const total = calculateTotalSize(files);
      setTotalSize(total);
    } else {
      resetUploadState();
    }
  }, [files]);

  const resetUploadState = () => {
    setTotalSize(0);
    setUploadedSize(0);
    setUploadProgress(0);
    setCurrentFile('');
    setShowProgress(false);
  };

  const handleErrorResponse = async (response: Response, filePath: string) => {
    setError({ ...(await readUploadError(response)), filePath });
    setIsUploading(false);
    setShowProgress(false);
    throw new Error('Upload failed');
  };

  const dismissError = () => {
    setError(null);
  };

  const getErrorMessage = ({ code, message }: ErrorState): string => {
    const errorMessages: Record<string, string> = {
      NO_FILE: 'No file was provided for upload',
      NO_PATH: 'File path is required',
      FILE_TOO_LARGE: FILE_TOO_LARGE_MESSAGE,
      EMPTY_FILE: 'File is empty',
      PINECONE_CONNECTION_ERROR: 'Unable to connect to the database',
      INDEX_CREATION_TIMEOUT: 'Timeout while creating the index',
      INDEX_CREATION_ERROR: 'Failed to create the index',
      BATCH_PROCESSING_ERROR: 'Failed to process and upload document batch',
      PAYLOAD_TOO_LARGE: 'The file is larger than the server accepts',
      GATEWAY_TIMEOUT: 'The server took too long to respond',
      UNKNOWN_ERROR: 'An unexpected error occurred'
    };

    return errorMessages[code] || message || 'An unexpected error occurred';
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (files.length > 0) return; // Disable drop if files exist
      e.preventDefault();
      setIsDragging(false);
      setNotice(null);
      setWarnings([]);
      // Take the entries now: the DataTransfer is emptied once the handler yields.
      const entries = Array.from(e.dataTransfer.items)
        .map((item) => item.webkitGetAsEntry())
        .filter((entry) => entry !== null);
      try {
        const { folders, warnings, error } = prepareDrop(await Promise.all(entries.map(processFileEntry)));
        setWarnings(warnings);
        if (error) {
          setError(error);
          return;
        }
        setFiles((prev) => [...prev, ...folders]);
      } catch (readError) {
        console.error('Error reading dropped files:', readError);
        setError({
          message: readError instanceof Error ? readError.message : 'The dropped files could not be read',
          code: 'READ_ERROR',
          filePath: readError instanceof EntryReadError ? readError.path : undefined
        });
      }
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

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCancelUpload = () => {
    setConfirmingCancel(false);
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
    setNotice('Upload cancelled');
  };

  const closeModal = () => {
    const modalElement = document.getElementById('index-upload-modal') as HTMLDialogElement;
    if (modalElement) {
      modalElement.close();
    }
  };

  const handleUpload = async () => {
    if (error) return; // Don't start upload if there's an error
    setIsUploading(true);
    setShowProgress(true);
    setError(null);
    setNotice(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let processed = 0;

    try {
      // Resolves true only when every file was uploaded; a failed file throws.
      const processItems = async (items: UploadItem[]): Promise<boolean> => {
        const totalFiles = countFiles(items);

        const processItem = async (item: UploadItem) => {
          try {
            if (controller.signal.aborted) {
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
                signal: controller.signal
              });

              if (!response.ok) {
                await handleErrorResponse(response, item.path);
                return;
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
          if (controller.signal.aborted) {
            throw new Error('Upload cancelled');
          }
          await processItem(item);
        }

        return processed === totalFiles && !controller.signal.aborted;
      };

      const succeeded = await processItems(files);

      if (succeeded) {
        closeModal();
        setFiles([]);
        resetUploadState();
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      if ((error as Error).message !== 'Upload cancelled') {
        // Keep the specific error handleErrorResponse already set, if any.
        setError(
          (prev) =>
            prev ?? {
              message: 'Failed to upload files',
              code: 'UPLOAD_ERROR'
            }
        );
      }
      setShowProgress(false);
    } finally {
      setIsUploading(false);
      setConfirmingCancel(false);
      // Show the indexes the uploaded files created, even when a later file failed.
      if (processed > 0) {
        router.refresh();
      }
      // A cancelled run must not clear the controller of an upload started after it.
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const renderFileTree = (items: UploadItem[], level = 0) => {
    return items.map((item) => (
      <div
        key={item.path}
        className={`flex flex-col ${isUploading ? 'opacity-50' : ''}`}
        style={{ marginLeft: `${level * 20}px` }}
      >
        <div className='flex items-center gap-2 py-1'>
          {item.type === 'folder' ? <Folder className='w-4 h-4' /> : <File className='w-4 h-4' />}
          <span className='flex-1'>{item.path}</span>
          {item.type === 'folder' && level === 0 && (
            <span className='badge badge-ghost badge-sm'>index: {sanitizeIndexName(item.name)}</span>
          )}
          <button
            className='btn btn-ghost btn-xs'
            onClick={() => removeFile(item.path)}
            disabled={isUploading}
            aria-disabled={isUploading}
          >
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
        // Esc fires cancel (close isn't cancelable). Blocking the keydown as well
        // covers browsers that stop letting cancel be prevented on repeated Esc.
        onKeyDown={(e) => {
          if (isUploading && e.key === 'Escape') {
            e.preventDefault();
          }
        }}
        onCancel={(e) => {
          if (isUploading) {
            e.preventDefault();
          }
        }}
      >
        <div className='modal-box max-w-3xl'>
          <h3 className='font-bold text-lg'>Upload Files</h3>
          <div className='mt-4'>
            {error && (
              <div role='alert' className='alert alert-error mb-4'>
                <div className='flex-1'>
                  <h3 className='font-bold'>Error</h3>
                  <div className='text-sm'>
                    {getErrorMessage(error)}
                    {error.filePath && <p className='mt-1'>File: {error.filePath}</p>}
                  </div>
                </div>
                <button className='btn btn-ghost btn-sm' onClick={dismissError}>
                  <X className='w-4 h-4' />
                </button>
              </div>
            )}

            {warnings.length > 0 && (
              <div role='status' className='alert alert-warning mb-4'>
                <ul className='flex-1 text-sm'>
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
                <button className='btn btn-ghost btn-sm' onClick={() => setWarnings([])}>
                  <X className='w-4 h-4' />
                </button>
              </div>
            )}

            {notice && (
              <div role='status' className='alert alert-info mb-4'>
                <span className='flex-1'>{notice}</span>
                <button className='btn btn-ghost btn-sm' onClick={() => setNotice(null)}>
                  <X className='w-4 h-4' />
                </button>
              </div>
            )}

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
                <p className='text-base-content text-center'>Drag and drop folders here</p>
                <p className='text-sm text-base-content opacity-70 mt-2 text-center'>
                  Each folder becomes an index named after it. Only {SUPPORTED_EXTENSIONS.join(' and ')} files are
                  uploaded.
                </p>
              </div>
            ) : (
              <div className='mt-6'>
                <h3 className='text-lg font-semibold mb-3'>Selected Files</h3>
                <div className='bg-base-200 rounded-lg p-4 max-h-[200px] overflow-y-auto'>{renderFileTree(files)}</div>
                <button
                  className='btn btn-ghost btn-sm mt-4'
                  onClick={() => {
                    setFiles([]);
                    setWarnings([]);
                  }}
                  disabled={isUploading}
                >
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

            {isUploading && confirmingCancel && (
              <div role='alert' className='alert alert-warning mt-4'>
                <span className='flex-1'>Cancel the upload? Files already uploaded stay in their indexes.</span>
                <button className='btn btn-ghost btn-sm' type='button' onClick={() => setConfirmingCancel(false)}>
                  Keep uploading
                </button>
                <button className='btn btn-warning btn-sm' type='button' onClick={handleCancelUpload}>
                  Cancel upload
                </button>
              </div>
            )}

            <div className='modal-action'>
              <form method='dialog'>
                <button
                  className='btn btn-ghost mr-2'
                  type='button'
                  onClick={() => {
                    if (isUploading) {
                      setConfirmingCancel(true);
                    } else {
                      closeModal();
                    }
                  }}
                  disabled={isUploading && confirmingCancel}
                >
                  {isUploading ? 'Cancel Upload' : 'Cancel'}
                </button>
                <button
                  className='btn btn-primary'
                  onClick={handleUpload}
                  disabled={files.length === 0 || isUploading || error !== null}
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
