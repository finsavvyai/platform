// Document Upload Component for React

import * as React from 'react';
import { useDocuments } from '../hooks/useDocuments';
import type { UploadProgress } from '../../types';

interface DocumentUploadProps {
  onUploadComplete?: (document: any) => void;
  onUploadError?: (error: Error) => void;
  acceptedTypes?: string[];
  maxFileSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function DocumentUpload({
  onUploadComplete,
  onUploadError,
  acceptedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
  ],
  maxFileSize = 100 * 1024 * 1024,
  maxFiles = 10,
  multiple = false,
  className = '',
  children,
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<{
    [key: string]: number;
  }>({});
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { uploadDocument } = useDocuments();

  const handleFiles = React.useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).slice(0, maxFiles);

      for (const file of fileArray) {
        if (!acceptedTypes.includes(file.type)) {
          const error = new Error(
            `File type ${file.type} is not supported`,
          );
          onUploadError?.(error);
          continue;
        }

        if (file.size > maxFileSize) {
          const error = new Error(
            `File size exceeds maximum of ${maxFileSize / 1024 / 1024}MB`,
          );
          onUploadError?.(error);
          continue;
        }

        try {
          setUploadProgress((prev: Record<string, number>) => ({
            ...prev,
            [file.name]: 0,
          }));

          const doc = await uploadDocument(file, {
            file,
            onProgress: (progress: UploadProgress) => {
              setUploadProgress((prev: Record<string, number>) => ({
                ...prev,
                [file.name]: progress.percentage,
              }));
            },
          });

          onUploadComplete?.(doc);
        } catch (error) {
          onUploadError?.(error as Error);
        } finally {
          setUploadProgress((prev: Record<string, number>) => {
            const newProgress = { ...prev };
            delete newProgress[file.name];
            return newProgress;
          });
        }
      }
    },
    [
      acceptedTypes,
      maxFileSize,
      maxFiles,
      uploadDocument,
      onUploadComplete,
      onUploadError,
    ],
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles],
  );

  const openFileDialog = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className={className}>
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          multiple={multiple}
          onChange={handleFileInput}
          className="hidden"
        />

        {children ?? (
          <div>
            <div className="mt-4">
              <p className="text-lg text-gray-900">
                Drop {multiple ? 'files' : 'a file'} here, or click to select
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {acceptedTypes.join(', ')} up to{' '}
                {maxFileSize / 1024 / 1024}MB
              </p>
            </div>
          </div>
        )}
      </div>

      {Object.entries(uploadProgress).map(([fileName, progress]) => (
        <div key={fileName} className="mt-2">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{fileName}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
