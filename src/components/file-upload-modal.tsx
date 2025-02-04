'use client';
import {useCallback, useState} from 'react';
import {File, Folder, Plus, Upload, X} from 'lucide-react';

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
    const [uploadProgress, setUploadProgress] = useState<string>('');

    const processFileEntry = async (entry: FileSystemEntry): Promise<UploadItem> => {
        if (entry.isFile) {
            const fileEntry = entry as FileSystemFileEntry;
            return new Promise((resolve) => {
                fileEntry.file(file => {
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
                reader.readEntries(async (entries) => {
                    const filesInFolder = await Promise.all(
                        entries.map(entry => processFileEntry(entry))
                    );
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

    const handleDrop = useCallback(async (e: React.DragEvent) => {
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
        setFiles(prev => [...prev, ...uploadedFiles]);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const removeFile = (path: string) => {
        setFiles(prev => prev.filter(file => file.path !== path));
    };

    const handleUpload = async () => {
        try {
            const processItems = async (items: UploadItem[]) => {
                for (const item of items) {
                    if (item.type === 'file') {
                        setUploadProgress(`Processing ${item.path}...`);

                        // Create FormData for file upload
                        const formData = new FormData();
                        formData.append('file', item.file);
                        formData.append('path', item.path);
                        formData.append('filename', item.file.name);
                        formData.append('type', item.file.type);

                        // Send file to backend
                        const response = await fetch('/api/indexes/upload', {
                            method: 'POST',
                            body: formData,
                        });

                        if (!response.ok) {
                            throw new Error(`Failed to upload ${item.path}`);
                        }

                        setUploadProgress(`Uploaded ${item.path}`);
                    } else if (item.type === 'folder') {
                        // Recursively process folder contents
                        await processItems(item.children);
                    }
                }
            };

            await processItems(files);

            // Close modal and reset state
            const modalElement = document.getElementById('index-upload-modal') as HTMLDialogElement;
            if (modalElement) {
                modalElement.close();
            }
            setFiles([]);
            setUploadProgress('');

            // Show success message
            alert('Files successfully uploaded!');
        } catch (error) {
            console.error('Error uploading files:', error);
            alert('Error uploading files. Please try again.');
            setUploadProgress('');
        }
    };

    const renderFileTree = (items: UploadItem[], level = 0) => {
        return items.map((item) => (
            <div
                key={item.path}
                className="flex flex-col"
                style={{marginLeft: `${level * 20}px`}}
            >
                <div className="flex items-center gap-2 py-1">
                    {item.type === 'folder' ? (
                        <Folder className="w-4 h-4"/>
                    ) : (
                        <File className="w-4 h-4"/>
                    )}
                    <span className="flex-1">{item.path}</span>
                    <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => removeFile(item.path)}
                    >
                        <X className="w-4 h-4"/>
                    </button>
                </div>
                {item.type === 'folder' && renderFileTree(item.children, level + 1)}
            </div>
        ));
    };

    return (
        <>
            <button
                className="btn btn-primary"
                onClick={() => {
                    const modalElement = document.getElementById('index-upload-modal') as HTMLDialogElement;
                    if (modalElement) {
                        modalElement.showModal();
                    }
                }}
            >
                <Plus className="w-4 h-4 mr-2"/>
                Add new indexes
            </button>
            <dialog id="index-upload-modal" className="modal">
                <div className="modal-box max-w-3xl">
                    <h3 className="font-bold text-lg">Upload Files</h3>
                    <div className="mt-4">
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
                            <Upload className="w-12 h-12 text-base-content opacity-50 mb-4"/>
                            <p className="text-base-content text-center">
                                Drag and drop files or folders here
                            </p>
                            <p className="text-sm text-base-content opacity-70 mt-2">
                                Supports multiple files and nested folders
                            </p>
                        </div>
                        {files.length > 0 && (
                            <div className="mt-6">
                                <h3 className="text-lg font-semibold mb-3">Selected Files</h3>
                                <div className="bg-base-200 rounded-lg p-4 max-h-[200px] overflow-y-auto">
                                    {renderFileTree(files)}
                                </div>
                            </div>
                        )}
                        {uploadProgress && (
                            <div className="mt-4">
                                <p className="text-sm text-base-content">{uploadProgress}</p>
                            </div>
                        )}
                        <div className="modal-action">
                            <form method="dialog">
                                <button className="btn btn-ghost mr-2">Cancel</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleUpload}
                                    disabled={files.length === 0}
                                    type="button"
                                >
                                    Upload Files
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
        </>
    );
};

export default IndexUploadModal;