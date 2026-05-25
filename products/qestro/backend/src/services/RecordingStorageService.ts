import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import {
  RecordingSession,
  WebRecordingSession,
  MobileRecordingSession,
  RecordedAction
} from '../types/recording.js';

export interface StoredRecording {
  id: string;
  sessionId: string;
  name: string;
  description?: string;
  type: 'web' | 'mobile';
  platform: string;
  projectId: string;
  userId: string;
  status: 'draft' | 'published' | 'archived';
  actions: RecordedAction[];
  config: any;
  metadata: Record<string, any>;
  artifacts: {
    screenshots: string[];
    videos: string[];
    logs: string[];
  };
  tags: string[];
  duration?: number;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
  archivedAt?: number;
}

export class RecordingStorageService extends EventEmitter {
  private recordings = new Map<string, StoredRecording>();
  private storageDir = path.join(process.cwd(), 'storage', 'recordings');
  private artifactsDir = path.join(process.cwd(), 'storage', 'artifacts');

  constructor() {
    super();
    this.ensureDirectories();
    this.loadRecordings();
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      await fs.mkdir(this.artifactsDir, { recursive: true });
      await fs.mkdir(path.join(this.artifactsDir, 'screenshots'), { recursive: true });
      await fs.mkdir(path.join(this.artifactsDir, 'videos'), { recursive: true });
      await fs.mkdir(path.join(this.artifactsDir, 'logs'), { recursive: true });
    } catch (error) {
      logger.error('Failed to create storage directories:', error);
    }
  }

  /**
   * Load recordings from disk on startup
   */
  private async loadRecordings(): Promise<void> {
    try {
      const indexPath = path.join(this.storageDir, 'index.json');

      try {
        const data = await fs.readFile(indexPath, 'utf-8');
        const recordings = JSON.parse(data) as StoredRecording[];

        for (const recording of recordings) {
          this.recordings.set(recording.id, recording);
        }

        logger.info(`Loaded ${recordings.length} recordings from storage`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          logger.error('Failed to load recordings:', error);
        }
      }
    } catch (error) {
      logger.error('Error loading recordings:', error);
    }
  }

  /**
   * Save recording index to disk
   */
  private async saveIndex(): Promise<void> {
    try {
      const indexPath = path.join(this.storageDir, 'index.json');
      const recordings = Array.from(this.recordings.values());

      await fs.writeFile(indexPath, JSON.stringify(recordings, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to save recordings index:', error);
    }
  }

  /**
   * Save a recording session
   */
  async saveRecording(params: {
    session: WebRecordingSession | MobileRecordingSession;
    name: string;
    description?: string;
    projectId: string;
    userId: string;
    tags?: string[];
  }): Promise<StoredRecording> {
    const recordingId = uuidv4();
    const now = Date.now();

    const storedRecording: StoredRecording = {
      id: recordingId,
      sessionId: params.session.id,
      name: params.name,
      description: params.description,
      type: params.session.type,
      platform: params.session.platform,
      projectId: params.projectId,
      userId: params.userId,
      status: 'draft',
      actions: params.session.actions,
      config: params.session.config,
      metadata: params.session.metadata || {},
      artifacts: {
        screenshots: [],
        videos: [],
        logs: []
      },
      tags: params.tags || [],
      duration: params.session.duration,
      createdAt: now,
      updatedAt: now
    };

    // Save recording data to disk
    await this.saveRecordingToDisk(storedRecording);

    // Store in memory
    this.recordings.set(recordingId, storedRecording);

    // Update index
    await this.saveIndex();

    logger.info(`Recording ${recordingId} saved: ${params.name}`);
    this.emit('recording:saved', storedRecording);

    return storedRecording;
  }

  /**
   * Save recording data to disk
   */
  private async saveRecordingToDisk(recording: StoredRecording): Promise<void> {
    const recordingPath = path.join(this.storageDir, `${recording.id}.json`);

    try {
      await fs.writeFile(recordingPath, JSON.stringify(recording, null, 2), 'utf-8');
    } catch (error) {
      logger.error(`Failed to save recording ${recording.id} to disk:`, error);
      throw error;
    }
  }

  /**
   * Get a recording by ID
   */
  async getRecording(recordingId: string): Promise<StoredRecording | null> {
    // Check memory first
    let recording = this.recordings.get(recordingId);

    if (!recording) {
      // Try to load from disk
      try {
        const recordingPath = path.join(this.storageDir, `${recordingId}.json`);
        const data = await fs.readFile(recordingPath, 'utf-8');
        recording = JSON.parse(data);

        if (recording) {
          this.recordings.set(recordingId, recording);
        }
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          logger.error(`Failed to load recording ${recordingId}:`, error);
        }
        return null;
      }
    }

    return recording || null;
  }

  /**
   * Update a recording
   */
  async updateRecording(recordingId: string, updates: Partial<StoredRecording>): Promise<StoredRecording> {
    const recording = await this.getRecording(recordingId);

    if (!recording) {
      throw new Error(`Recording ${recordingId} not found`);
    }

    const updatedRecording: StoredRecording = {
      ...recording,
      ...updates,
      id: recording.id, // Prevent ID change
      updatedAt: Date.now()
    };

    // Save to disk
    await this.saveRecordingToDisk(updatedRecording);

    // Update memory
    this.recordings.set(recordingId, updatedRecording);

    // Update index
    await this.saveIndex();

    logger.info(`Recording ${recordingId} updated`);
    this.emit('recording:updated', updatedRecording);

    return updatedRecording;
  }

  /**
   * Delete a recording
   */
  async deleteRecording(recordingId: string): Promise<void> {
    const recording = await this.getRecording(recordingId);

    if (!recording) {
      throw new Error(`Recording ${recordingId} not found`);
    }

    // Delete recording file
    try {
      const recordingPath = path.join(this.storageDir, `${recordingId}.json`);
      await fs.unlink(recordingPath);
    } catch (error) {
      logger.error(`Failed to delete recording file ${recordingId}:`, error);
    }

    // Delete artifacts
    await this.deleteRecordingArtifacts(recording);

    // Remove from memory
    this.recordings.delete(recordingId);

    // Update index
    await this.saveIndex();

    logger.info(`Recording ${recordingId} deleted`);
    this.emit('recording:deleted', { recordingId });
  }

  /**
   * Delete recording artifacts
   */
  private async deleteRecordingArtifacts(recording: StoredRecording): Promise<void> {
    try {
      // Delete screenshots
      for (const screenshot of recording.artifacts.screenshots) {
        try {
          await fs.unlink(path.join(this.artifactsDir, screenshot));
        } catch (error) {
          logger.warn(`Failed to delete screenshot ${screenshot}:`, error);
        }
      }

      // Delete videos
      for (const video of recording.artifacts.videos) {
        try {
          await fs.unlink(path.join(this.artifactsDir, video));
        } catch (error) {
          logger.warn(`Failed to delete video ${video}:`, error);
        }
      }

      // Delete logs
      for (const log of recording.artifacts.logs) {
        try {
          await fs.unlink(path.join(this.artifactsDir, log));
        } catch (error) {
          logger.warn(`Failed to delete log ${log}:`, error);
        }
      }
    } catch (error) {
      logger.error(`Failed to delete artifacts for recording ${recording.id}:`, error);
    }
  }

  /**
   * List recordings with filters
   */
  async listRecordings(filters?: {
    projectId?: string;
    userId?: string;
    type?: 'web' | 'mobile';
    status?: 'draft' | 'published' | 'archived';
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'name';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ recordings: StoredRecording[]; total: number }> {
    let recordings = Array.from(this.recordings.values());

    // Apply filters
    if (filters) {
      if (filters.projectId) {
        recordings = recordings.filter(r => r.projectId === filters.projectId);
      }

      if (filters.userId) {
        recordings = recordings.filter(r => r.userId === filters.userId);
      }

      if (filters.type) {
        recordings = recordings.filter(r => r.type === filters.type);
      }

      if (filters.status) {
        recordings = recordings.filter(r => r.status === filters.status);
      }

      if (filters.tags && filters.tags.length > 0) {
        recordings = recordings.filter(r =>
          filters.tags!.some(tag => r.tags.includes(tag))
        );
      }

      if (filters.search) {
        const search = filters.search.toLowerCase();
        recordings = recordings.filter(r =>
          r.name.toLowerCase().includes(search) ||
          r.description?.toLowerCase().includes(search) ||
          r.tags.some(tag => tag.toLowerCase().includes(search))
        );
      }

      // Sort
      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder || 'desc';

      recordings.sort((a, b) => {
        const aValue = a[sortBy] as any;
        const bValue = b[sortBy] as any;

        if (typeof aValue === 'string') {
          return sortOrder === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        return sortOrder === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      });

      // Pagination
      const total = recordings.length;
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;

      recordings = recordings.slice(offset, offset + limit);

      return { recordings, total };
    }

    return { recordings, total: recordings.length };
  }

  /**
   * Publish a recording
   */
  async publishRecording(recordingId: string): Promise<StoredRecording> {
    const recording = await this.getRecording(recordingId);

    if (!recording) {
      throw new Error(`Recording ${recordingId} not found`);
    }

    if (recording.status === 'published') {
      return recording;
    }

    return await this.updateRecording(recordingId, {
      status: 'published',
      publishedAt: Date.now()
    });
  }

  /**
   * Archive a recording
   */
  async archiveRecording(recordingId: string): Promise<StoredRecording> {
    const recording = await this.getRecording(recordingId);

    if (!recording) {
      throw new Error(`Recording ${recordingId} not found`);
    }

    if (recording.status === 'archived') {
      return recording;
    }

    return await this.updateRecording(recordingId, {
      status: 'archived',
      archivedAt: Date.now()
    });
  }

  /**
   * Duplicate a recording
   */
  async duplicateRecording(recordingId: string, newName?: string): Promise<StoredRecording> {
    const original = await this.getRecording(recordingId);

    if (!original) {
      throw new Error(`Recording ${recordingId} not found`);
    }

    const duplicateId = uuidv4();
    const now = Date.now();

    const duplicate: StoredRecording = {
      ...original,
      id: duplicateId,
      sessionId: uuidv4(),
      name: newName || `${original.name} (Copy)`,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      publishedAt: undefined,
      archivedAt: undefined
    };

    // Save to disk
    await this.saveRecordingToDisk(duplicate);

    // Store in memory
    this.recordings.set(duplicateId, duplicate);

    // Update index
    await this.saveIndex();

    logger.info(`Recording ${recordingId} duplicated to ${duplicateId}`);
    this.emit('recording:duplicated', { original, duplicate });

    return duplicate;
  }

  /**
   * Store artifact (screenshot, video, log)
   */
  async storeArtifact(params: {
    recordingId: string;
    type: 'screenshot' | 'video' | 'log';
    data: Buffer | string;
    filename?: string;
  }): Promise<string> {
    const recording = await this.getRecording(params.recordingId);

    if (!recording) {
      throw new Error(`Recording ${params.recordingId} not found`);
    }

    const extension = this.getExtension(params.type);
    const filename = params.filename || `${params.type}_${Date.now()}${extension}`;
    const subDir = `${params.type}s`; // screenshots, videos, logs
    const relativePath = path.join(subDir, filename);
    const fullPath = path.join(this.artifactsDir, relativePath);

    try {
      // Ensure subdirectory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Write file
      if (Buffer.isBuffer(params.data)) {
        await fs.writeFile(fullPath, params.data);
      } else {
        await fs.writeFile(fullPath, params.data, 'utf-8');
      }

      // Update recording artifacts
      switch (params.type) {
        case 'screenshot':
          recording.artifacts.screenshots.push(relativePath);
          break;
        case 'video':
          recording.artifacts.videos.push(relativePath);
          break;
        case 'log':
          recording.artifacts.logs.push(relativePath);
          break;
      }

      await this.updateRecording(params.recordingId, {
        artifacts: recording.artifacts
      });

      logger.debug(`Artifact stored: ${relativePath}`);

      return relativePath;
    } catch (error) {
      logger.error(`Failed to store artifact for recording ${params.recordingId}:`, error);
      throw error;
    }
  }

  /**
   * Get artifact
   */
  async getArtifact(artifactPath: string): Promise<Buffer | null> {
    try {
      const fullPath = path.join(this.artifactsDir, artifactPath);
      const data = await fs.readFile(fullPath);
      return data;
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error(`Failed to read artifact ${artifactPath}:`, error);
      }
      return null;
    }
  }

  /**
   * Get extension for artifact type
   */
  private getExtension(type: 'screenshot' | 'video' | 'log'): string {
    switch (type) {
      case 'screenshot':
        return '.png';
      case 'video':
        return '.mp4';
      case 'log':
        return '.txt';
      default:
        return '';
    }
  }

  /**
   * Export recording to different formats
   */
  async exportRecording(recordingId: string, format: string): Promise<string> {
    const recording = await this.getRecording(recordingId);

    if (!recording) {
      throw new Error(`Recording ${recordingId} not found`);
    }

    // This would integrate with TestExportService for different formats
    // For now, return JSON
    return JSON.stringify(recording, null, 2);
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalRecordings: number;
    totalSize: number;
    byType: { web: number; mobile: number };
    byStatus: { draft: number; published: number; archived: number };
    artifactsCount: {
      screenshots: number;
      videos: number;
      logs: number;
    };
  }> {
    const recordings = Array.from(this.recordings.values());

    const stats = {
      totalRecordings: recordings.length,
      totalSize: 0,
      byType: { web: 0, mobile: 0 },
      byStatus: { draft: 0, published: 0, archived: 0 },
      artifactsCount: {
        screenshots: 0,
        videos: 0,
        logs: 0
      }
    };

    for (const recording of recordings) {
      // Count by type
      if (recording.type === 'web') stats.byType.web++;
      if (recording.type === 'mobile') stats.byType.mobile++;

      // Count by status
      if (recording.status === 'draft') stats.byStatus.draft++;
      if (recording.status === 'published') stats.byStatus.published++;
      if (recording.status === 'archived') stats.byStatus.archived++;

      // Count artifacts
      stats.artifactsCount.screenshots += recording.artifacts.screenshots.length;
      stats.artifactsCount.videos += recording.artifacts.videos.length;
      stats.artifactsCount.logs += recording.artifacts.logs.length;
    }

    // Calculate total size (simplified)
    try {
      const { size } = await fs.stat(this.storageDir);
      stats.totalSize = size;
    } catch (error) {
      logger.warn('Failed to calculate storage size:', error);
    }

    return stats;
  }

  /**
   * Cleanup old recordings
   */
  async cleanup(maxAge: number = 90 * 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [recordingId, recording] of this.recordings) {
      if (recording.status === 'archived' && now - recording.updatedAt > maxAge) {
        toDelete.push(recordingId);
      }
    }

    for (const recordingId of toDelete) {
      try {
        await this.deleteRecording(recordingId);
      } catch (error) {
        logger.error(`Failed to cleanup recording ${recordingId}:`, error);
      }
    }

    logger.info(`Cleaned up ${toDelete.length} old recordings`);

    return toDelete.length;
  }
}

export const recordingStorageService = new RecordingStorageService();
