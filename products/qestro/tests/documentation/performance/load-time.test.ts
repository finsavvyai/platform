/**
 * Documentation Load Time Tests
 *
 * Tests to ensure documentation pages load quickly and meet
 * performance standards for enterprise documentation.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';
import DocumentationTestUtils from '../utils/documentationTestUtils';
import { getTestConfig } from '../config/testConfig';

describe('Documentation Load Time Performance', () => {
  const config = getTestConfig();
  let documentationFiles: string[] = [];
  const projectRoot = path.resolve(process.cwd(), '..');

  beforeAll(async () => {
    // Get all documentation files
    documentationFiles = await DocumentationTestUtils.getDocumentationFiles(
      path.join(projectRoot, 'docs'),
      ['.md', '.html', '.txt']
    );

    console.log(`Found ${documentationFiles.length} documentation files for performance testing`);
  });

  describe('File Size Analysis', () => {
    it('should ensure individual files are within size limits', async () => {
      const largeFiles: Array<{ file: string; size: number }> = [];
      const maxFileSize = config.performance.maxFileSize;

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);

        if (docFile.metadata.size > maxFileSize) {
          largeFiles.push({
            file: filePath,
            size: docFile.metadata.size
          });
        }
      }

      if (largeFiles.length > 0) {
        console.warn('Large documentation files found:', largeFiles);
      }

      expect(largeFiles).toHaveLength(0);
    });

    it('should analyze file size distribution', async () => {
      const fileSizes: number[] = [];
      let totalSize = 0;

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        fileSizes.push(docFile.metadata.size);
        totalSize += docFile.metadata.size;
      }

      const averageSize = totalSize / fileSizes.length;
      const maxSize = Math.max(...fileSizes);
      const minSize = Math.min(...fileSizes);

      console.log(`File size statistics:`);
      console.log(`- Total files: ${fileSizes.length}`);
      console.log(`- Average size: ${(averageSize / 1024).toFixed(2)} KB`);
      console.log(`- Max size: ${(maxSize / 1024).toFixed(2)} KB`);
      console.log(`- Min size: ${(minSize / 1024).toFixed(2)} KB`);
      console.log(`- Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

      // Performance expectations
      expect(averageSize).toBeLessThan(50 * 1024); // Average less than 50KB
      expect(maxSize).toBeLessThan(config.performance.maxFileSize); // Max within configured limit
    });

    it('should identify files with excessive images or media', async () => {
      const mediaHeavyFiles: Array<{ file: string; imageCount: number }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        // Count image references
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        const imageMatches = content.match(imageRegex) || [];

        if (imageMatches.length > 10) { // More than 10 images might be excessive
          mediaHeavyFiles.push({
            file: filePath,
            imageCount: imageMatches.length
          });
        }
      }

      if (mediaHeavyFiles.length > 0) {
        console.warn('Files with many images:', mediaHeavyFiles);
      }

      // Allow some media-heavy files but limit them
      expect(mediaHeavyFiles.length).toBeLessThan(3);
    });
  });

  describe('Parsing Performance', () => {
    it('should parse markdown files quickly', async () => {
      const parsingTimes: number[] = [];
      const sampleSize = Math.min(10, documentationFiles.length);

      for (let i = 0; i < sampleSize; i++) {
        const filePath = documentationFiles[i];

        const startTime = performance.now();
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        const codeBlocks = DocumentationTestUtils.extractCodeBlocks(docFile.content);

        const endTime = performance.now();
        const parseTime = endTime - startTime;
        parsingTimes.push(parseTime);
      }

      const averageParseTime = parsingTimes.reduce((a, b) => a + b, 0) / parsingTimes.length;
      const maxParseTime = Math.max(...parsingTimes);

      console.log(`Parsing performance statistics:`);
      console.log(`- Files parsed: ${parsingTimes.length}`);
      console.log(`- Average parse time: ${averageParseTime.toFixed(2)} ms`);
      console.log(`- Max parse time: ${maxParseTime.toFixed(2)} ms`);

      // Performance expectations
      expect(averageParseTime).toBeLessThan(50); // Average less than 50ms
      expect(maxParseTime).toBeLessThan(200); // Max less than 200ms
    });

    it('should extract content efficiently', async () => {
      const extractionTimes: number[] = [];
      const sampleSize = Math.min(5, documentationFiles.length);

      for (let i = 0; i < sampleSize; i++) {
        const filePath = documentationFiles[i];
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);

        const startTime = performance.now();

        // Simulate intensive extraction operations
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        const codeBlocks = DocumentationTestUtils.extractCodeBlocks(docFile.content);
        const apiSpecs = DocumentationTestUtils.extractAPISpecifications(docFile.content);
        const images = await DocumentationTestUtils.validateImageReferences(
          path.dirname(filePath),
          docFile.content
        );

        const endTime = performance.now();
        const extractionTime = endTime - startTime;
        extractionTimes.push(extractionTime);
      }

      const averageExtractionTime = extractionTimes.reduce((a, b) => a + b, 0) / extractionTimes.length;

      console.log(`Content extraction performance:`);
      console.log(`- Average extraction time: ${averageExtractionTime.toFixed(2)} ms`);

      expect(averageExtractionTime).toBeLessThan(100); // Less than 100ms for full extraction
    });

    it('should handle large files efficiently', async () => {
      // Find the largest file
      let largestFile = '';
      let largestSize = 0;

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        if (docFile.metadata.size > largestSize) {
          largestSize = docFile.metadata.size;
          largestFile = filePath;
        }
      }

      if (largestFile) {
        const startTime = performance.now();

        const docFile = await DocumentationTestUtils.readDocumentationFile(largestFile);
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        const codeBlocks = DocumentationTestUtils.extractCodeBlocks(docFile.content);

        const endTime = performance.now();
        const processingTime = endTime - startTime;

        console.log(`Largest file processing:`);
        console.log(`- File: ${largestFile}`);
        console.log(`- Size: ${(largestSize / 1024).toFixed(2)} KB`);
        console.log(`- Processing time: ${processingTime.toFixed(2)} ms`);

        // Processing time should be reasonable relative to file size
        const timePerKB = processingTime / (largestSize / 1024);
        expect(timePerKB).toBeLessThan(5); // Less than 5ms per KB
      }
    });
  });

  describe('Memory Usage', () => {
    it('should not consume excessive memory during processing', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process multiple files sequentially
      for (let i = 0; i < Math.min(10, documentationFiles.length); i++) {
        const filePath = documentationFiles[i];
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);

        // Perform memory-intensive operations
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        const codeBlocks = DocumentationTestUtils.extractCodeBlocks(docFile.content);
        const validationResults = await DocumentationTestUtils.validateCodeExamples(codeBlocks);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Memory usage:`);
      console.log(`- Initial: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`- Final: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`- Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });

    it('should handle concurrent processing efficiently', async () => {
      const startTime = performance.now();
      const initialMemory = process.memoryUsage().heapUsed;

      // Process files concurrently
      const concurrentPromises = documentationFiles.slice(0, 5).map(async (filePath) => {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        return { file: filePath, linkCount: links.length };
      });

      const results = await Promise.all(concurrentPromises);

      const endTime = performance.now();
      const finalMemory = process.memoryUsage().heapUsed;

      const totalTime = endTime - startTime;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Concurrent processing performance:`);
      console.log(`- Files processed: ${results.length}`);
      console.log(`- Total time: ${totalTime.toFixed(2)} ms`);
      console.log(`- Time per file: ${(totalTime / results.length).toFixed(2)} ms`);
      console.log(`- Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);

      // Concurrent processing should be efficient
      expect(totalTime / results.length).toBeLessThan(100); // Less than 100ms per file
      expect(memoryIncrease).toBeLessThan(30 * 1024 * 1024); // Less than 30MB increase
    });
  });

  describe('I/O Performance', () => {
    it('should read files quickly', async () => {
      const readTimes: number[] = [];
      const sampleSize = Math.min(20, documentationFiles.length);

      for (let i = 0; i < sampleSize; i++) {
        const filePath = documentationFiles[i];

        const startTime = performance.now();
        await DocumentationTestUtils.readDocumentationFile(filePath);
        const endTime = performance.now();

        readTimes.push(endTime - startTime);
      }

      const averageReadTime = readTimes.reduce((a, b) => a + b, 0) / readTimes.length;
      const maxReadTime = Math.max(...readTimes);

      console.log(`File I/O performance:`);
      console.log(`- Files read: ${readTimes.length}`);
      console.log(`- Average read time: ${averageReadTime.toFixed(2)} ms`);
      console.log(`- Max read time: ${maxReadTime.toFixed(2)} ms`);

      expect(averageReadTime).toBeLessThan(20); // Average less than 20ms
      expect(maxReadTime).toBeLessThan(100); // Max less than 100ms
    });

    it('should handle directory scanning efficiently', async () => {
      const startTime = performance.now();

      const scannedFiles = await DocumentationTestUtils.getDocumentationFiles(
        path.join(projectRoot, 'docs'),
        ['.md', '.txt', '.json']
      );

      const endTime = performance.now();
      const scanTime = endTime - startTime;

      console.log(`Directory scanning performance:`);
      console.log(`- Files found: ${scannedFiles.length}`);
      console.log(`- Scan time: ${scanTime.toFixed(2)} ms`);
      console.log(`- Time per file: ${(scanTime / scannedFiles.length).toFixed(2)} ms`);

      expect(scanTime).toBeLessThan(100); // Directory scan should be fast
      expect(scannedFiles.length).toBeGreaterThan(0); // Should find files
    });
  });

  describe('Cache Performance', () => {
    it('should demonstrate caching benefits', async () => {
      const testFile = documentationFiles[0];

      // First read (cold cache)
      const coldStartTime = performance.now();
      const docFile1 = await DocumentationTestUtils.readDocumentationFile(testFile);
      const links1 = DocumentationTestUtils.extractLinks(docFile1.content);
      const coldEndTime = performance.now();
      const coldTime = coldEndTime - coldStartTime;

      // Second read (warm cache)
      const warmStartTime = performance.now();
      const docFile2 = await DocumentationTestUtils.readDocumentationFile(testFile);
      const links2 = DocumentationTestUtils.extractLinks(docFile2.content);
      const warmEndTime = performance.now();
      const warmTime = warmEndTime - warmStartTime;

      const speedup = coldTime / warmTime;

      console.log(`Cache performance:`);
      console.log(`- Cold read time: ${coldTime.toFixed(2)} ms`);
      console.log(`- Warm read time: ${warmTime.toFixed(2)} ms`);
      console.log(`- Speedup: ${speedup.toFixed(2)}x`);

      // Results should be identical
      expect(docFile1.content).toBe(docFile2.content);
      expect(links1.length).toBe(links2.length);

      // Second read should be faster (though this depends on OS caching)
      expect(warmTime).toBeLessThanOrEqual(coldTime * 1.5); // Allow some variance
    });
  });

  describe('Scalability Performance', () => {
    it('should handle increasing document volume efficiently', async () => {
      const performanceMetrics: Array<{ fileCount: number; time: number }> = [];

      // Test with different file counts
      const fileCounts = [1, 3, 5, 10];

      for (const count of fileCounts) {
        const startTime = performance.now();

        // Process specified number of files
        for (let i = 0; i < Math.min(count, documentationFiles.length); i++) {
          const filePath = documentationFiles[i];
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const links = DocumentationTestUtils.extractLinks(docFile.content);
          const codeBlocks = DocumentationTestUtils.extractCodeBlocks(docFile.content);
        }

        const endTime = performance.now();
        const processingTime = endTime - startTime;

        performanceMetrics.push({
          fileCount: count,
          time: processingTime
        });
      }

      console.log(`Scalability performance:`);
      performanceMetrics.forEach(metric => {
        console.log(`- ${metric.fileCount} files: ${metric.time.toFixed(2)} ms`);
      });

      // Performance should scale reasonably (not exponentially)
      if (performanceMetrics.length >= 3) {
        const firstMetric = performanceMetrics[0];
        const lastMetric = performanceMetrics[performanceMetrics.length - 1];

        const timePerFile = firstMetric.time / firstMetric.fileCount;
        const expectedLastTime = timePerFile * lastMetric.fileCount;

        // Actual time should be within reasonable bounds of expected linear scaling
        expect(lastMetric.time).toBeLessThan(expectedLastTime * 2);
      }
    });

    it('should maintain performance with large content', async () => {
      // Create a large synthetic content test
      const largeContent = Array(1000).fill(null).map((_, i) =>
        `# Section ${i}\n\nThis is test content for section ${i}. `.repeat(10)
      ).join('\n\n');

      const startTime = performance.now();

      // Process large content
      const links = DocumentationTestUtils.extractLinks(largeContent);
      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(largeContent);
      const headers = largeContent.match(/^#+\s+.*$/gm) || [];

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      console.log(`Large content performance:`);
      console.log(`- Content length: ${(largeContent.length / 1024).toFixed(2)} KB`);
      console.log(`- Processing time: ${processingTime.toFixed(2)} ms`);
      console.log(`- Links found: ${links.length}`);
      console.log(`- Headers found: ${headers.length}`);

      expect(processingTime).toBeLessThan(200); // Should handle large content quickly
      expect(headers.length).toBe(1000); // Should find all headers
    });
  });

  describe('Network Performance Simulation', () => {
    it('should simulate web-based documentation loading', async () => {
      // Simulate loading documentation as if from a web server
      const simulatedLoadTimes: number[] = [];
      const sampleFiles = documentationFiles.slice(0, 5);

      for (const filePath of sampleFiles) {
        const startTime = performance.now();

        // Simulate network latency + file processing
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20)); // 10-30ms latency

        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        const codeBlocks = DocumentationTestUtils.extractCodeBlocks(docFile.content);

        // Simulate rendering time
        await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 10)); // 5-15ms render

        const endTime = performance.now();
        simulatedLoadTimes.push(endTime - startTime);
      }

      const averageLoadTime = simulatedLoadTimes.reduce((a, b) => a + b, 0) / simulatedLoadTimes.length;
      const maxLoadTime = Math.max(...simulatedLoadTimes);

      console.log(`Simulated web loading performance:`);
      console.log(`- Average load time: ${averageLoadTime.toFixed(2)} ms`);
      console.log(`- Max load time: ${maxLoadTime.toFixed(2)} ms`);

      // Should meet web performance standards
      expect(averageLoadTime).toBeLessThan(config.performance.maxLoadTime);
      expect(maxLoadTime).toBeLessThan(config.performance.maxLoadTime * 2);
    });
  });

  describe('Resource Optimization', () => {
    it('should identify optimization opportunities', async () => {
      const optimizationSuggestions: string[] = [];

      // Analyze file sizes
      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        // Check for repeated patterns that could be optimized
        const repeatedLines = content.split('\n').filter((line, index, arr) =>
          arr.indexOf(line) !== index && line.length > 20
        );

        if (repeatedLines.length > 5) {
          optimizationSuggestions.push(`${filePath}: Contains repeated content that could be extracted`);
        }

        // Check for long code blocks
        const codeBlocks = DocumentationTestUtils.extractCodeBlocks(content);
        const longCodeBlocks = codeBlocks.filter(block => block.code.length > 5000);

        if (longCodeBlocks.length > 0) {
          optimizationSuggestions.push(`${filePath}: Contains large code blocks (${longCodeBlocks.length})`);
        }

        // Check for excessive whitespace
        const whitespaceRatio = (content.match(/\s/g) || []).length / content.length;
        if (whitespaceRatio > 0.3) {
          optimizationSuggestions.push(`${filePath}: High whitespace ratio (${(whitespaceRatio * 100).toFixed(1)}%)`);
        }
      }

      if (optimizationSuggestions.length > 0) {
        console.log('Optimization suggestions:');
        optimizationSuggestions.forEach(suggestion => {
          console.log(`- ${suggestion}`);
        });
      }

      // Optimization suggestions should be minimal
      expect(optimizationSuggestions.length).toBeLessThan(10);
    });

    it('should measure compression potential', async () => {
      let totalOriginalSize = 0;
      let totalCompressedSize = 0;

      for (const filePath of documentationFiles.slice(0, 10)) { // Sample first 10 files
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        totalOriginalSize += content.length;

        // Simple compression simulation (run-length encoding for repeated characters)
        const compressed = content.replace(/(.)\1+/g, (match, char) => `${char}${match.length}`);
        totalCompressedSize += compressed.length;
      }

      const compressionRatio = totalCompressedSize / totalOriginalSize;

      console.log(`Compression analysis:`);
      console.log(`- Original size: ${(totalOriginalSize / 1024).toFixed(2)} KB`);
      console.log(`- Compressed size: ${(totalCompressedSize / 1024).toFixed(2)} KB`);
      console.log(`- Compression ratio: ${compressionRatio.toFixed(2)}`);

      // Content should be reasonably compressible
      expect(compressionRatio).toBeLessThan(0.9); // At least 10% compression
    });
  });
});
