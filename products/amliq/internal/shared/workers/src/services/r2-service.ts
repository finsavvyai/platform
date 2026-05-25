/**
 * AI-Enhanced R2 Storage Service
 * Revolutionary file handling and document storage with intelligent processing
 */

import type { Env } from '../types';

export interface FileUploadOptions {
  bucket?: 'documents' | 'evidence' | 'templates';
  metadata?: Record<string, any>;
  tags?: string[];
  aiProcess?: boolean;
  aiExtract?: boolean;
  aiAnalyze?: boolean;
  compress?: boolean;
  encrypt?: boolean;
  expiresIn?: number; // TTL for temporary files
}

export interface FileInfo {
  key: string;
  bucket: string;
  size: number;
  contentType: string;
  etag: string;
  uploaded: string;
  metadata: Record<string, any>;
  tags: string[];
  aiProcessed: boolean;
  checksum: string;
  encryptionKeyId?: string;
}

export interface AIFileAnalysis {
  documentType: string;
  confidence: number;
  extractedText?: string;
  entities?: Array<{
    type: string;
    value: string;
    confidence: number;
    position?: { x: number; y: number; width: number; height: number };
  }>;
  summary?: string;
  language?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  topics?: string[];
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  complianceFlags?: string[];
  suggestedTags?: string[];
  recommendedActions?: string[];
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  variables: Array<{
    name: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'select';
    required: boolean;
    options?: string[];
    validation?: {
      pattern?: string;
      minLength?: number;
      maxLength?: number;
      min?: number;
      max?: number;
    };
  }>;
  template: string; // Template content with variable placeholders
  aiGenerated: boolean;
  aiOptimized: boolean;
  usageCount: number;
  averageRating: number;
  lastUsed: string;
  metadata: Record<string, any>;
}

export class R2Service {
  private env: Env;
  private aiEnabled: boolean;

  constructor(env: Env) {
    this.env = env;
    this.aiEnabled = true; // AI enabled for document processing
  }

