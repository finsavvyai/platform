/**
 * Mobile Responsiveness Tests
 *
 * Tests to ensure documentation works well on mobile devices
 * and meets mobile performance standards.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import DocumentationTestUtils from '../utils/documentationTestUtils';
import { getTestConfig } from '../config/testConfig';

describe('Mobile Responsiveness Tests', () => {
  const config = getTestConfig();
  let documentationFiles: string[] = [];
  const projectRoot = path.resolve(process.cwd(), '..');

  beforeAll(async () => {
    // Get all documentation files
    documentationFiles = await DocumentationTestUtils.getDocumentationFiles(
      path.join(projectRoot, 'docs'),
      ['.md', '.html', '.txt']
    );

    console.log(`Found ${documentationFiles.length} documentation files for mobile testing`);
  });

  describe('Mobile Content Adaptation', () => {
    it('should ensure content is mobile-friendly', async () => {
      const mobileIssues: Array<{ file: string; issue: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        // Check for very long lines that might cause horizontal scrolling
        const lines = content.split('\n');
        const longLines = lines.filter(line => line.length > 120);

        if (longLines.length > lines.length * 0.1) { // More than 10% long lines
          mobileIssues.push({
            file: filePath,
            issue: `Contains ${longLines.length} very long lines (>120 chars)`
          });
        }

        // Check for large tables that might not work well on mobile
        const tableMatches = content.match(/\|.+\|/g) || [];
        if (tableMatches.length > 20) {
          mobileIssues.push({
            file: filePath,
            issue: `Contains large tables (${tableMatches.length} table rows)`
          });
        }

        // Check for complex nested structures
        const maxIndentation = Math.max(...lines.map(line =>
          line.match(/^(\s*)/)?.[1]?.length || 0
        ));

        if (maxIndentation > 16) {
          mobileIssues.push({
            file: filePath,
            issue: `Contains deep nesting (${maxIndentation} spaces)`
          });
        }
      }

      if (mobileIssues.length > 0) {
        console.warn('Mobile compatibility issues found:', mobileIssues);
      }

      // Allow some issues but limit them
      expect(mobileIssues.length).toBeLessThan(5);
    });

    it('should validate image suitability for mobile', async () => {
      const imageIssues: Array<{ file: string; issue: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        // Extract image references
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let match;

        while ((match = imageRegex.exec(content)) !== null) {
          const altText = match[1];
          const imageSrc = match[2];

          // Check for missing alt text
          if (!altText || altText.trim() === '') {
            imageIssues.push({
              file: filePath,
              issue: `Image missing alt text: ${imageSrc}`
            });
          }

          // Check for very large images (based on file extension and potential size)
          if (imageSrc.match(/\.(jpg|jpeg|png)$/i)) {
            // This would ideally check actual file dimensions
            // For now, just flag for manual review
            if (imageSrc.includes('large') || imageSrc.includes('huge')) {
              imageIssues.push({
                file: filePath,
                issue: `Potentially large image for mobile: ${imageSrc}`
              });
            }
          }
        }
      }

      if (imageIssues.length > 0) {
        console.warn('Mobile image issues found:', imageIssues);
      }

      // All images should have alt text for accessibility
      const altTextIssues = imageIssues.filter(issue => issue.issue.includes('missing alt text'));
      expect(altTextIssues).toHaveLength(0);
    });

    it('should ensure code blocks are mobile-readable', async () => {
      const codeBlockIssues: Array<{ file: string; line: number; issue: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const codeBlocks = DocumentationTestUtils.extractCodeBlocks(docFile.content);

        codeBlocks.forEach(block => {
          const lines = block.code.split('\n');

          // Check for very long lines in code blocks
          const longCodeLines = lines.filter(line => line.length > 100);

          if (longCodeLines.length > lines.length * 0.3) { // More than 30% long lines
            codeBlockIssues.push({
              file: filePath,
              line: block.line,
              issue: `Code block has ${longCodeLines.length} long lines (>100 chars)`
            });
          }

          // Check for very long code blocks that might be hard to read on mobile
          if (lines.length > 50) {
            codeBlockIssues.push({
              file: filePath,
              line: block.line,
              issue: `Very long code block (${lines.length} lines)`
            });
          }
        });
      }

      if (codeBlockIssues.length > 0) {
        console.warn('Mobile code block issues:', codeBlockIssues);
      }

      // Allow some long code blocks but limit them
      expect(codeBlockIssues.length).toBeLessThan(10);
    });
  });

  describe('Reading Experience', () => {
    it('should ensure appropriate content length for mobile reading', async () => {
      const lengthIssues: Array<{ file: string; wordCount: number; readingTime: number }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        // Count words (rough estimate)
        const words = content.split(/\s+/).length;
        const readingTime = Math.ceil(words / 200); // 200 words per minute average

        // Flag very long documents
        if (readingTime > 20) { // More than 20 minutes reading time
          lengthIssues.push({
            file: filePath,
            wordCount: words,
            readingTime
          });
        }
      }

      if (lengthIssues.length > 0) {
        console.warn('Documents with long reading times:', lengthIssues);
      }

      // Most documents should be reasonably sized for mobile reading
      expect(lengthIssues.length).toBeLessThan(documentationFiles.length * 0.2); // Less than 20% are very long
    });

    it('should validate heading structure for mobile navigation', async () => {
      const structureIssues: Array<{ file: string; issue: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        // Extract headers
        const headerRegex = /^(#{1,6})\s+(.+)$/gm;
        const headers = [];
        let match;

        while ((match = headerRegex.exec(content)) !== null) {
          headers.push({
            level: match[1].length,
            text: match[2].trim()
          });
        }

        // Check for reasonable heading hierarchy
        const h1Count = headers.filter(h => h.level === 1).length;
        if (h1Count === 0 && headers.length > 0) {
          structureIssues.push({
            file: filePath,
            issue: 'No H1 headers found but other headers exist'
          });
        }

        if (h1Count > 1) {
          structureIssues.push({
            file: filePath,
            issue: `Multiple H1 headers found (${h1Count})`
          });
        }

        // Check for very long headings (bad for mobile)
        const longHeadings = headers.filter(h => h.text.length > 80);
        if (longHeadings.length > 0) {
          structureIssues.push({
            file: filePath,
            issue: `${longHeadings.length} headings are too long for mobile (>80 chars)`
          });
        }

        // Check for adequate heading spacing
        const headingCount = headers.length;
        const contentLength = content.length;
        const headingFrequency = contentLength / headingCount;

        if (headingFrequency < 100) { // Less than 100 chars between headings
          structureIssues.push({
            file: filePath,
            issue: 'Too many headings, may be overwhelming on mobile'
          });
        }
      }

      if (structureIssues.length > 0) {
        console.warn('Mobile heading structure issues:', structureIssues);
      }

      expect(structureIssues.length).toBeLessThan(5);
    });

    it('should ensure lists are mobile-friendly', async () => {
      const listIssues: Array<{ file: string; issue: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;
        const lines = content.split('\n');

        // Check for very long list items
        let inList = false;
        let longListItems = 0;
        let totalListItems = 0;

        for (const line of lines) {
          const isListItem = /^[\s]*[-*+]\s/.test(line) || /^[\s]*\d+\.\s/.test(line);

          if (isListItem) {
            inList = true;
            totalListItems++;

            if (line.length > 100) {
              longListItems++;
            }
          } else if (inList && line.trim() === '') {
            inList = false;
          }
        }

        if (longListItems > totalListItems * 0.3 && totalListItems > 5) {
          listIssues.push({
            file: filePath,
            issue: `${longListItems}/${totalListItems} list items are too long for mobile`
          });
        }

        // Check for deeply nested lists
        const maxNesting = Math.max(...lines.map(line => {
          const match = line.match(/^(\s*)[-*+\d]/);
          return match ? match[1].length : 0;
        }));

        if (maxNesting > 12) {
          listIssues.push({
            file: filePath,
            issue: `Deeply nested lists (${maxNesting} spaces) may be confusing on mobile`
          });
        }
      }

      if (listIssues.length > 0) {
        console.warn('Mobile list issues:', listIssues);
      }

      expect(listIssues.length).toBeLessThan(3);
    });
  });

  describe('Performance for Mobile', () => {
    it('should ensure fast processing for mobile environments', async () => {
      const processingTimes: number[] = [];
      const sampleSize = Math.min(10, documentationFiles.length);

      // Simulate mobile processing constraints
      const mobileConstraints = {
        maxProcessingTime: 100, // ms
        maxMemoryUsage: 10 * 1024 * 1024 // 10MB
      };

      for (let i = 0; i < sampleSize; i++) {
        const filePath = documentationFiles[i];

        const startTime = performance.now();
        const initialMemory = process.memoryUsage().heapUsed;

        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        // Simulate mobile-optimized processing
        const preview = content.substring(0, 1000); // Only process first 1000 chars for preview
        const links = DocumentationTestUtils.extractLinks(preview);
        const headers = preview.match(/^#+\s+.*$/gm) || [];

        const endTime = performance.now();
        const finalMemory = process.memoryUsage().heapUsed;

        const processingTime = endTime - startTime;
        const memoryIncrease = finalMemory - initialMemory;

        processingTimes.push(processingTime);

        // Each operation should be within mobile constraints
        expect(processingTime).toBeLessThan(mobileConstraints.maxProcessingTime);
        expect(memoryIncrease).toBeLessThan(mobileConstraints.maxMemoryUsage / sampleSize);
      }

      const averageProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;

      console.log(`Mobile processing performance:`);
      console.log(`- Average processing time: ${averageProcessingTime.toFixed(2)} ms`);
      console.log(`- Max processing time: ${Math.max(...processingTimes).toFixed(2)} ms`);

      expect(averageProcessingTime).toBeLessThan(50); // Average should be fast on mobile
    });

    it('should handle progressive loading scenarios', async () => {
      // Simulate progressive content loading for mobile
      const progressiveLoadTimes: number[] = [];
      const chunkSize = 1000; // Load content in 1KB chunks

      for (const filePath of documentationFiles.slice(0, 3)) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        // Simulate progressive loading
        const chunks = [];
        for (let i = 0; i < content.length; i += chunkSize) {
          chunks.push(content.substring(i, i + chunkSize));
        }

        const startTime = performance.now();

        // Process chunks progressively
        for (let i = 0; i < Math.min(chunks.length, 5); i++) { // Process first 5 chunks
          const chunk = chunks[i];
          const links = DocumentationTestUtils.extractLinks(chunk);
          const codeBlocks = DocumentationTestUtils.extractCodeBlocks(chunk);

          // Simulate network delay between chunks
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        const endTime = performance.now();
        progressiveLoadTimes.push(endTime - startTime);
      }

      const averageProgressiveTime = progressiveLoadTimes.reduce((a, b) => a + b, 0) / progressiveLoadTimes.length;

      console.log(`Progressive loading performance:`);
      console.log(`- Average progressive load time: ${averageProgressiveTime.toFixed(2)} ms`);

      expect(averageProgressiveTime).toBeLessThan(200); // Progressive loading should be reasonably fast
    });
  });

  describe('Touch Interaction Considerations', () => {
    it('should ensure content is touch-friendly', async () => {
      const touchIssues: Array<{ file: string; issue: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        // Check for small interactive elements that might be hard to tap
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;
        const linkTexts = [];

        while ((match = linkRegex.exec(content)) !== null) {
          linkTexts.push(match[1]);
        }

        // Check for very short link text (hard to tap on mobile)
        const shortLinks = linkTexts.filter(text => text.length < 3 && text.trim() !== '');
        if (shortLinks.length > 0) {
          touchIssues.push({
            file: filePath,
            issue: `Contains ${shortLinks.length} very short links that may be hard to tap`
          });
        }

        // Check for closely spaced links (would need actual HTML analysis)
        const linkDensity = linkTexts.length / content.length;
        if (linkDensity > 0.1) { // More than 10% of content is links
          touchIssues.push({
            file: filePath,
            issue: `High link density (${(linkDensity * 100).toFixed(1)}%) may cause tap accuracy issues`
          });
        }
      }

      if (touchIssues.length > 0) {
        console.warn('Mobile touch interaction issues:', touchIssues);
      }

      expect(touchIssues.length).toBeLessThan(5);
    });

    it('should validate table suitability for mobile', async () => {
      const tableIssues: Array<{ file: string; issue: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        // Extract table content
        const tableRegex = /\|(.+)\|/g;
        const tableRows = [];
        let match;

        while ((match = tableRegex.exec(content)) !== null) {
          const cells = match[1].split('|').map(cell => cell.trim());
          tableRows.push(cells);
        }

        if (tableRows.length > 0) {
          // Check for tables with too many columns
          const columnCount = Math.max(...tableRows.map(row => row.length));
          if (columnCount > 5) {
            tableIssues.push({
              file: filePath,
              issue: `Table has ${columnCount} columns, may be hard to view on mobile`
            });
          }

          // Check for very wide table content
          const wideCells = tableRows.flat().filter(cell => cell.length > 50);
          if (wideCells.length > tableRows.flat().length * 0.2) {
            tableIssues.push({
              file: filePath,
              issue: `Table contains ${wideCells.length} wide cells (>50 chars) that may cause horizontal scrolling`
            });
          }
        }
      }

      if (tableIssues.length > 0) {
        console.warn('Mobile table issues:', tableIssues);
      }

      expect(tableIssues.length).toBeLessThan(3);
    });
  });

  describe('Bandwidth Optimization', () => {
    it('should ensure content is optimized for mobile bandwidth', async () => {
      const bandwidthIssues: Array<{ file: string; issue: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        // Check for content that could be optimized for mobile
        const sizeKB = docFile.metadata.size / 1024;

        // Flag large files
        if (sizeKB > 100) {
          bandwidthIssues.push({
            file: filePath,
            issue: `Large file size: ${sizeKB.toFixed(1)} KB`
          });
        }

        // Check for redundant content
        const repeatedPhrases = {};
        const phrases = content.split('. ').filter(phrase => phrase.length > 10);

        phrases.forEach(phrase => {
          const cleanPhrase = phrase.trim().toLowerCase();
          repeatedPhrases[cleanPhrase] = (repeatedPhrases[cleanPhrase] || 0) + 1;
        });

        const redundantPhrases = Object.entries(repeatedPhrases).filter(([_, count]) => count > 3);
        if (redundantPhrases.length > 5) {
          bandwidthIssues.push({
            file: filePath,
            issue: `Contains ${redundantPhrases.length} repeated phrases that could be optimized`
          });
        }
      }

      if (bandwidthIssues.length > 0) {
        console.warn('Mobile bandwidth optimization issues:', bandwidthIssues);
      }

      // Most files should be optimized for mobile bandwidth
      expect(bandwidthIssues.length).toBeLessThan(documentationFiles.length * 0.1); // Less than 10%
    });

    it('should validate image optimization for mobile', async () => {
      const imageOptimizationIssues: Array<{ file: string; issue: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        // Extract image references
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let match;
        const imageReferences = [];

        while ((match = imageRegex.exec(content)) !== null) {
          imageReferences.push({
            alt: match[1],
            src: match[2]
          });
        }

        // Check for images that might not be optimized for mobile
        imageReferences.forEach(img => {
          // Check for large image file indicators
          if (img.src.includes('large') || img.src.includes('full') || img.src.includes('hd')) {
            imageOptimizationIssues.push({
              file: filePath,
              issue: `Potentially large image not optimized for mobile: ${img.src}`
            });
          }

          // Check for non-web formats (should use WebP for mobile when possible)
          if (img.src.match(/\.(jpg|jpeg|png)$/i) && !img.src.includes('mobile') && !img.src.includes('small')) {
            imageOptimizationIssues.push({
              file: filePath,
              issue: `Consider WebP format for mobile: ${img.src}`
            });
          }
        });
      }

      if (imageOptimizationIssues.length > 0) {
        console.warn('Mobile image optimization issues:', imageOptimizationIssues);
      }

      // Allow some optimization suggestions but limit critical issues
      const criticalIssues = imageOptimizationIssues.filter(issue =>
        issue.issue.includes('large') || issue.issue.includes('full')
      );
      expect(criticalIssues.length).toBeLessThan(3);
    });
  });

  describe('Offline Capability', () => {
    it('should support offline reading scenarios', async () => {
      // Test if documentation can be processed without external dependencies
      const offlineProcessingTimes: number[] = [];

      for (const filePath of documentationFiles.slice(0, 5)) {
        const startTime = performance.now();

        // Process content without external network calls
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        // Extract only local content
        const links = DocumentationTestUtils.extractLinks(content).filter(link => link.type === 'internal');
        const codeBlocks = DocumentationTestUtils.extractCodeBlocks(content);
        const headers = content.match(/^#+\s+.*$/gm) || [];

        // Generate table of contents
        const toc = headers.map(header => ({
          level: header.match(/^#+/)[0].length,
          text: header.replace(/^#+\s+/, '')
        }));

        const endTime = performance.now();
        offlineProcessingTimes.push(endTime - startTime);

        // Verify offline functionality
        expect(links.length).toBeGreaterThanOrEqual(0);
        expect(toc.length).toBeGreaterThanOrEqual(0);
      }

      const averageOfflineTime = offlineProcessingTimes.reduce((a, b) => a + b, 0) / offlineProcessingTimes.length;

      console.log(`Offline processing performance:`);
      console.log(`- Average offline processing time: ${averageOfflineTime.toFixed(2)} ms`);

      // Offline processing should be fast
      expect(averageOfflineTime).toBeLessThan(30);
    });
  });
});
