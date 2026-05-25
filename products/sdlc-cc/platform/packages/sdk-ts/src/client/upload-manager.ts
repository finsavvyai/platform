// File upload support for the Browser SDLC Client

import type { Document, UploadOptions, UploadProgress } from '../types';
import { SecurityUtils } from '../utils';
import type { AxiosInstance } from 'axios';
import {
  validateFile,
  calculateUploadSpeed,
  calculateTimeRemaining,
} from './file-validation';

/**
 * Upload a single browser File object.
 */
export async function uploadBrowserFile(
  httpClient: AxiosInstance,
  swReg: ServiceWorkerRegistration | undefined,
  file: File,
  options: UploadOptions = {}
): Promise<Document> {
  validateFile(file);

  const formData = new FormData();
  formData.append('file', file, options.name || file.name);

  if (options.metadata) {
    formData.append('metadata', JSON.stringify(options.metadata));
  }
  if (options.tags) {
    formData.append('tags', JSON.stringify(options.tags));
  }
  if (options.chunkSize) {
    formData.append('chunkSize', options.chunkSize.toString());
  }

  if (swReg) {
    swReg.active?.postMessage({
      type: 'uploadStart',
      fileId: SecurityUtils.generateSecureRandom(),
      fileName: file.name,
      fileSize: file.size
    });
  }

  try {
    const response = await httpClient.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-File-Name': encodeURIComponent(file.name),
        'X-File-Size': file.size.toString(),
        'X-File-Type': file.type
      },
      onUploadProgress: options.onProgress
        ? (evt) => {
            const total = evt.total ?? 0;
            if (total > 0) {
              const progress: UploadProgress = {
                loaded: evt.loaded,
                total,
                percentage: Math.round((evt.loaded / total) * 100),
                speed: calculateUploadSpeed({ loaded: evt.loaded, total }),
                timeRemaining: calculateTimeRemaining({ loaded: evt.loaded, total })
              };
              options.onProgress!(progress);
              if (swReg) {
                swReg.active?.postMessage({ type: 'uploadProgress', progress });
              }
            }
          }
        : undefined,
      signal: options.signal
    });

    if (swReg) {
      swReg.active?.postMessage({ type: 'uploadComplete', document: response.data });
    }

    return response.data;
  } catch (error: unknown) {
    if (swReg) {
      swReg.active?.postMessage({
        type: 'uploadError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
    throw error;
  }
}

/**
 * Upload multiple files with concurrency control.
 */
export async function uploadMultipleFiles(
  httpClient: AxiosInstance,
  swReg: ServiceWorkerRegistration | undefined,
  files: FileList | File[],
  options: {
    onProgress?: (fileIndex: number, progress: UploadProgress) => void;
    onFileComplete?: (fileIndex: number, document: Document) => void;
    onAllComplete?: (documents: Document[]) => void;
    concurrency?: number;
    signal?: AbortSignal;
  } = {}
): Promise<Document[]> {
  const fileArray = Array.from(files);
  const concurrency = options.concurrency || 3;
  const documents: Document[] = [];

  for (let i = 0; i < fileArray.length; i += concurrency) {
    const batch = fileArray.slice(i, i + concurrency);
    const promises = batch.map(async (file, idx) => {
      const doc = await uploadBrowserFile(httpClient, swReg, file, {
        onProgress: (progress: UploadProgress) => {
          options.onProgress?.(i + idx, progress);
        },
        signal: options.signal
      });
      options.onFileComplete?.(i + idx, doc);
      return doc;
    });

    const results = await Promise.allSettled(promises);
    results.forEach((r) => {
      if (r.status === 'fulfilled') documents.push(r.value);
    });
  }

  options.onAllComplete?.(documents);
  return documents;
}
