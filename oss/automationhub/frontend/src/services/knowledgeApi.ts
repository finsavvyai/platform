import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

// Types
export interface Document {
  id: string;
  title: string;
  content: string;
  metadata: any;
  owner_id: string;
  file_path?: string;
  file_size?: number;
  mime_type?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  chunk_count?: number;
  embedding_status?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface KnowledgeChunk {
  id: string;
  document_id: string;
  chunk_text: string;
  chunk_index: number;
  embedding_id?: string;
  metadata: any;
  created_at: string;
}

export interface DocumentUpload {
  file: File;
  title?: string;
  description?: string;
  tags?: string[];
  metadata?: any;
}

export interface CreateDocumentRequest {
  title: string;
  content: string;
  metadata?: any;
  tags?: string[];
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
  metadata?: any;
  is_active?: boolean;
}

export interface SearchRequest {
  query: string;
  limit?: number;
  filters?: {
    tags?: string[];
    mime_type?: string;
    date_range?: {
      start: string;
      end: string;
    };
  };
}

export interface SearchResult {
  document_id: string;
  document_title: string;
  chunk_text: string;
  score: number;
  metadata: any;
}

export interface DocumentProcessingStatus {
  document_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  chunks_processed: number;
  total_chunks: number;
  error_message?: string;
}

// API functions
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Document API calls
export const fetchDocuments = async (): Promise<Document[]> => {
  const response = await api.get('/documents');
  return response.data;
};

export const fetchDocument = async (id: string): Promise<Document> => {
  const response = await api.get(`/documents/${id}`);
  return response.data;
};

export const createDocument = async (data: CreateDocumentRequest): Promise<Document> => {
  const response = await api.post('/documents', data);
  return response.data;
};

export const updateDocument = async (id: string, data: UpdateDocumentRequest): Promise<Document> => {
  const response = await api.put(`/documents/${id}`, data);
  return response.data;
};

export const deleteDocument = async (id: string): Promise<void> => {
  await api.delete(`/documents/${id}`);
};

export const uploadDocument = async (uploadData: DocumentUpload): Promise<Document> => {
  const formData = new FormData();
  formData.append('file', uploadData.file);
  
  if (uploadData.title) {
    formData.append('title', uploadData.title);
  }
  if (uploadData.description) {
    formData.append('description', uploadData.description);
  }
  if (uploadData.tags) {
    formData.append('tags', JSON.stringify(uploadData.tags));
  }
  if (uploadData.metadata) {
    formData.append('metadata', JSON.stringify(uploadData.metadata));
  }

  const response = await api.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const downloadDocument = async (id: string): Promise<Blob> => {
  const response = await api.get(`/documents/${id}/download`, {
    responseType: 'blob',
  });
  return response.data;
};

// Knowledge chunks API calls
export const fetchDocumentChunks = async (documentId: string): Promise<KnowledgeChunk[]> => {
  const response = await api.get(`/documents/${documentId}/chunks`);
  return response.data;
};

export const searchKnowledgeBase = async (searchData: SearchRequest): Promise<SearchResult[]> => {
  const response = await api.post('/knowledge/search', searchData);
  return response.data;
};

// Document processing API calls
export const processDocument = async (id: string): Promise<DocumentProcessingStatus> => {
  const response = await api.post(`/documents/${id}/process`);
  return response.data;
};

export const getProcessingStatus = async (id: string): Promise<DocumentProcessingStatus> => {
  const response = await api.get(`/documents/${id}/processing-status`);
  return response.data;
};

export const reprocessDocument = async (id: string): Promise<DocumentProcessingStatus> => {
  const response = await api.post(`/documents/${id}/reprocess`);
  return response.data;
};

// React Query hooks
export const useDocuments = () => {
  return useQuery('documents', fetchDocuments, {
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });
};

export const useDocument = (id: string) => {
  return useQuery(['document', id], () => fetchDocument(id), {
    enabled: !!id,
  });
};

export const useCreateDocument = () => {
  const queryClient = useQueryClient();
  
  return useMutation(createDocument, {
    onSuccess: () => {
      queryClient.invalidateQueries('documents');
    },
  });
};

export const useUpdateDocument = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    ({ id, data }: { id: string; data: UpdateDocumentRequest }) => 
      updateDocument(id, data),
    {
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries('documents');
        queryClient.invalidateQueries(['document', id]);
      },
    }
  );
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();
  
  return useMutation(deleteDocument, {
    onSuccess: () => {
      queryClient.invalidateQueries('documents');
    },
  });
};

export const useUploadDocument = () => {
  const queryClient = useQueryClient();
  
  return useMutation(uploadDocument, {
    onSuccess: () => {
      queryClient.invalidateQueries('documents');
    },
  });
};

export const useDocumentChunks = (documentId: string) => {
  return useQuery(
    ['document-chunks', documentId],
    () => fetchDocumentChunks(documentId),
    {
      enabled: !!documentId,
    }
  );
};

export const useSearchKnowledgeBase = () => {
  return useMutation(searchKnowledgeBase);
};

export const useProcessDocument = () => {
  const queryClient = useQueryClient();
  
  return useMutation(processDocument, {
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries('documents');
      queryClient.invalidateQueries(['document', documentId]);
      queryClient.invalidateQueries(['document-chunks', documentId]);
    },
  });
};

export const useProcessingStatus = (documentId: string) => {
  return useQuery(
    ['processing-status', documentId],
    () => getProcessingStatus(documentId),
    {
      enabled: !!documentId,
      refetchInterval: 2000, // Refresh every 2 seconds for active processing
    }
  );
};

export const useReprocessDocument = () => {
  const queryClient = useQueryClient();
  
  return useMutation(reprocessDocument, {
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries('documents');
      queryClient.invalidateQueries(['document', documentId]);
      queryClient.invalidateQueries(['document-chunks', documentId]);
      queryClient.invalidateQueries(['processing-status', documentId]);
    },
  });
};

// Utility functions
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getDocumentIcon = (mimeType?: string) => {
  if (!mimeType) return 'description';
  
  if (mimeType.startsWith('text/')) return 'text_snippet';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video_file';
  if (mimeType.startsWith('audio/')) return 'audio_file';
  if (mimeType.includes('pdf')) return 'picture_as_pdf';
  if (mimeType.includes('word')) return 'description';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'table_chart';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'slideshow';
  
  return 'description';
};

export const getEmbeddingStatusColor = (status?: string) => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'processing':
      return 'warning';
    case 'failed':
      return 'error';
    case 'pending':
      return 'info';
    default:
      return 'default';
  }
};

export const extractTextFromFile = async (file: File): Promise<string> => {
  // This is a simplified version - in production, you'd use proper text extraction libraries
  if (file.type.startsWith('text/')) {
    return await file.text();
  }
  
  // For other file types, you'd need to implement proper extraction
  // This could use PDF.js for PDFs, mammoth for DOCX, etc.
  return `File content extraction not implemented for ${file.type}`;
};

export default api;
