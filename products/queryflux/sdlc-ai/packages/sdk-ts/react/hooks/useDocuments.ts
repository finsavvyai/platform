// Documents hook for React

import { useState, useEffect, useCallback } from 'react';
import { useSDLC } from '../providers/SDLCProvider';
import { Document, DocumentType, UploadOptions } from '../../types';

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
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const loadDocuments = useCallback(async () => {
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

  const uploadDocument = useCallback(async (
    file: File | Blob,
    uploadOptions?: UploadOptions
  ) => {
    if (!client) throw new Error('Client not initialized');

    setError(null);

    try {
      const document = await client.documents.upload(file, uploadOptions);
      setDocuments(prev => [document, ...prev]);
      setTotalCount(prev => prev + 1);
      return document;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [client]);

  const updateDocument = useCallback(async (
    id: string,
    data: { name?: string; metadata?: Record<string, any>; tags?: string[] }
  ) => {
    if (!client) throw new Error('Client not initialized');

    setError(null);

    try {
      const updated = await client.documents.update(id, data);
      setDocuments(prev => prev.map(doc => doc.id === id ? updated : doc));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [client]);

  const deleteDocument = useCallback(async (id: string) => {
    if (!client) throw new Error('Client not initialized');

    setError(null);

    try {
      await client.documents.delete(id);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      setTotalCount(prev => prev - 1);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [client]);

  const getDocument = useCallback(async (id: string) => {
    if (!client) throw new Error('Client not initialized');

    setError(null);

    try {
      return await client.documents.get(id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [client]);

  const downloadDocument = useCallback(async (id: string) => {
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

  const refresh = useCallback(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
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
