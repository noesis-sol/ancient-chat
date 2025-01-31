'use client';

import {useCallback, useState} from 'react';
import {File, Folder, Upload, X} from 'lucide-react';

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

const FileUploadComponent = () => {
    const [files, setFiles] = useState<UploadItem[]>([]);
    const [isDragging, setIsDragging] = useState(false);

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
        <div className="w-full max-w-2xl mx-auto p-4">
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
                    <h3 className="text-lg font-semibold mb-3">Uploaded Files</h3>
                    <div className="bg-base-200 rounded-lg p-4">
                        {renderFileTree(files)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileUploadComponent;