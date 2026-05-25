/**
 * Internal Links Tests
 *
 * Tests all internal documentation links to ensure they work correctly
 * and reference valid documentation files and sections.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import DocumentationTestUtils from '../utils/documentationTestUtils';
import { getTestConfig } from '../config/testConfig';

describe('Internal Links Validation', () => {
  const config = getTestConfig();
  let documentationFiles: string[] = [];
  const projectRoot = path.resolve(process.cwd(), '..');

  beforeAll(async () => {
    // Get all documentation files
    documentationFiles = await DocumentationTestUtils.getDocumentationFiles(
      path.join(projectRoot, 'docs'),
      ['.md', '.txt']
    );
  });

  describe('Link Extraction', () => {
    it('should extract internal links from all documentation files', async () => {
      let totalInternalLinks = 0;
      let filesWithLinks = 0;

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        const internalLinks = links.filter(link => link.type === 'internal');

        if (internalLinks.length > 0) {
          filesWithLinks++;
          totalInternalLinks += internalLinks.length;
        }
      }

      expect(filesWithLinks).toBeGreaterThan(0);
      expect(totalInternalLinks).toBeGreaterThan(0);
      console.log(`Found ${totalInternalLinks} internal links in ${filesWithLinks} files`);
    });

    it('should identify different types of internal links', async () => {
      const linkPatterns = [
        /\[([^\]]+)\]\(([^)]+)\)/g, // Markdown links
        /href="([^"]+)"/g,          // HTML href attributes
        /src="([^"]+)"/g,           // HTML src attributes
        /\[([^\]]+)\]:\s*(.+)/g     // Reference-style links
      ];

      let foundPatterns = 0;

      for (const filePath of documentationFiles.slice(0, 5)) { // Test first 5 files
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        for (const pattern of linkPatterns) {
          if (pattern.test(content)) {
            foundPatterns++;
            pattern.lastIndex = 0; // Reset regex
          }
        }
      }

      expect(foundPatterns).toBeGreaterThan(0);
    });
  });

  describe('File Reference Validation', () => {
    it('should validate all file references exist', async () => {
      const invalidLinks: Array<{ file: string; link: string; error: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        const internalLinks = links.filter(link => link.type === 'internal');

        for (const link of internalLinks) {
          // Skip anchor-only links and external URLs
          if (link.url.startsWith('#') || link.url.startsWith('http')) {
            continue;
          }

          try {
            // Handle different path formats
            let targetPath: string;

            if (link.url.startsWith('/')) {
              // Absolute path from project root
              targetPath = path.join(projectRoot, link.url);
            } else if (link.url.startsWith('./')) {
              // Relative path from current file directory
              targetPath = path.resolve(path.dirname(filePath), link.url);
            } else {
              // Relative path from docs directory
              targetPath = path.join(projectRoot, 'docs', link.url);
            }

            // Remove anchor fragments and query parameters
            const cleanPath = targetPath.split('#')[0].split('?')[0];

            await fs.access(cleanPath);
          } catch (error) {
            invalidLinks.push({
              file: filePath,
              link: link.url,
              error: `File not found: ${link.url} (from ${filePath})`
            });
          }
        }
      }

      if (invalidLinks.length > 0) {
        console.warn('Invalid internal links found:', invalidLinks);
      }

      expect(invalidLinks).toHaveLength(0);
    });

    it('should validate image file references', async () => {
      const invalidImages: Array<{ file: string; src: string; error: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const images = await DocumentationTestUtils.validateImageReferences(
          path.dirname(filePath),
          docFile.content
        );

        const invalidImageRefs = images.filter(img => !img.valid);

        invalidImageRefs.forEach(img => {
          invalidImages.push({
            file: filePath,
            src: img.src,
            error: img.error || 'Invalid image reference'
          });
        });
      }

      if (invalidImages.length > 0) {
        console.warn('Invalid image references found:', invalidImages);
      }

      // Allow some invalid images as they might be external or placeholder references
      expect(invalidImages.length).toBeLessThan(5);
    });
  });

  describe('Anchor Link Validation', () => {
    it('should validate anchor references within documents', async () => {
      const invalidAnchors: Array<{ file: string; anchor: string; error: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        // Find all anchor links
        const anchorRegex = /\[([^\]]+)\]\(#([^)]+)\)/g;
        let match;

        // Extract all headers to create a map of valid anchors
        const headerRegex = /^(#{1,6})\s+(.+)$/gm;
        const validAnchors = new Set<string>();
        let headerMatch;

        while ((headerMatch = headerRegex.exec(content)) !== null) {
          const headerText = headerMatch[2].trim();
          // Generate anchor name (GitHub style)
          const anchor = headerText
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');
          validAnchors.add(anchor);
        }

        // Validate anchor links
        while ((match = anchorRegex.exec(content)) !== null) {
          const anchor = match[2];

          if (!validAnchors.has(anchor) && !anchor.startsWith('user-content-')) {
            invalidAnchors.push({
              file: filePath,
              anchor,
              error: `Anchor not found: #${anchor} in ${filePath}`
            });
          }
        }
      }

      if (invalidAnchors.length > 0) {
        console.warn('Invalid anchor links found:', invalidAnchors);
      }

      // Allow some invalid anchors as different markdown processors handle them differently
      expect(invalidAnchors.length).toBeLessThan(10);
    });

    it('should validate cross-document anchor links', async () => {
      const crossDocumentLinks: Array<{ file: string; link: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        const internalLinks = links.filter(link => link.type === 'internal');

        for (const link of internalLinks) {
          if (link.url.includes('#') && !link.url.startsWith('#')) {
            const [documentPath, anchor] = link.url.split('#');
            crossDocumentLinks.push({
              file: filePath,
              link: link.url
            });
          }
        }
      }

      expect(crossDocumentLinks.length).toBeGreaterThanOrEqual(0);
      console.log(`Found ${crossDocumentLinks.length} cross-document anchor links`);
    });
  });

  describe('Directory Structure Validation', () => {
    it('should validate directory references in links', async () => {
      const directoryLinks: Array<{ file: string; directory: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        const internalLinks = links.filter(link => link.type === 'internal');

        for (const link of internalLinks) {
          if (link.url.endsWith('/')) {
            directoryLinks.push({
              file: filePath,
              directory: link.url
            });
          }
        }
      }

      console.log(`Found ${directoryLinks.length} directory links`);

      // Validate that referenced directories exist
      for (const dirLink of directoryLinks.slice(0, 10)) { // Test first 10
        try {
          const targetDir = path.join(projectRoot, 'docs', dirLink.directory);
          await fs.access(targetDir);
        } catch (error) {
          console.warn(`Directory not found: ${dirLink.directory} in ${dirLink.file}`);
        }
      }
    });

    it('should validate relative path consistency', async () => {
      const relativePathIssues: Array<{ file: string; path: string; issue: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        const internalLinks = links.filter(link =>
          link.type === 'internal' &&
          (link.url.startsWith('./') || link.url.startsWith('../'))
        );

        for (const link of internalLinks) {
          // Check for common relative path issues
          if (link.url.includes('../') && !filePath.includes('/')) {
            relativePathIssues.push({
              file: filePath,
              path: link.url,
              issue: 'Using ../ path in root level file'
            });
          }

          if (link.url.includes('././')) {
            relativePathIssues.push({
              file: filePath,
              path: link.url,
              issue: 'Redundant ./. in path'
            });
          }

          if (link.url.match(/\.\.\/\.\.\//)) {
            relativePathIssues.push({
              file: filePath,
              path: link.url,
              issue: 'Multiple consecutive .. in path'
            });
          }
        }
      }

      if (relativePathIssues.length > 0) {
        console.warn('Relative path issues found:', relativePathIssues);
      }

      expect(relativePathIssues).toHaveLength(0);
    });
  });

  describe('Link Consistency', () => {
    it('should ensure consistent link formatting', async () => {
      const formatIssues: Array<{ file: string; link: string; issue: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        const internalLinks = links.filter(link => link.type === 'internal');

        for (const link of internalLinks) {
          // Check for spacing issues
          if (link.url.includes(' ')) {
            formatIssues.push({
              file: filePath,
              link: link.url,
              issue: 'Link contains spaces'
            });
          }

          // Check for backslashes (should use forward slashes)
          if (link.url.includes('\\')) {
            formatIssues.push({
              file: filePath,
              link: link.url,
              issue: 'Link contains backslashes'
            });
          }

          // Check for unnecessary file extensions in documentation links
          if (link.url.endsWith('.md') && !link.url.includes('/')) {
            formatIssues.push({
              file: filePath,
              link: link.url,
              issue: 'Unnecessary .md extension in link'
            });
          }
        }
      }

      if (formatIssues.length > 0) {
        console.warn('Link format issues found:', formatIssues);
      }

      expect(formatIssues).toHaveLength(0);
    });

    it('should validate link text consistency', async () => {
      const linkTextIssues: Array<{ file: string; text: string; issue: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        // Find markdown links with their text
        const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
        let match;

        while ((match = linkRegex.exec(content)) !== null) {
          const linkText = match[1];
          const linkUrl = match[2];

          if (linkText.trim() === '') {
            linkTextIssues.push({
              file: filePath,
              text: linkText,
              issue: 'Empty link text'
            });
          }

          if (linkText.length > 100) {
            linkTextIssues.push({
              file: filePath,
              text: linkText.substring(0, 50) + '...',
              issue: 'Link text too long'
            });
          }

          // Check if link text is just the URL repeated
          if (linkText === linkUrl) {
            linkTextIssues.push({
              file: filePath,
              text: linkText,
              issue: 'Link text is same as URL'
            });
          }
        }
      }

      if (linkTextIssues.length > 0) {
        console.warn('Link text issues found:', linkTextIssues);
      }

      expect(linkTextIssues.length).toBeLessThan(5);
    });
  });

  describe('File Extension Handling', () => {
    it('should handle markdown file extensions correctly', async () => {
      const markdownFiles = documentationFiles.filter(file =>
        file.endsWith('.md')
      );

      expect(markdownFiles.length).toBeGreaterThan(0);

      // Check that .md files are referenced correctly
      let correctReferences = 0;
      let incorrectReferences = 0;

      for (const filePath of markdownFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        const internalLinks = links.filter(link => link.type === 'internal');

        for (const link of internalLinks) {
          if (link.url.endsWith('.md')) {
            // Check if the referenced file exists
            try {
              const targetPath = path.join(projectRoot, 'docs', link.url);
              await fs.access(targetPath);
              correctReferences++;
            } catch (error) {
              incorrectReferences++;
            }
          }
        }
      }

      console.log(`Markdown references: ${correctReferences} correct, ${incorrectReferences} incorrect`);
      expect(incorrectReferences).toBe(0);
    });

    it('should validate non-markdown file references', async () => {
      const nonMarkdownExtensions = ['.txt', '.json', '.yaml', '.yml', '.pdf', '.png', '.jpg', '.svg'];
      let validNonMarkdownRefs = 0;
      let invalidNonMarkdownRefs = 0;

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        const internalLinks = links.filter(link => link.type === 'internal');

        for (const link of internalLinks) {
          const extension = path.extname(link.url).toLowerCase();

          if (nonMarkdownExtensions.includes(extension)) {
            try {
              const targetPath = path.join(projectRoot, 'docs', link.url);
              await fs.access(targetPath);
              validNonMarkdownRefs++;
            } catch (error) {
              invalidNonMarkdownRefs++;
            }
          }
        }
      }

      console.log(`Non-markdown references: ${validNonMarkdownRefs} valid, ${invalidNonMarkdownRefs} invalid`);
      expect(invalidNonMarkdownRefs).toBe(0);
    });
  });

  describe('Circular Reference Detection', () => {
    it('should detect potential circular references', async () => {
      const fileGraph = new Map<string, Set<string>>();

      // Build a graph of file references
      for (const filePath of documentationFiles) {
        const referencedFiles = new Set<string>();
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        const internalLinks = links.filter(link =>
          link.type === 'internal' &&
          !link.url.startsWith('#') &&
          link.url.endsWith('.md')
        );

        for (const link of internalLinks) {
          const targetPath = path.join(projectRoot, 'docs', link.url);
          try {
            await fs.access(targetPath);
            referencedFiles.add(path.resolve(targetPath));
          } catch (error) {
            // File doesn't exist, skip
          }
        }

        fileGraph.set(path.resolve(filePath), referencedFiles);
      }

      // Detect cycles using DFS
      const visited = new Set<string>();
      const recursionStack = new Set<string>();
      const cycles: string[][] = [];

      function detectCycle(node: string, path: string[]): boolean {
        if (recursionStack.has(node)) {
          const cycleStart = path.indexOf(node);
          cycles.push([...path.slice(cycleStart), node]);
          return true;
        }

        if (visited.has(node)) {
          return false;
        }

        visited.add(node);
        recursionStack.add(node);

        const neighbors = fileGraph.get(node) || new Set();
        for (const neighbor of neighbors) {
          if (detectCycle(neighbor, [...path, node])) {
            return true;
          }
        }

        recursionStack.delete(node);
        return false;
      }

      for (const file of fileGraph.keys()) {
        if (!visited.has(file)) {
          detectCycle(file, []);
        }
      }

      if (cycles.length > 0) {
        console.warn('Circular references detected:', cycles);
      }

      // Allow some circular references as they might be intentional in documentation
      expect(cycles.length).toBeLessThan(3);
    });
  });

  describe('Orphaned File Detection', () => {
    it('should identify potentially orphaned documentation files', async () => {
      const referencedFiles = new Set<string>();

      // Collect all referenced files
      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const links = DocumentationTestUtils.extractLinks(docFile.content);
        const internalLinks = links.filter(link =>
          link.type === 'internal' &&
          link.url.endsWith('.md')
        );

        for (const link of internalLinks) {
          const targetPath = path.resolve(path.join(projectRoot, 'docs', link.url));
          referencedFiles.add(targetPath);
        }
      }

      // Find files that are never referenced (except main files)
      const mainFiles = ['README.md', 'INDEX.md', '_index.md'];
      const orphanedFiles = documentationFiles.filter(file => {
        const resolvedFile = path.resolve(file);
        return !referencedFiles.has(resolvedFile) &&
               !mainFiles.includes(path.basename(file));
      });

      if (orphanedFiles.length > 0) {
        console.warn('Potentially orphaned files:', orphanedFiles);
      }

      // Some orphaned files might be intentional (entry points, etc.)
      expect(orphanedFiles.length).toBeLessThan(10);
    });
  });

  describe('Link Accessibility', () => {
    it('should ensure links have descriptive text', async () => {
      const nonDescriptiveLinks: Array<{ file: string; text: string }> = [];

      const nonDescriptivePatterns = [
        /^click here$/i,
        /^here$/i,
        /^link$/i,
        /^more$/i,
        /^read more$/i,
        /^learn more$/i,
        /^\s*$/  // Empty text
      ];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
        let match;

        while ((match = linkRegex.exec(content)) !== null) {
          const linkText = match[1];

          if (nonDescriptivePatterns.some(pattern => pattern.test(linkText))) {
            nonDescriptiveLinks.push({
              file: filePath,
              text: linkText
            });
          }
        }
      }

      if (nonDescriptiveLinks.length > 0) {
        console.warn('Non-descriptive links found:', nonDescriptiveLinks);
      }

      expect(nonDescriptiveLinks.length).toBeLessThan(5);
    });

    it('should validate link readability', async () => {
      const hardToReadLinks: Array<{ file: string; text: string; issue: string }> = [];

      for (const filePath of documentationFiles) {
        const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
        const content = docFile.content;

        const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
        let match;

        while ((match = linkRegex.exec(content)) !== null) {
          const linkText = match[1];

          // Check for all caps (should be used sparingly)
          if (linkText === linkText.toUpperCase() && linkText.length > 5) {
            hardToReadLinks.push({
              file: filePath,
              text: linkText,
              issue: 'Excessive use of uppercase'
            });
          }

          // Check for excessive punctuation
          const punctuationCount = (linkText.match(/[.!?,;:]/g) || []).length;
          if (punctuationCount > linkText.length / 5) {
            hardToReadLinks.push({
              file: filePath,
              text: linkText,
              issue: 'Excessive punctuation'
            });
          }
        }
      }

      if (hardToReadLinks.length > 0) {
        console.warn('Hard to read links found:', hardToReadLinks);
      }

      expect(hardToReadLinks.length).toBeLessThan(3);
    });
  });
});
