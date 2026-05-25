/**
 * File Management API Routes
 *
 * Handles file uploads, downloads, and management through R2 storage
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { r2Storage } from '../services/r2-storage'

const files = new Hono<{
  Bindings: {
    DB: D1Database
    SESSIONS: KVNamespace
    CACHE: KVNamespace
    REALTIME: KVNamespace
    ARTIFACTS: R2Bucket
    MEDIA: R2Bucket
    BACKUPS: R2Bucket
    JWT_SECRET: string
    FRONTEND_URL: string
  }
}>()

// Add CORS headers for file operations
files.use('*', cors({
  origin: (origin, c) => {
    const allowedOrigins = [
      c.env.FRONTEND_URL,
      'http://localhost:3000',
      'https://dev.qestro.io',
      'https://staging.qestro.io',
      'https://qestro.io'
    ]
    return allowedOrigins.includes(origin) || origin?.endsWith('workers.dev')
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true
}))

/**
 * Upload a file
 * POST /api/files/{bucket}/upload
 */
files.post('/:bucket/upload', async (c) => {
  try {
    const bucket = c.req.param('bucket').toUpperCase()
    const validBuckets = ['ARTIFACTS', 'MEDIA', 'BACKUPS']

    if (!validBuckets.includes(bucket)) {
      return c.json({ error: 'Invalid bucket' }, 400)
    }

    // Handle different upload methods
    const contentType = c.req.header('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form upload
      const result = await r2Storage.uploadFromRequest(c.req.raw, {
        bucket: bucket as 'ARTIFACTS' | 'MEDIA' | 'BACKUPS',
        metadata: {
          uploadedBy: c.req.header('X-User-ID') || 'anonymous',
          source: c.req.header('X-Source') || 'api'
        }
      })

      return c.json({
        success: true,
        file: result,
        message: 'File uploaded successfully'
      })
    } else {
      // Handle direct binary upload
      const arrayBuffer = await c.req.arrayBuffer()
      const filename = c.req.header('X-Filename') || `upload-${Date.now()}`
      const fileType = c.req.header('X-Content-Type') || 'application/octet-stream'

      const result = await r2Storage.uploadFile(c.env, arrayBuffer, {
        bucket: bucket as 'ARTIFACTS' | 'MEDIA' | 'BACKUPS',
        path: filename,
        contentType: fileType,
        metadata: {
          uploadedBy: c.req.header('X-User-ID') || 'anonymous',
          source: 'api'
        }
      })

      return c.json({
        success: true,
        file: result,
        message: 'File uploaded successfully'
      })
    }
  } catch (error) {
    console.error('File upload error:', error)
    return c.json({
      error: 'Upload failed',
      message: error.message
    }, 500)
  }
})

/**
 * Download a file
 * GET /api/files/{bucket}/{path+}
 */
files.get('/:bucket/:path+', async (c) => {
  try {
    const bucket = c.req.param('bucket').toUpperCase()
    const path = c.req.param('path')
    const validBuckets = ['ARTIFACTS', 'MEDIA', 'BACKUPS']

    if (!validBuckets.includes(bucket)) {
      return c.json({ error: 'Invalid bucket' }, 400)
    }

    // Check for range requests (for video streaming)
    const rangeHeader = c.req.header('range')
    let range: { start: number; end?: number } | undefined

    if (rangeHeader) {
      const matches = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (matches) {
        range = { start: parseInt(matches[1]) }
        if (matches[2]) {
          range.end = parseInt(matches[2])
        }
      }
    }

    const response = await r2Storage.downloadFile(c.env, {
      bucket: bucket as 'ARTIFACTS' | 'MEDIA' | 'BACKUPS',
      path,
      range
    })

    return response
  } catch (error) {
    console.error('File download error:', error)
    return c.json({
      error: 'Download failed',
      message: error.message
    }, 500)
  }
})

/**
 * Get file information
 * HEAD /api/files/{bucket}/{path+}
 */
files.head('/:bucket/:path+', async (c) => {
  try {
    const bucket = c.req.param('bucket').toUpperCase()
    const path = c.req.param('path')
    const validBuckets = ['ARTIFACTS', 'MEDIA', 'BACKUPS']

    if (!validBuckets.includes(bucket)) {
      return c.json({ error: 'Invalid bucket' }, 400)
    }

    const fileInfo = await r2Storage.getFileInfo(c.env, { bucket, path })

    if (!fileInfo) {
      return c.json({ error: 'File not found' }, 404)
    }

    // Return metadata as headers
    const headers = new Headers()
    headers.set('Content-Type', fileInfo.contentType || 'application/octet-stream')
    headers.set('Content-Length', fileInfo.size.toString())
    headers.set('ETag', fileInfo.etag)
    headers.set('Last-Modified', new Date(fileInfo.lastModified).toUTCString())

    if (fileInfo.metadata) {
      Object.entries(fileInfo.metadata).forEach(([key, value]) => {
        headers.set(`X-${key}`, value)
      })
    }

    return new Response(null, { headers })
  } catch (error) {
    console.error('File info error:', error)
    return c.json({
      error: 'Failed to get file info',
      message: error.message
    }, 500)
  }
})