  // AI-Enhanced File Upload
  async uploadFile(
    file: File | ArrayBuffer | Uint8Array | ReadableStream,
    filename: string,
    options: FileUploadOptions = {}
  ): Promise<{ success: boolean; file?: FileInfo; error?: string; analysis?: AIFileAnalysis }> {
    try {
      const {
        bucket = 'documents',
        metadata = {},
        tags = [],
        aiProcess = true,
        aiExtract = true,
        aiAnalyze = true,
        compress = false,
        encrypt = false,
        expiresIn
      } = options;

      // Generate unique key
      const key = this.generateFileKey(filename, bucket);
      const bucketInstance = this.getBucket(bucket);

      if (!bucketInstance) {
        return { success: false, error: 'Invalid bucket specified' };
      }

      // Process file data
      let fileData: ArrayBuffer | Uint8Array | ReadableStream;
      let contentType = 'application/octet-stream';
      let size = 0;

      if (file instanceof File) {
        fileData = await file.arrayBuffer();
        contentType = file.type || this.guessContentType(filename);
        size = file.size;
      } else if (file instanceof ArrayBuffer) {
        fileData = file;
        size = file.byteLength;
        contentType = metadata.contentType || this.guessContentType(filename);
      } else if (file instanceof Uint8Array) {
        fileData = file;
        size = file.length;
        contentType = metadata.contentType || this.guessContentType(filename);
      } else {
        // ReadableStream - we need to process it differently
        fileData = file;
        // For streams, we'll get size from upload response
      }

      // AI file compression
      if (compress && this.aiEnabled && typeof fileData !== 'ReadableStream') {
        const compressedData = await this.aiCompressFile(fileData as ArrayBuffer, contentType);
        if (compressedData.data.length < (fileData as ArrayBuffer).byteLength) {
          fileData = compressedData.data;
          metadata.originalSize = (fileData as ArrayBuffer).byteLength;
          metadata.compressionRatio = compressedData.ratio;
          size = compressedData.data.byteLength;
        }
      }

      // File encryption
      if (encrypt) {
        const encryptedData = await this.encryptFile(fileData);
        fileData = encryptedData.data;
        metadata.encrypted = true;
        metadata.encryptionKeyId = encryptedData.keyId;
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(fileData);

      // Prepare upload metadata
      const uploadMetadata: Record<string, any> = {
        originalFilename: filename,
        uploadedAt: new Date().toISOString(),
        organizationId: metadata.organizationId || 'unknown',
        userId: metadata.userId || 'anonymous',
        contentType,
        tags: tags.join(','),
        checksum,
        aiProcessed: false,
        ...metadata
      };

      // Upload to R2
      const uploadOptions: R2PutOptions = {
        customMetadata: uploadMetadata,
        httpMetadata: {
          contentType,
          cacheControl: expiresIn ? `max-age=${expiresIn}` : 'public, max-age=31536000'
        }
      };

      const uploadResult = await bucketInstance.put(key, fileData, uploadOptions);

      if (!uploadResult) {
        return { success: false, error: 'Upload failed' };
      }

      const fileInfo: FileInfo = {
        key: uploadResult.key,
        bucket,
        size: uploadResult.size || size,
        contentType,
        etag: uploadResult.etag || '',
        uploaded: uploadResult.uploaded?.toISOString() || new Date().toISOString(),
        metadata: uploadMetadata,
        tags,
        aiProcessed: false,
        checksum,
        encryptionKeyId: metadata.encryptionKeyId
      };

      // AI processing (async)
      let aiAnalysis: AIFileAnalysis | undefined;
      if (aiProcess && this.aiEnabled) {
        // Process asynchronously to avoid blocking upload
        this.processFileWithAI(fileInfo, { extract: aiExtract, analyze: aiAnalyze })
          .then(analysis => {
            if (analysis) {
              this.updateFileMetadata(fileInfo.key, bucket, {
                aiProcessed: true,
                aiAnalysis: analysis
              });
            }
          })
          .catch(error => {
            console.error('AI processing failed:', error);
          });
      }

      return {
        success: true,
        file: fileInfo,
        analysis: aiAnalysis
      };
    } catch (error) {
      console.error('File upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // File Download with Decryption
  async downloadFile(
    key: string,
    bucket: 'documents' | 'evidence' | 'templates' = 'documents',
    range?: { start: number; end?: number }
  ): Promise<{ success: boolean; data?: ReadableStream; file?: FileInfo; error?: string }> {
    try {
      const bucketInstance = this.getBucket(bucket);
      if (!bucketInstance) {
        return { success: false, error: 'Invalid bucket specified' };
      }

      const object = await bucketInstance.head(key);
      if (!object) {
        return { success: false, error: 'File not found' };
      }

      const getOptions: R2GetOptions = {};
      if (range) {
        getOptions.range = range;
      }

      const file = await bucketInstance.get(key, getOptions);

      if (!file) {
        return { success: false, error: 'Failed to retrieve file' };
      }

      let processedData = file.body;

      // Decrypt if needed
      if (object.customMetadata?.encrypted === 'true') {
        const decryptedData = await this.decryptFile(file.body!, object.customMetadata.encryptionKeyId);
        processedData = decryptedData;
      }

      const fileInfo: FileInfo = {
        key: file.key || key,
        bucket,
        size: file.size || object.size,
        contentType: file.httpMetadata?.contentType || object.customMetadata?.contentType || 'application/octet-stream',
        etag: file.etag || object.etag || '',
        uploaded: file.uploaded?.toISOString() || new Date().toISOString(),
        metadata: object.customMetadata || {},
        tags: (object.customMetadata?.tags || '').split(',').filter(Boolean),
        aiProcessed: object.customMetadata?.aiProcessed === 'true',
        checksum: object.customMetadata?.checksum || '',
        encryptionKeyId: object.customMetadata?.encryptionKeyId
      };

      return {
        success: true,
        data: processedData,
        file: fileInfo
      };
    } catch (error) {
      console.error('File download failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // AI-Powered Document Search
  async searchDocuments(
    query: string,
    bucket: 'documents' | 'evidence' | 'templates' = 'documents',
    options: {
      limit?: number;
      filters?: Record<string, any>;
      includeContent?: boolean;
      semanticSearch?: boolean;
    } = {}
  ): Promise<{ success: boolean; results?: Array<FileInfo & { relevanceScore?: number; excerpt?: string }>; error?: string }> {
    try {
      const { limit = 20, filters = {}, includeContent = false, semanticSearch = this.aiEnabled } = options;
      const bucketInstance = this.getBucket(bucket);

      if (!bucketInstance) {
        return { success: false, error: 'Invalid bucket specified' };
      }

      // List objects with filtering
      const list = await bucketInstance.list({
        limit: limit * 5, // Get more to filter and rank
        prefix: filters.prefix || ''
      });

      let candidates = list.objects.filter(obj => {
        // Apply metadata filters
        if (filters.organizationId && obj.customMetadata?.organizationId !== filters.organizationId) {
          return false;
        }
        if (filters.contentType && !obj.customMetadata?.contentType?.includes(filters.contentType)) {
          return false;
        }
        if (filters.tags && !filters.tags.some((tag: string) => obj.customMetadata?.tags?.includes(tag))) {
          return false;
        }
        return true;
      });

      // AI-powered semantic search if enabled
      if (semanticSearch && this.aiEnabled) {
        candidates = await this.rankDocumentsByRelevance(query, candidates.slice(0, limit * 2));
      } else {
        // Simple text-based search fallback
        candidates = candidates.filter(obj =>
          obj.key.toLowerCase().includes(query.toLowerCase()) ||
          obj.customMetadata?.originalFilename?.toLowerCase().includes(query.toLowerCase())
        );
      }

      // Get file details and excerpts
      const results = [];
      for (const obj of candidates.slice(0, limit)) {
        const fileInfo: FileInfo = {
          key: obj.key,
          bucket,
          size: obj.size,
          contentType: obj.customMetadata?.contentType || 'application/octet-stream',
          etag: obj.etag,
          uploaded: obj.uploaded?.toISOString() || new Date().toISOString(),
          metadata: obj.customMetadata || {},
          tags: (obj.customMetadata?.tags || '').split(',').filter(Boolean),
          aiProcessed: obj.customMetadata?.aiProcessed === 'true',
          checksum: obj.customMetadata?.checksum || ''
        };

        let relevanceScore: number | undefined;
        let excerpt: string | undefined;

        if (semanticSearch && this.aiEnabled) {
          relevanceScore = (obj as any).relevanceScore;
        }

        if (includeContent && this.isTextFile(fileInfo.contentType)) {
          excerpt = await this.generateExcerpt(fileInfo, query);
        }

        results.push({
          ...fileInfo,
          relevanceScore,
          excerpt
        });
      }

      return { success: true, results };
    } catch (error) {
      console.error('Document search failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Template Management
  async createTemplate(
    template: Omit<DocumentTemplate, 'id' | 'usageCount' | 'averageRating' | 'lastUsed'>
  ): Promise<{ success: boolean; templateId?: string; error?: string }> {
    try {
      const templateId = `template_${Date.now()}_${crypto.randomUUID()}`;
      const templateData: DocumentTemplate = {
        ...template,
        id: templateId,
        usageCount: 0,
        averageRating: 0.0,
        lastUsed: new Date().toISOString()
      };

      const key = `templates/${templateId}.json`;
      const bucketInstance = this.getBucket('templates');

      if (!bucketInstance) {
        return { success: false, error: 'Templates bucket not available' };
      }

      await bucketInstance.put(key, JSON.stringify(templateData, null, 2), {
        customMetadata: {
          type: 'template',
          category: template.category,
          name: template.name,
          aiGenerated: template.aiGenerated.toString(),
          createdAt: new Date().toISOString()
        }
      });

      return { success: true, templateId };
    } catch (error) {
      console.error('Template creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getTemplate(templateId: string): Promise<{ success: boolean; template?: DocumentTemplate; error?: string }> {
    try {
      const key = `templates/${templateId}.json`;
      const bucketInstance = this.getBucket('templates');

      if (!bucketInstance) {
        return { success: false, error: 'Templates bucket not available' };
      }

      const templateFile = await bucketInstance.get(key);
      if (!templateFile) {
        return { success: false, error: 'Template not found' };
      }

      const templateData = JSON.parse(await templateFile.text()) as DocumentTemplate;

      return { success: true, template: templateData };
    } catch (error) {
      console.error('Template retrieval failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async listTemplates(
    category?: string,
    limit: number = 20
  ): Promise<{ success: boolean; templates?: DocumentTemplate[]; error?: string }> {
    try {
      const bucketInstance = this.getBucket('templates');
      if (!bucketInstance) {
        return { success: false, error: 'Templates bucket not available' };
      }

      const list = await bucketInstance.list({
        prefix: 'templates/',
        limit: limit * 2
      });

      const templates: DocumentTemplate[] = [];

      for (const obj of list.objects) {
        if (obj.customMetadata?.type !== 'template') continue;
        if (category && obj.customMetadata?.category !== category) continue;

        const templateFile = await bucketInstance.get(obj.key);
        if (templateFile) {
          const templateData = JSON.parse(await templateFile.text()) as DocumentTemplate;
          templates.push(templateData);
        }
      }

      // Sort by usage and rating
      templates.sort((a, b) => {
        const scoreA = a.usageCount * a.averageRating;
        const scoreB = b.usageCount * b.averageRating;
        return scoreB - scoreA;
      });

      return { success: true, templates: templates.slice(0, limit) };
    } catch (error) {
      console.error('Template listing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Document Generation from Template
  async generateDocument(
    templateId: string,
    variables: Record<string, any>,
    options: {
      format?: 'pdf' | 'docx' | 'html' | 'txt';
      bucket?: 'documents' | 'evidence';
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{ success: boolean; document?: FileInfo; error?: string }> {
    try {
      const templateResult = await this.getTemplate(templateId);
      if (!templateResult.success || !templateResult.template) {
        return { success: false, error: 'Template not found' };
      }

      const template = templateResult.template;
      const { format = 'html', bucket = 'documents', metadata = {} } = options;

      // Validate required variables
      const missingVars = template.variables
        .filter(v => v.required && !variables[v.name])
        .map(v => v.name);

      if (missingVars.length > 0) {
        return { success: false, error: `Missing required variables: ${missingVars.join(', ')}` };
      }

      // Generate document content
      let content = template.template;
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        content = content.replace(new RegExp(placeholder, 'g'), String(value));
      }

      // Convert to requested format
      let finalContent: string | ArrayBuffer;
      let contentType: string;

      switch (format) {
        case 'html':
          finalContent = this.wrapInHTML(content, template.name);
          contentType = 'text/html';
          break;
        case 'txt':
          finalContent = content;
          contentType = 'text/plain';
          break;
        case 'pdf':
          finalContent = await this.convertToPDF(content);
          contentType = 'application/pdf';
          break;
        case 'docx':
          finalContent = await this.convertToDocx(content);
          contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          break;
        default:
          finalContent = content;
          contentType = 'text/plain';
      }

      const filename = `${template.name}_${Date.now()}.${format}`;
      const uploadResult = await this.uploadFile(
        finalContent,
        filename,
        {
          bucket,
          metadata: {
            ...metadata,
            templateId,
            generatedFrom: template.name,
            variables: JSON.stringify(variables),
            contentType
          },
          tags: ['generated', template.category],
          aiProcess: true
        }
      );

      if (uploadResult.success) {
        // Update template usage
        template.usageCount++;
        template.lastUsed = new Date().toISOString();
        await this.updateTemplateUsage(templateId, template);
      }

      return uploadResult;
    } catch (error) {
      console.error('Document generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // File Management Operations
  async deleteFile(
    key: string,
    bucket: 'documents' | 'evidence' | 'templates' = 'documents'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const bucketInstance = this.getBucket(bucket);
      if (!bucketInstance) {
        return { success: false, error: 'Invalid bucket specified' };
      }

      await bucketInstance.delete(key);
      return { success: true };
    } catch (error) {
      console.error('File deletion failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getFileMetadata(
    key: string,
    bucket: 'documents' | 'evidence' | 'templates' = 'documents'
  ): Promise<{ success: boolean; metadata?: FileInfo; error?: string }> {
    try {
      const bucketInstance = this.getBucket(bucket);
      if (!bucketInstance) {
        return { success: false, error: 'Invalid bucket specified' };
      }

      const object = await bucketInstance.head(key);
      if (!object) {
        return { success: false, error: 'File not found' };
      }

      const fileInfo: FileInfo = {
        key,
        bucket,
        size: object.size,
        contentType: object.customMetadata?.contentType || 'application/octet-stream',
        etag: object.etag || '',
        uploaded: object.uploaded?.toISOString() || new Date().toISOString(),
        metadata: object.customMetadata || {},
        tags: (object.customMetadata?.tags || '').split(',').filter(Boolean),
        aiProcessed: object.customMetadata?.aiProcessed === 'true',
        checksum: object.customMetadata?.checksum || '',
        encryptionKeyId: object.customMetadata?.encryptionKeyId
      };

      return { success: true, metadata: fileInfo };
    } catch (error) {
      console.error('Metadata retrieval failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Private helper methods
  private getBucket(bucket: string): R2Bucket | null {
    switch (bucket) {
      case 'documents': return this.env.DOCUMENTS;
      case 'evidence': return this.env.EVIDENCE;
      case 'templates': return this.env.TEMPLATES;
      default: return null;
    }
  }

  private generateFileKey(filename: string, bucket: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uuid = crypto.randomUUID().substring(0, 8);
    const extension = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
    const baseName = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_');

    return `${bucket}/${timestamp}/${uuid}_${baseName}${extension}`;
  }

  private guessContentType(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'zip': 'application/zip',
      'csv': 'text/csv',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  private isTextFile(contentType: string): boolean {
    return contentType.startsWith('text/') ||
           contentType.includes('json') ||
           contentType.includes('xml') ||
           contentType.includes('csv');
  }

  private async calculateChecksum(data: ArrayBuffer | Uint8Array | ReadableStream): Promise<string> {
    if (data instanceof ReadableStream) {
      // For streams, we'll use a simple hash of the stream properties
      return `stream_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }

    const buffer = data instanceof ArrayBuffer ? data : data.buffer;
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async aiCompressFile(data: ArrayBuffer, contentType: string): Promise<{ data: ArrayBuffer; ratio: number }> {
    if (!this.aiEnabled) {
      return { data, ratio: 1.0 };
    }

    try {
      // For text files, use AI to identify and remove redundant content
      if (this.isTextFile(contentType)) {
        const text = new TextDecoder().decode(data);
        const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [{
            role: 'user',
            content: `Compress this text while preserving all essential information. Remove redundancy, whitespace, and optimize for storage:
            ${text.substring(0, 10000)}${text.length > 10000 ? '...' : ''}

            Return only the compressed text.`
          }],
          temperature: 0.1,
          max_tokens: Math.min(text.length, 8000)
        });

        if (response?.response) {
          const compressedText = response.response;
          const compressedData = new TextEncoder().encode(compressedText).buffer;
          const ratio = compressedData.byteLength / data.byteLength;

          return { data: compressedData, ratio };
        }
      }

      return { data, ratio: 1.0 };
    } catch (error) {
      console.error('AI compression failed:', error);
      return { data, ratio: 1.0 };
    }
  }

  private async encryptFile(data: ArrayBuffer | Uint8Array | ReadableStream): Promise<{ data: Uint8Array; keyId: string }> {
    // Simple encryption implementation - in production, use proper key management
    const keyId = `key_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;

    if (data instanceof ReadableStream) {
      const reader = data.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      data = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }
    }

    const buffer = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    const encrypted = new Uint8Array(buffer.length);

    // Simple XOR encryption for demonstration
    const key = new TextEncoder().encode(keyId);
    for (let i = 0; i < buffer.length; i++) {
      encrypted[i] = buffer[i] ^ key[i % key.length];
    }

    return { data: encrypted, keyId };
  }

  private async decryptFile(data: ReadableStream, keyId: string): Promise<ReadableStream> {
    // Simple decryption implementation matching the encryption
    const reader = data.getReader();

    return new ReadableStream({
      async start(controller) {
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        // Combine chunks and decrypt
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const encrypted = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          encrypted.set(chunk, offset);
          offset += chunk.length;
        }

        const key = new TextEncoder().encode(keyId);
        const decrypted = new Uint8Array(encrypted.length);
        for (let i = 0; i < encrypted.length; i++) {
          decrypted[i] = encrypted[i] ^ key[i % key.length];
        }

        controller.enqueue(decrypted);
        controller.close();
      }
    });
  }

  private async processFileWithAI(
    fileInfo: FileInfo,
    options: { extract: boolean; analyze: boolean }
  ): Promise<AIFileAnalysis | null> {
    if (!this.aiEnabled) return null;

    try {
      const { extract, analyze } = options;
      const downloadResult = await this.downloadFile(fileInfo.key, fileInfo.bucket as any);

      if (!downloadResult.success || !downloadResult.data) {
        return null;
      }

      const analysis: AIFileAnalysis = {
        documentType: 'unknown',
        confidence: 0.0
      };

      // AI text extraction
      if (extract && this.isTextFile(fileInfo.contentType)) {
        const text = await this.extractTextFromFile(downloadResult.data, fileInfo.contentType);
        analysis.extractedText = text;

        // AI analysis of extracted text
        if (analyze && text) {
          const textAnalysis = await this.analyzeTextContent(text);
          Object.assign(analysis, textAnalysis);
        }
      }

      // AI image/document analysis
      if (analyze && fileInfo.contentType.startsWith('image/')) {
        const imageAnalysis = await this.analyzeImageContent(downloadResult.data);
        Object.assign(analysis, imageAnalysis);
      }

      return analysis;
    } catch (error) {
      console.error('AI file processing failed:', error);
      return null;
    }
  }

  private async extractTextFromFile(data: ReadableStream, contentType: string): Promise<string> {
    // Simple text extraction for text files
    // In production, integrate with proper OCR and document processing services
    const reader = data.getReader();
    const decoder = new TextDecoder();
    let text = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }

    return text;
  }

  private async analyzeTextContent(text: string): Promise<Partial<AIFileAnalysis>> {
    if (!this.aiEnabled) return {};

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{
          role: 'user',
          content: `Analyze this text content and provide structured information:
          ${text.substring(0, 2000)}${text.length > 2000 ? '...' : ''}

          Return JSON with:
          - documentType: string
          - confidence: number (0-1)
          - summary: string (brief)
          - language: string (ISO code)
          - sentiment: "positive" | "negative" | "neutral"
          - topics: string[]
          - riskLevel: "low" | "medium" | "high" | "critical"
          - complianceFlags: string[]
          - suggestedTags: string[]
          - recommendedActions: string[]
          - entities: array of {type, value, confidence}`
        }],
        temperature: 0.2,
        max_tokens: 800
      });

      return response?.response ? JSON.parse(response.response) : {};
    } catch (error) {
      console.error('Text analysis failed:', error);
      return {};
    }
  }

  private async analyzeImageContent(data: ReadableStream): Promise<Partial<AIFileAnalysis>> {
    // Image analysis would require specialized AI models
    // For now, return basic analysis
    return {
      documentType: 'image',
      confidence: 0.9,
      suggestedTags: ['image', 'visual_content']
    };
  }

  private async rankDocumentsByRelevance(query: string, objects: R2Object[]): Promise<R2Object[]> {
    if (!this.aiEnabled || objects.length === 0) {
      return objects;
    }

    try {
      // Get text content for objects that have been AI processed
      const objectsWithContent = await Promise.all(
        objects.map(async (obj) => {
          const metadata = obj.customMetadata || {};
          if (metadata.aiProcessed === 'true' && metadata.aiAnalysis) {
            const analysis = JSON.parse(metadata.aiAnalysis);
            return {
              object: obj,
              content: analysis.extractedText || analysis.summary || ''
            };
          }
          return {
            object: obj,
            content: obj.key + ' ' + (metadata.originalFilename || '')
          };
        })
      );

      // Calculate relevance scores using embeddings
      const queryEmbedding = await this.getTextEmbedding(query);

      for (const item of objectsWithContent) {
        const contentEmbedding = await this.getTextEmbedding(item.content);
        const similarity = this.cosineSimilarity(queryEmbedding, contentEmbedding);
        (item.object as any).relevanceScore = similarity;
      }

      // Sort by relevance score
      return objectsWithContent
        .sort((a, b) => (b.object as any).relevanceScore - (a.object as any).relevanceScore)
        .map(item => item.object);
    } catch (error) {
      console.error('Relevance ranking failed:', error);
      return objects;
    }
  }

  private async getTextEmbedding(text: string): Promise<number[]> {
    if (!this.aiEnabled) {
      return new Array(384).fill(0); // Default embedding size
    }

    try {
      const response = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [text]
      });

      if (response?.data?.shape?.[0] === 1) {
        return response.data.data[0];
      }

      return new Array(384).fill(0);
    } catch (error) {
      console.error('Text embedding failed:', error);
      return new Array(384).fill(0);
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
  }

  private async generateExcerpt(fileInfo: FileInfo, query: string): Promise<string> {
    try {
      const downloadResult = await this.downloadFile(fileInfo.key, fileInfo.bucket as any);
      if (!downloadResult.success || !downloadResult.data) {
        return '';
      }

      const text = await this.extractTextFromFile(downloadResult.data, fileInfo.contentType);
      const queryLower = query.toLowerCase();

      // Find the most relevant excerpt
      const words = text.split(/\s+/);
      const queryWords = queryLower.split(/\s+/);

      let bestExcerpt = '';
      let bestScore = 0;

      for (let i = 0; i <= words.length - 50; i++) {
        const excerpt = words.slice(i, i + 50).join(' ');
        const excerptLower = excerpt.toLowerCase();

        let score = 0;
        for (const queryWord of queryWords) {
          if (excerptLower.includes(queryWord)) {
            score++;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestExcerpt = excerpt;
        }
      }

      return bestExcerpt || text.substring(0, 200) + (text.length > 200 ? '...' : '');
    } catch (error) {
      console.error('Excerpt generation failed:', error);
      return '';
    }
  }

  private async updateFileMetadata(key: string, bucket: string, updates: Record<string, any>): Promise<void> {
    try {
      const bucketInstance = this.getBucket(bucket as any);
      if (!bucketInstance) return;

      const object = await bucketInstance.head(key);
      if (!object) return;

      const updatedMetadata = { ...object.customMetadata, ...updates };

      // Copy the object with updated metadata
      const file = await bucketInstance.get(key);
      if (file) {
        await bucketInstance.put(key, file.body, {
          customMetadata: updatedMetadata
        });
      }
    } catch (error) {
      console.error('Metadata update failed:', error);
    }
  }

  private async updateTemplateUsage(templateId: string, template: DocumentTemplate): Promise<void> {
    try {
      const key = `templates/${templateId}.json`;
      const bucketInstance = this.getBucket('templates');

      if (bucketInstance) {
        await bucketInstance.put(key, JSON.stringify(template, null, 2));
      }
    } catch (error) {
      console.error('Template usage update failed:', error);
    }
  }

  private wrapInHTML(content: string, title: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
        h1 { color: #333; }
        .document { border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="document">
        <h1>${title}</h1>
        <div class="content">
            ${content.replace(/\n/g, '<br>')}
        </div>
    </div>
</body>
</html>`;
  }

  private async convertToPDF(content: string): Promise<ArrayBuffer> {
    // PDF conversion would require a specialized service
    // For now, return HTML content as ArrayBuffer
    const html = this.wrapInHTML(content, 'Generated Document');
    return new TextEncoder().encode(html).buffer;
  }

  private async convertToDocx(content: string): Promise<ArrayBuffer> {
    // DOCX conversion would require a specialized service
    // For now, return plain text as ArrayBuffer
    return new TextEncoder().encode(content).buffer;
  }
}