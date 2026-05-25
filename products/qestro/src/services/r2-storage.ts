/**
 * R2 Storage Service
 *
 * Comprehensive file storage service for Questro platform
 * Handles uploads, downloads, security, and optimization
 */

import { nanoid } from 'nanoid'

export interface FileUploadOptions {
  bucket: 'ARTIFACTS' | 'MEDIA' | 'BACKUPS'
  path?: string
  metadata?: Record<string, string>
  contentType?: string
  expiration?: number // TTL in seconds
}

export interface FileDownloadOptions {
  bucket: 'ARTIFACTS' | 'MEDIA' | 'BACKUPS'
  path: string
  range?: { start: number; end?: number }
}

export interface FileInfo {
  key: string
  size: number
  etag: string
  lastModified: string
  contentType?: string
  metadata?: Record<string, string>
}

export class R2StorageService {
  private getBucket(env: any, bucketName: string): R2Bucket {
    const bucketMap = {
      'ARTIFACTS': env.ARTIFACTS,
      'MEDIA': env.MEDIA,
      'BACKUPS': env.BACKUPS
    }

    const bucket = bucketMap[bucketName as keyof typeof bucketMap]
    if (!bucket) {
      throw new Error(`Bucket ${bucketName} not found`)
    }

    return bucket
  }

  /**
   * Upload a file to R2 storage
   */
  async uploadFile(
    env: any,
    file: ArrayBuffer | ReadableStream | Uint8Array,
    options: FileUploadOptions
  ): Promise<{ key: string; url: string }> {
    const { bucket, path = '', metadata = {}, contentType = 'application/octet-stream', expiration } = options

    // Generate unique filename if not provided
    const filename = path || this.generateUniquePath(contentType)

    // Prepare metadata
    const uploadMetadata: R2UploadMetadata = {
      contentType,
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        ...metadata
      }
    }

    // Handle expiration for temporary files
    const uploadOptions: R2PutOptions = {}
    if (expiration) {
      uploadOptions.customMetadata = {
        ...uploadMetadata.customMetadata,
        expiresAt: new Date(Date.now() + expiration * 1000).toISOString()
      }
    }

    // Upload to R2
    const object = await this.getBucket(env, bucket).put(filename, file, uploadMetadata)

    if (!object) {
      throw new Error('Failed to upload file to R2')
    }

