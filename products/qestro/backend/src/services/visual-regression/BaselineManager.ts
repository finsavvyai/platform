'use strict';

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { VisualBaseline } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Baseline Manager - Manages visual test baselines
 * Stores on disk with metadata, supports S3 integration
 */

interface BaselineStorageConfig {
  basePath?: string;
  s3Enabled?: boolean;
  s3Bucket?: string;
  s3Region?: string;
}

class BaselineManager {
  private basePath: string;
  private s3Enabled: boolean;
  private config: BaselineStorageConfig;

  constructor(config: BaselineStorageConfig = {}) {
    this.config = config;
    this.basePath = config.basePath || './baselines';
    this.s3Enabled = config.s3Enabled || false;
  }

  /**
   * Save baseline to storage
   */
  async saveBaseline(
    projectId: string,
    name: string,
    screenshot: Buffer
  ): Promise<VisualBaseline> {
    const baselineId = uuidv4();
    const now = new Date();

    const baseline: VisualBaseline = {
      id: baselineId,
      projectId,
      name,
      screenshot,
      metadata: {
        width: 0, // will be extracted from PNG
        height: 0,
        createdAt: now,
        updatedAt: now,
        version: 1,
      },
    };

    try {
      // Extract dimensions from PNG
      baseline.metadata.width = this.getPNGWidth(screenshot);
      baseline.metadata.height = this.getPNGHeight(screenshot);

      const dir = this.getBaselineDir(projectId);
      await fs.mkdir(dir, { recursive: true });

      const filePath = path.join(dir, `${name}-${baselineId}.png`);
      const metadataPath = path.join(dir, `${name}-${baselineId}.json`);

      // Store screenshot
      await fs.writeFile(filePath, screenshot);

      // Store metadata
      const metadata = {
        id: baseline.id,
        projectId: baseline.projectId,
        name: baseline.name,
        metadata: baseline.metadata,
      };
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      logger.info('Baseline saved', { projectId, name, baselineId });

      return baseline;
    } catch (error) {
      logger.error('Failed to save baseline', { projectId, name, error });
      throw error;
    }
  }

  /**
   * Get baseline screenshot
   */
  async getBaseline(projectId: string, name: string): Promise<Buffer | null> {
    try {
      const dir = this.getBaselineDir(projectId);
      const files = await fs.readdir(dir);
      const baselineFile = files.find((f) => f.startsWith(name) && f.endsWith('.png'));

      if (!baselineFile) {
        logger.debug('Baseline not found', { projectId, name });
        return null;
      }

      const filePath = path.join(dir, baselineFile);
      const screenshot = await fs.readFile(filePath);

      logger.debug('Baseline retrieved', { projectId, name });
      return screenshot;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      logger.error('Failed to get baseline', { projectId, name, error });
      throw error;
    }
  }

  /**
   * Update existing baseline
   */
  async updateBaseline(projectId: string, baselineId: string, screenshot: Buffer): Promise<void> {
    try {
      const dir = this.getBaselineDir(projectId);
      const files = await fs.readdir(dir);
      const metadataFile = files.find((f) => f.endsWith(`${baselineId}.json`));

      if (!metadataFile) {
        throw new Error(`Baseline not found: ${baselineId}`);
      }

      const metadataPath = path.join(dir, metadataFile);
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

      // Update screenshot
      const pngFile = metadataFile.replace('.json', '.png');
      const filePath = path.join(dir, pngFile);
      await fs.writeFile(filePath, screenshot);

      // Update metadata
      metadata.metadata.updatedAt = new Date();
      metadata.metadata.version = (metadata.metadata.version ?? 0) + 1;
      metadata.metadata.width = this.getPNGWidth(screenshot);
      metadata.metadata.height = this.getPNGHeight(screenshot);

      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      logger.info('Baseline updated', { projectId, baselineId });
    } catch (error) {
      logger.error('Failed to update baseline', { projectId, baselineId, error });
      throw error;
    }
  }

  /**
   * List all baselines for a project
   */
  async listBaselines(projectId: string): Promise<VisualBaseline[]> {
    try {
      const dir = this.getBaselineDir(projectId);
      const files = await fs.readdir(dir);
      const metadataFiles = files.filter((f) => f.endsWith('.json'));

      const baselines: VisualBaseline[] = [];

      for (const metadataFile of metadataFiles) {
        const filePath = path.join(dir, metadataFile);
        const metadata = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        const pngFile = metadataFile.replace('.json', '.png');
        const screenshotPath = path.join(dir, pngFile);
        const screenshot = await fs.readFile(screenshotPath);

        baselines.push({
          id: metadata.id,
          projectId: metadata.projectId,
          name: metadata.name,
          screenshot,
          metadata: {
            width: metadata.metadata.width,
            height: metadata.metadata.height,
            createdAt: new Date(metadata.metadata.createdAt),
            updatedAt: new Date(metadata.metadata.updatedAt),
            version: metadata.metadata.version,
          },
        });
      }

      return baselines;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error('Failed to list baselines', { projectId, error });
      throw error;
    }
  }

  /**
   * Delete a baseline
   */
  async deleteBaseline(projectId: string, baselineId: string): Promise<void> {
    try {
      const dir = this.getBaselineDir(projectId);
      const files = await fs.readdir(dir);
      const metadataFile = files.find((f) => f.endsWith(`${baselineId}.json`));

      if (metadataFile) {
        const metadataPath = path.join(dir, metadataFile);
        const pngFile = metadataFile.replace('.json', '.png');
        const pngPath = path.join(dir, pngFile);

        await Promise.all([fs.unlink(metadataPath), fs.unlink(pngPath)].map((p) =>
          p.catch(() => {})
        ));

        logger.info('Baseline deleted', { projectId, baselineId });
      }
    } catch (error) {
      logger.error('Failed to delete baseline', { projectId, baselineId, error });
      throw error;
    }
  }

  /**
   * Get baseline directory for project
   */
  private getBaselineDir(projectId: string): string {
    return path.join(this.basePath, projectId);
  }

  /**
   * Extract PNG width from buffer (PNG header format)
   */
  private getPNGWidth(buffer: Buffer): number {
    if (buffer.length < 24) return 0;
    return buffer.readUInt32BE(16);
  }

  /**
   * Extract PNG height from buffer (PNG header format)
   */
  private getPNGHeight(buffer: Buffer): number {
    if (buffer.length < 24) return 0;
    return buffer.readUInt32BE(20);
  }
}

let instance: BaselineManager;

/**
 * Get or create singleton instance
 */
export function getBaselineManager(config?: BaselineStorageConfig): BaselineManager {
  if (!instance) {
    instance = new BaselineManager(config);
  }
  return instance;
}

export { BaselineManager };
export default getBaselineManager();
