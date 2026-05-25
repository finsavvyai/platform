// Documents hook for React

import * as React from 'react';
import { useSDLC } from '../providers/SDLCProvider';
import type { Document, DocumentType, UploadOptions } from '../../types';

interface UseDocumentsOptions {
  autoLoad?: boolean;
  search?: string;
  type?: DocumentType;
  tags?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useDocuments(options: UseDocumentsOptions = {}) {
  const { client } = useSDLC();
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [totalCount, setTotalCount] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);

  const loadDocuments = React.useCallback(async () => {
    if (!client) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await client.documents.list({
        page,
        pageSize,
        search: options.search,
        type: options.type,
        tags: options.tags,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder
      });

      setDocuments(response.items);
      setTotalCount(response.total);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [client, page, pageSize, options]);

  const uploadDocument = React.useCallback(async (
    file: File | Blob,
    uploadOptions?: UploadOptions
  ) => {
    if (!client) throw new Error('Client not initialized');

    setError(null);

    try {
      const doc = await client.documents.upload(file, uploadOptions);
      setDocuments((prev: Document[]) => [doc, ...prev]);
      setTotalCount((prev: number) => prev + 1);
      return doc;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [client]);

  const updateDocument = React.useCallback(async (
    id: string,
    data: { name?: string; metadata?: Record<string, unknown>; tags?: string[] }
  ) => {
    if (!client) throw new Error('Client not initialized');

    setError(null);

    try {
      const updated = await client.documents.update(id, data);
      setDocuments((prev: Document[]) => prev.map((doc: Document) => doc.id === id ? updated : doc));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [client]);

  const deleteDocument = React.useCallback(async (id: string) => {
    if (!client) throw new Error('Client not initialized');

    setError(null);

    try {
      await client.documents.delete(id);
      setDocuments((prev: Document[]) => prev.filter((doc: Document) => doc.id !== id));
      setTotalCount((prev: number) => prev - 1);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [client]);

  const getDocument = React.useCallback(async (id: string) => {
    if (!client) throw new Error('Client not initialized');

    setError(null);

    try {
      return await client.documents.get(id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [client]);

  const downloadDocument = React.useCallback(async (id: string) => {
    if (!client) throw new Error('Client not initialized');

    setError(null);

    try {
      const url = await client.documents.downloadUrl(id);
      const a = document.createElement('a');
      a.href = url;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [client]);

  const refresh = React.useCallback(() => {
    loadDocuments();
  }, [loadDocuments]);

  React.useEffect(() => {
    if (options.autoLoad !== false) {
      loadDocuments();
    }
  }, [loadDocuments, options.autoLoad]);

  return {
    documents,
    isLoading,
    error,
    totalCount,
    page,
    setPage,
    pageSize,
    uploadDocument,
    updateDocument,
    deleteDocument,
    getDocument,
    downloadDocument,
    refresh,
    clearError: () => setError(null)
  };
}