    return {
      key: filename,
      url: this.getPublicUrl(env, bucket, filename)
    }
  }

  /**
   * Upload a file from a fetch request (for multipart uploads)
   */
  async uploadFromRequest(
    env: any,
    request: Request,
    options: FileUploadOptions
  ): Promise<{ key: string; url: string }> {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      throw new Error('No file provided in request')
    }

    // Use original filename or generate unique one
    const filename = options.path || this.generateUniquePath(file.type, file.name)

    return this.uploadFile(env, file.stream(), {
      ...options,
      path: filename,
      contentType: file.type,
      metadata: {
        originalName: file.name,
        size: file.size.toString(),
        ...options.metadata
      }
    })
  }

  /**
   * Download a file from R2 storage
   */
  async downloadFile(env: any, options: FileDownloadOptions): Promise<Response> {
    const { bucket, path, range } = options

    const object = await this.getBucket(env, bucket).get(path, {
      range: range ? { start: range.start, end: range.end } : undefined
    })

    if (!object) {
      throw new Error('File not found')
    }

    // Create response headers
    const headers = new Headers()
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream')
    headers.set('Content-Length', object.size.toString())
    headers.set('ETag', object.etag)
    headers.set('Last-Modified', object.uploaded.toUTCString())

    // Add cache headers for static assets
    if (path.includes('/static/') || path.includes('/assets/')) {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    } else {
      headers.set('Cache-Control', 'public, max-age=3600')
    }

    // Add custom metadata as headers
    if (object.customMetadata) {
      Object.entries(object.customMetadata).forEach(([key, value]) => {
        headers.set(`X-${key}`, value)
      })
    }

    return new Response(object.body, { headers })
  }

  /**
   * Get file information without downloading
   */
  async getFileInfo(env: any, options: { bucket: string; path: string }): Promise<FileInfo | null> {
    const { bucket, path } = options

    const object = await this.getBucket(env, bucket).head(path)

    if (!object) {
      return null
    }

    return {
      key: path,
      size: object.size,
      etag: object.etag,
      lastModified: object.uploaded.toISOString(),
      contentType: object.httpMetadata?.contentType,
      metadata: object.customMetadata
    }
  }

  /**
   * List files in a bucket with prefix filtering
   */
  async listFiles(
    env: any,
    options: {
      bucket: string;
      prefix?: string;
      limit?: number;
      cursor?: string
    }
  ): Promise<{ files: FileInfo[]; cursor?: string }> {
    const { bucket, prefix = '', limit = 100, cursor } = options

    const result = await this.getBucket(env, bucket).list({
      prefix,
      limit,
      cursor
    })

    const files = result.objects.map(obj => ({
      key: obj.key,
      size: obj.size,
      etag: obj.etag,
      lastModified: obj.uploaded.toISOString(),
      contentType: obj.customMetadata?.contentType,
      metadata: obj.customMetadata
    }))

    return {
      files,
      cursor: result.truncated ? result.cursor : undefined
    }
  }

  /**
   * Delete a file from R2 storage
   */
  async deleteFile(env: any, options: { bucket: string; path: string }): Promise<boolean> {
    const { bucket, path } = options

    await this.getBucket(env, bucket).delete(path)
    return true
  }

  /**
   * Copy a file within or between buckets
   */
  async copyFile(
    env: any,
    options: {
      sourceBucket: string;
      sourcePath: string;
      destinationBucket: string;
      destinationPath: string
    }
  ): Promise<boolean> {
    const { sourceBucket, sourcePath, destinationBucket, destinationPath } = options

    const sourceObject = await this.getBucket(env, sourceBucket).get(sourcePath)
    if (!sourceObject) {
      throw new Error('Source file not found')
    }

    await this.getBucket(env, destinationBucket).put(destinationPath, sourceObject.body, {
      contentType: sourceObject.httpMetadata?.contentType,
      customMetadata: sourceObject.customMetadata
    })

    return true
  }

  /**
   * Generate unique path for file uploads
   */
  private generateUniquePath(contentType: string, originalName?: string): string {
    const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const randomId = nanoid(8)
    const extension = this.getFileExtension(contentType, originalName)

    return `${timestamp}/${randomId}${extension}`
  }

  /**
   * Extract file extension from content type or filename
   */
  private getFileExtension(contentType: string, originalName?: string): string {
    // Try to get extension from original filename first
    if (originalName) {
      const ext = originalName.split('.').pop()
      if (ext) return `.${ext}`
    }

    // Fallback to content type mapping
    const typeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'application/json': '.json',
      'application/xml': '.xml'
    }

    return typeMap[contentType] || ''
  }

  /**
   * Get public URL for a file (for serving through Workers)
   */
  private getPublicUrl(env: any, bucket: string, key: string): string {
    // In production, this would generate a proper CDN URL
    // For now, we'll use the Worker as a proxy
    const baseUrl = env.FRONTEND_URL || 'https://qestro.broad-dew-49ad.workers.dev'
    return `${baseUrl}/api/files/${bucket.toLowerCase()}/${key}`
  }

  /**
   * Validate file type and size
   */
  validateFile(file: File, options: { maxSize?: number; allowedTypes?: string[] }): void {
    const { maxSize = 100 * 1024 * 1024, allowedTypes = [] } = options // 100MB default

    // Check file size
    if (file.size > maxSize) {
      throw new Error(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum ${maxSize / 1024 / 1024}MB`)
    }

    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed`)
    }
  }

  /**
   * Generate presigned URL for direct uploads (for large files)
   */
  async generatePresignedUrl(
    env: any,
    options: { bucket: string; key: string; method: 'PUT' | 'GET'; expiresIn?: number }
  ): Promise<{ url: string; headers: Record<string, string> }> {
    // Note: R2 doesn't support presigned URLs directly through Workers API
    // This would typically be implemented using S3-compatible signature generation
    // For now, we'll return the Worker endpoint URL
    const { bucket, key, method = 'PUT', expiresIn = 3600 } = options

    return {
      url: `https://qestro.broad-dew-49ad.workers.dev/api/files/${bucket.toLowerCase()}/${key}`,
      headers: {
        'X-Method': method,
        'X-Expires-In': expiresIn.toString()
      }
    }
  }
}

// Export singleton instance
export const r2Storage = new R2StorageService()
