/**
 * File Routes for Cloudflare Workers
 * Provides file upload, download, and management via R2 storage
 */

import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';

const fileRoutes = new Hono();

// Upload file endpoint
fileRoutes.post('/upload', async (c) => {
  try {
    const contentType = c.req.header('content-type') || '';
    const fileName = c.req.header('x-file-name') || 'upload.bin';
    const userId = c.req.header('x-user-id') || 'anonymous';
    const fileSize = parseInt(c.req.header('content-length') || '0');

    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (fileSize > maxSize) {
      return c.json({
        error: 'File too large',
        message: 'Maximum file size is 100MB',
        size: fileSize,
        max_size: maxSize
      }, 413);
    }

    // Generate unique file ID
    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const key = `uploads/${userId}/${fileId}/${fileName}`;

    // Get file data
    const fileData = await c.req.arrayBuffer();

    // Store in R2
    await c.env.UPM_FILES.put(key, fileData, {
      httpMetadata: {
        contentType,
        contentDisposition: `attachment; filename="${fileName}"`
      },
      customMetadata: {
        original_name: fileName,
        uploaded_by: userId,
        upload_time: new Date().toISOString(),
        file_size: fileSize.toString()
      }
    });

    // Store metadata in D1
    await c.env.UPM_DB.prepare(`
      INSERT INTO files (
        id, user_id, original_name, file_path, content_type,
        file_size, upload_time, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'uploaded')
    `).bind(
      fileId,
      userId,
      fileName,
      key,
      contentType,
      fileSize,
      new Date().toISOString()
    ).run();

    // Generate download URL
    const downloadUrl = `${c.req.url.split('/api/v1')[0]}/files/download/${fileId}`;

    return c.json({
      success: true,
      file_id: fileId,
      file_name: fileName,
      file_size: fileSize,
      content_type: contentType,
      download_url,
      upload_time: new Date().toISOString()
    }, 201);
  } catch (error) {
    return c.json({
      error: 'File upload failed',
      message: error.message
    }, 500);
  }
});

// Multipart upload endpoint for large files
fileRoutes.post('/upload/multipart/initiate', async (c) => {
  try {
    const { fileName, fileSize, contentType, userId } = await c.req.json();

    // Validate multipart upload requirements
    const minSize = 5 * 1024 * 1024; // 5MB minimum for multipart
    if (fileSize < minSize) {
      return c.json({
        error: 'File too small for multipart upload',
        message: 'Use regular upload for files smaller than 5MB',
        min_size: minSize
      }, 400);
    }

    // Create multipart upload
    const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const partSize = 10 * 1024 * 1024; // 10MB parts
    const totalParts = Math.ceil(fileSize / partSize);

    // Store upload metadata
    await c.env.UPM_CACHE.put(`multipart:${uploadId}`, JSON.stringify({
      fileName,
      fileSize,
      contentType,
      userId,
      partSize,
      totalParts,
      created_at: new Date().toISOString(),
      status: 'initiated'
    }), { expirationTtl: 3600 }); // 1 hour

    return c.json({
      success: true,
      upload_id: uploadId,
      part_size: partSize,
      total_parts: totalParts,
      upload_urls: Array.from({ length: totalParts }, (_, i) => ({
        part_number: i + 1,
        upload_url: `${c.req.url.split('/api/v1')[0]}/files/upload/multipart/part/${uploadId}/${i + 1}`
      }))
    });
  } catch (error) {
    return c.json({
      error: 'Multipart upload initiation failed',
      message: error.message
    }, 500);
  }
});

