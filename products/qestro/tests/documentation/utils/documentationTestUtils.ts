/**
 * Documentation Testing Utilities
 *
 * Provides common utilities and helpers for documentation testing
 * including file validation, link checking, and content analysis.
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DocumentationFile {
  path: string;
  content: string;
  metadata: {
    size: number;
    lastModified: Date;
    type: string;
  };
}

export interface LinkValidationResult {
  url: string;
  status: 'valid' | 'invalid' | 'timeout';
  statusCode?: number;
  error?: string;
  responseTime?: number;
}

export interface ContentValidationResult {
  file: string;
  issues: Array<{
    type: 'missing-section' | 'invalid-format' | 'broken-link' | 'syntax-error';
    severity: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
    column?: number;
  }>;
  score: number; // 0-100 quality score
}

export interface APIEndpointSpec {
  method: string;
  path: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  responses: Record<string, {
    description: string;
    example?: any;
  }>;
}

export class DocumentationTestUtils {
  /**
   * Read and parse documentation files
   */
  static async readDocumentationFile(filePath: string): Promise<DocumentationFile> {
    try {
      const absolutePath = path.resolve(filePath);
      const content = await fs.readFile(absolutePath, 'utf-8');
      const stats = await fs.stat(absolutePath);

      return {
        path: absolutePath,
        content,
        metadata: {
          size: stats.size,
          lastModified: stats.mtime,
          type: path.extname(absolutePath)
        }
      };
    } catch (error) {
      throw new Error(`Failed to read documentation file ${filePath}: ${error}`);
    }
  }

  /**
   * Get all documentation files in a directory
   */
  static async getDocumentationFiles(dir: string, extensions: string[] = ['.md', '.txt', '.json']): Promise<string[]> {
    const files: string[] = [];

    async function scanDirectory(currentDir: string) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await scanDirectory(fullPath);
        } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
          files.push(fullPath);
        }
      }
    }

    await scanDirectory(dir);
    return files;
  }

  /**
   * Extract all links from markdown content
   */
  static extractLinks(content: string): Array<{ url: string; type: 'internal' | 'external'; line: number }> {
    const links: Array<{ url: string; type: 'internal' | 'external'; line: number }> = [];
    const lines = content.split('\n');

    // Markdown links: [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    // Direct URLs: http:// or https://
    const urlRegex = /https?:\/\/[^\s\)]+/g;

    lines.forEach((line, lineIndex) => {
      let match;

      // Extract markdown links
      while ((match = markdownLinkRegex.exec(line)) !== null) {
        const url = match[2];
        links.push({
          url,
          type: url.startsWith('http') ? 'external' : 'internal',
          line: lineIndex + 1
        });
      }

      // Extract direct URLs
      while ((match = urlRegex.exec(line)) !== null) {
        if (!line.includes(`[${match[0]}](`)) { // Avoid double counting
          links.push({
            url: match[0],
            type: 'external',
            line: lineIndex + 1
          });
        }
      }
    });

    return links;
  }

  /**
   * Extract code blocks from markdown content
   */
  static extractCodeBlocks(content: string): Array<{ code: string; language: string; line: number }> {
    const codeBlocks: Array<{ code: string; language: string; line: number }> = [];
    const lines = content.split('\n');
    let inCodeBlock = false;
    let currentBlock: { code: string; language: string; startLine: number } | null = null;

    lines.forEach((line, lineIndex) => {
      const codeBlockStart = line.match(/^```(\w+)?/);
      const codeBlockEnd = line.startsWith('```');

      if (codeBlockStart && !inCodeBlock) {
        inCodeBlock = true;
        currentBlock = {
          code: '',
          language: codeBlockStart[1] || '',
          startLine: lineIndex + 1
        };
      } else if (codeBlockEnd && inCodeBlock && currentBlock) {
        inCodeBlock = false;
        codeBlocks.push({
          code: currentBlock.code.trim(),
          language: currentBlock.language,
          line: currentBlock.startLine
        });
        currentBlock = null;
      } else if (inCodeBlock && currentBlock) {
        currentBlock.code += line + '\n';
      }
    });

    return codeBlocks;
  }

  /**
   * Validate internal file links
   */
  static async validateInternalLinks(basePath: string, links: Array<{ url: string; line: number }>): Promise<LinkValidationResult[]> {
    const results: LinkValidationResult[] = [];

    for (const link of links) {
      try {
        // Remove anchor fragments and query parameters
        const cleanUrl = link.url.split('#')[0].split('?')[0];

        // Handle relative paths
        const fullPath = path.resolve(basePath, cleanUrl);

        await fs.access(fullPath);
        results.push({
          url: link.url,
          status: 'valid'
        });
      } catch (error) {
        results.push({
          url: link.url,
          status: 'invalid',
          error: `File not found: ${link.url}`
        });
      }
    }

    return results;
  }

  /**
   * Validate external links (HTTP/HTTPS)
   */
  static async validateExternalLinks(links: Array<{ url: string; line: number }>, timeout: number = 10000): Promise<LinkValidationResult[]> {
    const results: LinkValidationResult[] = [];

    for (const link of links) {
      try {
        const startTime = Date.now();
        const response = await fetch(link.url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(timeout)
        });
        const responseTime = Date.now() - startTime;

        results.push({
          url: link.url,
          status: response.ok ? 'valid' : 'invalid',
          statusCode: response.status,
          responseTime
        });
      } catch (error) {
        results.push({
          url: link.url,
          status: error.name === 'AbortError' ? 'timeout' : 'invalid',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Extract API endpoint specifications from documentation
   */
  static extractAPISpecifications(content: string): APIEndpointSpec[] {
    const specs: APIEndpointSpec[] = [];
    const lines = content.split('\n');

    // Look for HTTP method patterns like GET /api/users
    const httpMethodPattern = /^###?\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(.+)$/i;

    let currentSpec: Partial<APIEndpointSpec> | null = null;
    let inResponseSection = false;
    let currentResponseCode = '';

    lines.forEach((line) => {
      const methodMatch = line.match(httpMethodPattern);

      if (methodMatch) {
        // Save previous spec if exists
        if (currentSpec && currentSpec.method && currentSpec.path) {
          specs.push(currentSpec as APIEndpointSpec);
        }

        // Start new spec
        currentSpec = {
          method: methodMatch[1].toUpperCase(),
          path: methodMatch[2].trim(),
          description: '',
          parameters: [],
          responses: {}
        };
        inResponseSection = false;
      } else if (currentSpec) {
        // Handle parameters section
        if (line.includes('Parameters') || line.includes('Request Body')) {
          // Extract parameters logic would go here
        }

        // Handle response section
        if (line.match(/^\d{3}\s/)) { // e.g., "200 Success"
          inResponseSection = true;
          currentResponseCode = line.split(' ')[0];
          currentSpec.responses![currentResponseCode] = {
            description: line.substring(currentResponseCode.length).trim()
          };
        } else if (inResponseSection && line.trim()) {
          if (currentSpec.responses![currentResponseCode]) {
            currentSpec.responses![currentResponseCode].description += ' ' + line.trim();
          }
        }
      }
    });

    // Add last spec
    if (currentSpec && currentSpec.method && currentSpec.path) {
      specs.push(currentSpec as APIEndpointSpec);
    }

    return specs;
  }

  /**
   * Validate code examples by attempting to parse/execute them
   */
  static async validateCodeExamples(codeBlocks: Array<{ code: string; language: string; line: number }>): Promise<Array<{ block: typeof codeBlocks[0]; valid: boolean; error?: string }>> {
    const results: Array<{ block: typeof codeBlocks[0]; valid: boolean; error?: string }> = [];

    for (const block of codeBlocks) {
      try {
        switch (block.language.toLowerCase()) {
          case 'json':
            JSON.parse(block.code);
            results.push({ block, valid: true });
            break;

          case 'javascript':
          case 'js':
            // Basic syntax validation
            new Function(block.code);
            results.push({ block, valid: true });
            break;

          case 'typescript':
          case 'ts':
            // Would need TypeScript compiler for full validation
            // For now, just check basic syntax
            if (!block.code.includes('import ') && !block.code.includes('export ')) {
              new Function(block.code);
              results.push({ block, valid: true });
            } else {
              results.push({
                block,
                valid: false,
                error: 'TypeScript imports/exports not supported in validation'
              });
            }
            break;

          case 'bash':
          case 'shell':
          case 'sh':
            // Basic validation - check for obviously dangerous commands
            const dangerousCommands = ['rm -rf /', 'sudo rm', 'format', 'del /'];
            const hasDangerousCommand = dangerousCommands.some(cmd =>
              block.code.toLowerCase().includes(cmd.toLowerCase())
            );

            if (hasDangerousCommand) {
              results.push({
                block,
                valid: false,
                error: 'Potentially dangerous command detected'
              });
            } else {
              results.push({ block, valid: true });
            }
            break;

          case 'sql':
            // Basic SQL syntax validation
            if (block.code.trim().toUpperCase().startsWith('SELECT') ||
                block.code.trim().toUpperCase().startsWith('INSERT') ||
                block.code.trim().toUpperCase().startsWith('UPDATE') ||
                block.code.trim().toUpperCase().startsWith('DELETE') ||
                block.code.trim().toUpperCase().startsWith('CREATE') ||
                block.code.trim().toUpperCase().startsWith('ALTER') ||
                block.code.trim().toUpperCase().startsWith('DROP')) {
              results.push({ block, valid: true });
            } else {
              results.push({
                block,
                valid: false,
                error: 'Invalid SQL statement'
              });
            }
            break;

          default:
            // For unknown languages, assume valid
            results.push({ block, valid: true });
            break;
        }
      } catch (error) {
        results.push({
          block,
          valid: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Calculate documentation quality score
   */
  static calculateQualityScore(validationResult: ContentValidationResult): number {
    let score = 100;

    for (const issue of validationResult.issues) {
      switch (issue.severity) {
        case 'error':
          score -= 20;
          break;
        case 'warning':
          score -= 10;
          break;
        case 'info':
          score -= 5;
          break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Check for required documentation sections
   */
  static checkRequiredSections(content: string, requiredSections: string[]): Array<{ section: string; found: boolean }> {
    return requiredSections.map(section => ({
      section,
      found: content.toLowerCase().includes(section.toLowerCase())
    }));
  }

  /**
   * Extract table of contents from markdown
   */
  static extractTableOfContents(content: string): string[] {
    const toc: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();
        toc.push(`${'#'.repeat(level)} ${title}`);
      }
    }

    return toc;
  }

  /**
   * Check for broken image references
   */
  static async validateImageReferences(basePath: string, content: string): Promise<Array<{ src: string; valid: boolean; error?: string }>> {
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const images: Array<{ src: string; valid: boolean; error?: string }> = [];
    let match;

    while ((match = imageRegex.exec(content)) !== null) {
      const src = match[2];

      try {
        const imagePath = path.resolve(basePath, src);
        await fs.access(imagePath);
        images.push({ src, valid: true });
      } catch (error) {
        images.push({
          src,
          valid: false,
          error: `Image file not found: ${src}`
        });
      }
    }

    return images;
  }

  /**
   * Generate test report
   */
  static generateTestReport(results: {
    accuracy: ContentValidationResult[];
    usability: any[];
    completeness: any[];
    links: LinkValidationResult[];
    performance: any[];
    security: any[];
  }): string {
    const report = [
      '# Documentation Test Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Summary',
      '',
      `### Accuracy Tests`,
      `- Files tested: ${results.accuracy.length}`,
      `- Average quality score: ${results.accuracy.reduce((sum, r) => sum + r.score, 0) / results.accuracy.length}%`,
      '',
      `### Link Validation`,
      `- Total links: ${results.links.length}`,
      `- Valid links: ${results.links.filter(l => l.status === 'valid').length}`,
      `- Invalid links: ${results.links.filter(l => l.status === 'invalid').length}`,
      '',
      '## Detailed Results',
      '',
      '### Accuracy Issues',
      ...results.accuracy.flatMap(r =>
        r.issues.map(issue => `- ${r.file}: ${issue.message} (${issue.severity})`)
      ),
      '',
      '### Link Issues',
      ...results.links.filter(l => l.status !== 'valid').map(l =>
        `- ${l.url}: ${l.error || 'Invalid status'}`
      ),
      '',
    ];

    return report.join('\n');
  }
}

export default DocumentationTestUtils;
