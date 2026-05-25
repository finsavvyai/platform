'use strict';

import { ComparisonResult, ComparisonOptions, DiffRegion } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Image Comparator - Pixel-level image comparison using raw pixel data
 * No external dependencies, pure pixel comparison
 */

interface ImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

class ImageComparator {
  private threshold: number = 0.1; // default 0.1% mismatch threshold

  /**
   * Compare two images (as Buffers, assuming PNG)
   */
  async compareImages(
    baseline: Buffer,
    current: Buffer,
    options: ComparisonOptions = {}
  ): Promise<ComparisonResult> {
    const timer = { start: Date.now() };

    try {
      // Extract image dimensions from PNG headers
      const baselineData = this.decodePNG(baseline);
      const currentData = this.decodePNG(current);

      // Validate dimensions match
      if (baselineData.width !== currentData.width || baselineData.height !== currentData.height) {
        logger.warn('Image dimensions mismatch', {
          baseline: `${baselineData.width}x${baselineData.height}`,
          current: `${currentData.width}x${currentData.height}`,
        });
      }

      // Run pixel comparison
      const { mismatchCount, diffImage, regions } = this.pixelCompare(
        baselineData,
        currentData,
        options
      );

      const threshold = options.threshold ?? this.threshold;
      const mismatchPercentage = (mismatchCount / (baselineData.width * baselineData.height)) * 100;
      const passed = mismatchPercentage <= threshold;

      logger.info('Image comparison complete', {
        mismatchCount,
        mismatchPercentage: mismatchPercentage.toFixed(2),
        passed,
        duration: Date.now() - timer.start,
      });

      return {
        mismatchCount,
        mismatchPercentage,
        diffImage,
        regions,
        passed,
        threshold,
      };
    } catch (error) {
      logger.error('Image comparison failed', { error });
      throw error;
    }
  }

  /**
   * Decode PNG buffer to raw pixel data (simplified PNG parser)
   */
  private decodePNG(buffer: Buffer): ImageData {
    // PNG format: 8-byte signature + IHDR chunk
    // IHDR: width (4 bytes), height (4 bytes), bit depth (1 byte), etc.
    const signature = buffer.slice(0, 8);

    // Verify PNG signature
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (!signature.equals(pngSignature)) {
      throw new Error('Invalid PNG signature');
    }

    // Extract width and height from IHDR chunk (at offset 16)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    // For simplicity, create raw RGBA data from PNG
    // In production, use a proper PNG library; this is a placeholder
    const pixelCount = width * height;
    const data = new Uint8ClampedArray(pixelCount * 4);

    // Fill with placeholder data (assumes PNG is already decompressed or use zlib)
    // This is a simplified version; real implementation needs zlib decompression
    let offset = 8;
    for (let i = 0; i < pixelCount * 4 && offset < buffer.length; i++, offset++) {
      data[i] = buffer[offset];
    }

    return { width, height, data };
  }

  /**
   * Pixel-by-pixel comparison (simplified pixelmatch algorithm)
   */
  private pixelCompare(
    baseline: ImageData,
    current: ImageData,
    options: ComparisonOptions
  ): { mismatchCount: number; diffImage: Buffer; regions: DiffRegion[] } {
    const width = Math.min(baseline.width, current.width);
    const height = Math.min(baseline.height, current.height);
    const scale = options.scale ?? 4; // default sensitivity

    let mismatchCount = 0;
    const diffData = new Uint8ClampedArray(baseline.data.length);

    // Copy baseline as diff starting point (diff shows mismatches)
    diffData.set(baseline.data);

    // Compare each pixel (RGBA format, 4 bytes per pixel)
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const bR = baseline.data[idx];
      const bG = baseline.data[idx + 1];
      const bB = baseline.data[idx + 2];
      const bA = baseline.data[idx + 3];

      const cR = current.data[idx] ?? bR;
      const cG = current.data[idx + 1] ?? bG;
      const cB = current.data[idx + 2] ?? bB;
      const cA = current.data[idx + 3] ?? bA;

      // Calculate delta for each channel
      const deltaR = Math.abs(bR - cR);
      const deltaG = Math.abs(bG - cG);
      const deltaB = Math.abs(bB - cB);
      const deltaA = Math.abs(bA - cA);

      // Apply anti-aliasing detection if enabled
      const tolerance = options.antiAlias ? scale + 1 : scale;
      const maxDelta = Math.max(deltaR, deltaG, deltaB, deltaA);

      if (maxDelta > tolerance) {
        mismatchCount++;
        // Mark pixel as diff (red channel high)
        diffData[idx] = 255;
        diffData[idx + 1] = 0;
        diffData[idx + 2] = 0;
        diffData[idx + 3] = 200; // 80% opacity
      }
    }

    // Generate diff image buffer
    const diffImage = this.createDiffImage(diffData, width, height);

    // Identify diff regions
    const regions = this.extractDiffRegions(diffData, width, height, mismatchCount);

    return { mismatchCount, diffImage, regions };
  }

  /**
   * Create PNG buffer from raw pixel data (simplified)
   */
  private createDiffImage(data: Uint8ClampedArray, width: number, height: number): Buffer {
    // Simplified: return raw data as buffer
    // In production, encode as proper PNG using zlib
    return Buffer.from(data);
  }

  /**
   * Extract rectangular regions with significant diffs
   */
  private extractDiffRegions(
    diffData: Uint8ClampedArray,
    width: number,
    height: number,
    totalMismatch: number
  ): DiffRegion[] {
    const regions: DiffRegion[] = [];
    const gridSize = 32; // divide image into 32x32 regions
    const cellWidth = Math.ceil(width / gridSize);
    const cellHeight = Math.ceil(height / gridSize);

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        let cellMismatch = 0;
        const startX = x * cellWidth;
        const startY = y * cellHeight;
        const endX = Math.min(startX + cellWidth, width);
        const endY = Math.min(startY + cellHeight, height);

        for (let py = startY; py < endY; py++) {
          for (let px = startX; px < endX; px++) {
            const idx = (py * width + px) * 4;
            // Check if pixel is marked as diff (high red channel)
            if (diffData[idx] > 200) {
              cellMismatch++;
            }
          }
        }

        if (cellMismatch > 0) {
          const cellArea = cellWidth * cellHeight;
          regions.push({
            x: startX,
            y: startY,
            width: Math.min(cellWidth, width - startX),
            height: Math.min(cellHeight, height - startY),
            mismatchCount: cellMismatch,
            mismatchPercentage: (cellMismatch / cellArea) * 100,
          });
        }
      }
    }

    return regions.sort((a, b) => b.mismatchCount - a.mismatchCount).slice(0, 5);
  }
}

let instance: ImageComparator;

/**
 * Get or create singleton instance
 */
export function getImageComparator(): ImageComparator {
  if (!instance) {
    instance = new ImageComparator();
  }
  return instance;
}

export { ImageComparator };
export default getImageComparator();
