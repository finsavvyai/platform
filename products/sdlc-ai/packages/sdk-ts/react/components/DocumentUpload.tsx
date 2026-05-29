// Document Upload Component for React

import React, { useState, useRef, useCallback } from 'react';
import { useDocuments } from '../hooks/useDocuments';

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
    'text/markdown'
  ],
  maxFileSize = 100 * 1024 * 1024, // 100MB
  maxFiles = 10,
  multiple = false,
  className = '',
  children
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadDocument } = useDocuments();

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).slice(0, maxFiles);

    for (const file of fileArray) {
      // Validate file type
      if (!acceptedTypes.includes(file.type)) {
        const error = new Error(`File type ${file.type} is not supported`);
        onUploadError?.(error);
        continue;
      }

      // Validate file size
      if (file.size > maxFileSize) {
        const error = new Error(`File size exceeds maximum of ${maxFileSize / 1024 / 1024}MB`);
        onUploadError?.(error);
        continue;
      }

      try {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

        const document = await uploadDocument(file, {
          onProgress: (progress) => {
            setUploadProgress(prev => ({ ...prev, [file.name]: progress.percentage }));
          }
        });

        onUploadComplete?.(document);
      } catch (error) {
        onUploadError?.(error as Error);
      } finally {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[file.name];
          return newProgress;
        });
      }
    }
  }, [acceptedTypes, maxFileSize, maxFiles, uploadDocument, onUploadComplete, onUploadError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const openFileDialog = useCallback(() => {
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

        {children || (
          <div>
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="mt-4">
              <p className="text-lg text-gray-900">
                Drop {multiple ? 'files' : 'a file'} here, or click to select
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {acceptedTypes.join(', ')} up to {maxFileSize / 1024 / 1024}MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Upload Progress */}
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