/**
 * List files in a bucket
 * GET /api/files/{bucket}
 */
files.get('/:bucket', async (c) => {
  try {
    const bucket = c.req.param('bucket').toUpperCase()
    const validBuckets = ['ARTIFACTS', 'MEDIA', 'BACKUPS']

    if (!validBuckets.includes(bucket)) {
      return c.json({ error: 'Invalid bucket' }, 400)
    }

    const { prefix, limit = 100, cursor } = c.req.query()

    const result = await r2Storage.listFiles(c.env, {
      bucket,
      prefix: prefix as string,
      limit: parseInt(limit as string),
      cursor: cursor as string
    })

    return c.json({
      success: true,
      files: result.files,
      cursor: result.cursor,
      count: result.files.length
    })
  } catch (error) {
    console.error('List files error:', error)
    return c.json({
      error: 'Failed to list files',
      message: error.message
    }, 500)
  }
})

/**
 * Delete a file
 * DELETE /api/files/{bucket}/{path+}
 */
files.delete('/:bucket/:path+', async (c) => {
  try {
    const bucket = c.req.param('bucket').toUpperCase()
    const path = c.req.param('path')
    const validBuckets = ['ARTIFACTS', 'MEDIA', 'BACKUPS']

    if (!validBuckets.includes(bucket)) {
      return c.json({ error: 'Invalid bucket' }, 400)
    }

    await r2Storage.deleteFile(c.env, { bucket, path })

    return c.json({
      success: true,
      message: 'File deleted successfully'
    })
  } catch (error) {
    console.error('Delete file error:', error)
    return c.json({
      error: 'Failed to delete file',
      message: error.message
    }, 500)
  }
})

/**
 * Generate presigned URL for direct uploads
 * POST /api/files/{bucket}/presigned-url
 */
files.post('/:bucket/presigned-url', async (c) => {
  try {
    const bucket = c.req.param('bucket').toUpperCase()
    const validBuckets = ['ARTIFACTS', 'MEDIA', 'BACKUPS']

    if (!validBuckets.includes(bucket)) {
      return c.json({ error: 'Invalid bucket' }, 400)
    }

    const { key, method = 'PUT', expiresIn = 3600 } = await c.req.json()

    if (!key) {
      return c.json({ error: 'Key is required' }, 400)
    }

    const result = await r2Storage.generatePresignedUrl(c.env, {
      bucket: bucket as 'ARTIFACTS' | 'MEDIA' | 'BACKUPS',
      key,
      method: method as 'PUT' | 'GET',
      expiresIn: parseInt(expiresIn as string)
    })

    return c.json({
      success: true,
      presignedUrl: result
    })
  } catch (error) {
    console.error('Presigned URL error:', error)
    return c.json({
      error: 'Failed to generate presigned URL',
      message: error.message
    }, 500)
  }
})

/**
 * Upload test artifact
 * POST /api/files/artifacts/upload-test-result
 */
files.post('/artifacts/upload-test-result', async (c) => {
  try {
    const { testRunId, testSuiteId, project_id, type = 'screenshot' } = await c.req.json()

    if (!testRunId) {
      return c.json({ error: 'testRunId is required' }, 400)
    }

    // Generate path for test artifact
    const path = `test-results/${project_id}/${testSuiteId}/${testRunId}/${type}-${Date.now()}.png`

    const arrayBuffer = await c.req.arrayBuffer()
    const result = await r2Storage.uploadFile(c.env, arrayBuffer, {
      bucket: 'ARTIFACTS',
      path,
      contentType: 'image/png',
      metadata: {
        testRunId,
        testSuiteId,
        project_id,
        type,
        uploadedAt: new Date().toISOString()
      }
    })

    return c.json({
      success: true,
      artifact: result,
      message: 'Test artifact uploaded successfully'
    })
  } catch (error) {
    console.error('Test artifact upload error:', error)
    return c.json({
      error: 'Failed to upload test artifact',
      message: error.message
    }, 500)
  }
})

/**
 * Upload media file (user avatar, project logo, etc.)
 * POST /api/files/media/upload
 */
files.post('/media/upload', async (c) => {
  try {
    const { userId, projectId, mediaType = 'avatar' } = c.req.query()

    if (!userId && !projectId) {
      return c.json({ error: 'userId or projectId is required' }, 400)
    }

    // Generate path for media file
    let path: string
    if (userId) {
      path = `users/${userId}/${mediaType}-${Date.now()}`
    } else {
      path = `projects/${projectId}/${mediaType}-${Date.now()}`
    }

    const result = await r2Storage.uploadFromRequest(c.req.raw, {
      bucket: 'MEDIA',
      path,
      metadata: {
        userId: userId as string,
        projectId: projectId as string,
        mediaType: mediaType as string,
        uploadedAt: new Date().toISOString()
      }
    })

    return c.json({
      success: true,
      media: result,
      message: 'Media uploaded successfully'
    })
  } catch (error) {
    console.error('Media upload error:', error)
    return c.json({
      error: 'Failed to upload media',
      message: error.message
    }, 500)
  }
})

export { files as fileRoutes }