// Upload multipart part
fileRoutes.put('/upload/multipart/part/:uploadId/:partNumber', async (c) => {
  const uploadId = c.req.param('uploadId');
  const partNumber = parseInt(c.req.param('partNumber'));

  try {
    // Get upload metadata
    const uploadData = await c.env.UPM_CACHE.get(`multipart:${uploadId}`);
    if (!uploadData) {
      return c.json({
        error: 'Upload not found',
        upload_id: uploadId
      }, 404);
    }

    const upload = JSON.parse(uploadData);

    // Validate part number
    if (partNumber < 1 || partNumber > upload.totalParts) {
      return c.json({
        error: 'Invalid part number',
        part_number: partNumber,
        total_parts: upload.totalParts
      }, 400);
    }

    // Store part data
    const partKey = `multipart/${uploadId}/parts/${partNumber}`;
    const partData = await c.req.arrayBuffer();

    await c.env.UPM_FILES.put(partKey, partData, {
      customMetadata: {
        upload_id: uploadId,
        part_number: partNumber.toString(),
        size: partData.byteLength.toString()
      }
    });

    // Update upload progress
    const partsKey = `multipart:${uploadId}:parts`;
    const existingParts = await c.env.UPM_CACHE.get(partsKey);
    const parts = existingParts ? JSON.parse(existingParts) : [];
    parts.push(partNumber);
    await c.env.UPM_CACHE.put(partsKey, JSON.stringify(parts), { expirationTtl: 3600 });

    return c.json({
      success: true,
      part_number: partNumber,
      size: partData.byteLength,
      parts_uploaded: parts.length,
      total_parts: upload.totalParts
    });
  } catch (error) {
    return c.json({
      error: 'Part upload failed',
      message: error.message,
      upload_id: uploadId,
      part_number: partNumber
    }, 500);
  }
});

// Complete multipart upload
fileRoutes.post('/upload/multipart/complete/:uploadId', async (c) => {
  const uploadId = c.req.param('uploadId');

  try {
    // Get upload metadata
    const uploadData = await c.env.UPM_CACHE.get(`multipart:${uploadId}`);
    if (!uploadData) {
      return c.json({
        error: 'Upload not found',
        upload_id: uploadId
      }, 404);
    }

    const upload = JSON.parse(uploadData);

    // Get uploaded parts
    const partsKey = `multipart:${uploadId}:parts`;
    const partsData = await c.env.UPM_CACHE.get(partsKey);
    if (!partsData) {
      return c.json({
        error: 'No parts uploaded',
        upload_id: uploadId
      }, 400);
    }

    const parts = JSON.parse(partsData);

    // Validate all parts are uploaded
    if (parts.length !== upload.totalParts) {
      return c.json({
        error: 'Not all parts uploaded',
        parts_uploaded: parts.length,
        total_parts: upload.totalParts
      }, 400);
    }

    // Combine parts into final file
    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const key = `uploads/${upload.userId}/${fileId}/${upload.fileName}`;

    // Combine all parts
    let combinedData = new Uint8Array(0);
    for (let i = 1; i <= upload.totalParts; i++) {
      const partKey = `multipart/${uploadId}/parts/${i}`;
      const partObject = await c.env.UPM_FILES.get(partKey);
      if (partObject) {
        const partData = await partObject.arrayBuffer();
        const newCombinedData = new Uint8Array(combinedData.length + partData.byteLength);
        newCombinedData.set(combinedData, 0);
        newCombinedData.set(new Uint8Array(partData), combinedData.length);
        combinedData = newCombinedData;
      }
    }

    // Store final file
    await c.env.UPM_FILES.put(key, combinedData, {
      httpMetadata: {
        contentType: upload.contentType,
        contentDisposition: `attachment; filename="${upload.fileName}"`
      },
      customMetadata: {
        original_name: upload.fileName,
        uploaded_by: upload.userId,
        upload_time: new Date().toISOString(),
        file_size: upload.fileSize.toString(),
        upload_method: 'multipart'
      }
    });

    // Store metadata in D1
    await c.env.UPM_DB.prepare(`
      INSERT INTO files (
        id, user_id, original_name, file_path, content_type,
        file_size, upload_time, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'uploaded')
    `).bind(
      fileId,
      upload.userId,
      upload.fileName,
      key,
      upload.contentType,
      upload.fileSize,
      new Date().toISOString()
    ).run();

    // Cleanup temporary parts
    for (let i = 1; i <= upload.totalParts; i++) {
      const partKey = `multipart/${uploadId}/parts/${i}`;
      await c.env.UPM_FILES.delete(partKey);
    }
    await c.env.UPM_CACHE.delete(`multipart:${uploadId}`);
    await c.env.UPM_CACHE.delete(partsKey);

    // Generate download URL
    const downloadUrl = `${c.req.url.split('/api/v1')[0]}/files/download/${fileId}`;

    return c.json({
      success: true,
      file_id: fileId,
      file_name: upload.fileName,
      file_size: upload.fileSize,
      content_type: upload.contentType,
      download_url,
      upload_time: new Date().toISOString(),
      upload_method: 'multipart'
    });
  } catch (error) {
    return c.json({
      error: 'Multipart upload completion failed',
      message: error.message,
      upload_id: uploadId
    }, 500);
  }
});

// Download file endpoint
fileRoutes.get('/download/:fileId', async (c) => {
  const fileId = c.req.param('fileId');

  try {
    // Get file metadata from D1
    const file = await c.env.UPM_DB.prepare(`
      SELECT * FROM files WHERE id = ? AND status = 'uploaded'
    `).bind(fileId).first();

    if (!file) {
      return c.json({
        error: 'File not found',
        file_id: fileId
      }, 404);
    }

    // Get file from R2
    const fileObject = await c.env.UPM_FILES.get(file.file_path);
    if (!fileObject) {
      return c.json({
        error: 'File object not found in storage',
        file_id: fileId
      }, 404);
    }

    // Return file with appropriate headers
    return new Response(fileObject.body, {
      status: 200,
      headers: {
        'Content-Type': file.content_type,
        'Content-Disposition': `attachment; filename="${file.original_name}"`,
        'Content-Length': file.file_size.toString(),
        'Cache-Control': 'public, max-age=31536000', // 1 year
        'ETag': fileId,
        'Last-Modified': new Date(file.upload_time).toUTCString()
      }
    });
  } catch (error) {
    return c.json({
      error: 'File download failed',
      message: error.message,
      file_id: fileId
    }, 500);
  }
});

// Get file info endpoint
fileRoutes.get('/info/:fileId', async (c) => {
  const fileId = c.req.param('fileId');

  try {
    const file = await c.env.UPM_DB.prepare(`
      SELECT * FROM files WHERE id = ?
    `).bind(fileId).first();

    if (!file) {
      return c.json({
        error: 'File not found',
        file_id: fileId
      }, 404);
    }

    return c.json({
      file_id: file.id,
      original_name: file.original_name,
      content_type: file.content_type,
      file_size: file.file_size,
      upload_time: file.upload_time,
      status: file.status,
      download_url: `${c.req.url.split('/api/v1')[0]}/files/download/${fileId}`
    });
  } catch (error) {
    return c.json({
      error: 'Failed to get file info',
      message: error.message,
      file_id: fileId
    }, 500);
  }
});

// List user files endpoint
fileRoutes.get('/list', async (c) => {
  const userId = c.req.query('user_id');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  if (!userId) {
    return c.json({
      error: 'user_id parameter is required'
    }, 400);
  }

  try {
    const files = await c.env.UPM_DB.prepare(`
      SELECT * FROM files
      WHERE user_id = ? AND status = 'uploaded'
      ORDER BY upload_time DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();

    const total = await c.env.UPM_DB.prepare(`
      SELECT COUNT(*) as count FROM files
      WHERE user_id = ? AND status = 'uploaded'
    `).bind(userId).first();

    return c.json({
      files: files.results || [],
      pagination: {
        total: total?.count || 0,
        limit,
        offset,
        has_more: (offset + limit) < (total?.count || 0)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      error: 'Failed to list files',
      message: error.message
    }, 500);
  }
});

// Delete file endpoint
fileRoutes.delete('/:fileId', async (c) => {
  const fileId = c.req.param('fileId');

  try {
    // Get file metadata
    const file = await c.env.UPM_DB.prepare(`
      SELECT * FROM files WHERE id = ?
    `).bind(fileId).first();

    if (!file) {
      return c.json({
        error: 'File not found',
        file_id: fileId
      }, 404);
    }

    // Delete from R2
    await c.env.UPM_FILES.delete(file.file_path);

    // Update status in D1
    await c.env.UPM_DB.prepare(`
      UPDATE files SET status = 'deleted', deleted_at = ?
      WHERE id = ?
    `).bind(new Date().toISOString(), fileId).run();

    return c.json({
      success: true,
      message: 'File deleted successfully',
      file_id: fileId
    });
  } catch (error) {
    return c.json({
      error: 'Failed to delete file',
      message: error.message,
      file_id: fileId
    }, 500);
  }
});

export { fileRoutes };