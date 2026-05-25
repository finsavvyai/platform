/**
 * HTML Processor
 * Orchestrates HTML parsing, metadata, structure, content, and quality
 */

import { Logger } from '../../utils/logger';
import { DocumentProcessingError } from '../../utils/error-handler';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { marked } from 'marked';
import axios from 'axios';
import { MetadataExtractor } from './metadata-extractor';
import { StructureExtractor } from './structure-extractor';
import { ContentExtractor } from './content-extractor';
import { QualityAssessor } from './quality-assessor';
import type { HTMLProcessingResult, HTMLOptions } from './types';

export * from './types';

export class HTMLProcessor {
  private logger: Logger;
  private turndownService: TurndownService;
  private userAgent = 'Mozilla/5.0 (compatible; SDLC-DocumentProcessor/1.0; +https://sdlc.cc)';
  private timeout = 30000;
  private maxSize = 10 * 1024 * 1024;
  private metadata: MetadataExtractor;
  private structure: StructureExtractor;
  private content: ContentExtractor;
  private quality: QualityAssessor;

  constructor() {
    this.logger = new Logger('HTMLProcessor');
    this.turndownService = new TurndownService({
      headingStyle: 'atx', hr: '---', bulletListMarker: '-',
      codeBlockStyle: 'fenced', fence: '```', emDelimiter: '*',
      strongDelimiter: '**', linkStyle: 'inlined', linkReferenceStyle: 'full',
    });
    this.metadata = new MetadataExtractor(this.logger);
    this.structure = new StructureExtractor(this.logger);
    this.content = new ContentExtractor(this.logger);
    this.quality = new QualityAssessor(this.logger);
  }

  async processHTML(html: string, options: HTMLOptions = {}): Promise<HTMLProcessingResult> {
    const start = Date.now();
    try {
      this.logger.info('Processing HTML content');
      const sanitized = this.validateHTML(html);
      const $ = cheerio.load(sanitized);
      const result: HTMLProcessingResult = {
        text: '', html: sanitized, markdown: '',
        metadata: await this.metadata.extract($),
        structure: await this.structure.extract($),
        content: await this.content.extractContent($, options),
        quality: { overall: 0, contentExtraction: 0, structurePreservation: 0,
          boilerplateRemoval: 0, readabilityScore: 0, accessibilityScore: 0, seoScore: 0 },
      };
      result.text = await this.content.extractTextContent($, options);
      if (options.convertToMarkdown !== false) {
        result.markdown = this.convertToMarkdown(result.html);
      }
      if (options.removeBoilerplate !== false) {
        result.content.boilerplateRemoved = await this.content.removeBoilerplate($);
        result.content.cleanedContent = result.content.boilerplateRemoved;
      } else {
        result.content.cleanedContent = result.text;
      }
      result.quality = await this.quality.assess(result, options);
      this.logger.info(`HTML processing completed in ${Date.now() - start}ms`);
      return result;
    } catch (error) {
      this.logger.error('HTML processing failed:', error);
      throw new DocumentProcessingError(
        `HTML processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  }

  async processURL(url: string, options: HTMLOptions = {}): Promise<HTMLProcessingResult> {
    const start = Date.now();
    try {
      this.logger.info(`Processing URL: ${url}`);
      const html = await this.fetchHTML(url);
      const result = await this.processHTML(html, options);
      result.metadata.sourceUrl = url;
      result.metadata.fetchedAt = new Date();
      this.logger.info(`URL processing completed in ${Date.now() - start}ms for: ${url}`);
      return result;
    } catch (error) {
      this.logger.error(`URL processing failed for ${url}:`, error);
      throw new DocumentProcessingError(
        `URL processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  }

  async processMarkdown(markdown: string, options: HTMLOptions = {}): Promise<HTMLProcessingResult> {
    try {
      this.logger.info('Processing Markdown content');
      const html = marked(markdown);
      const result = await this.processHTML(html, { ...options, convertToMarkdown: false });
      result.metadata.contentType = 'markdown';
      return result;
    } catch (error) {
      this.logger.error('Markdown processing failed:', error);
      throw new DocumentProcessingError(
        `Markdown processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  }

  private validateHTML(html: string): string {
    if (!html || html.trim().length === 0) throw new DocumentProcessingError('HTML content is empty');
    if (html.length > this.maxSize)
      throw new DocumentProcessingError(`HTML content exceeds maximum size of ${this.maxSize / 1024 / 1024}MB`);
    const trimmed = html.trim();
    if (!trimmed.startsWith('<') || !trimmed.endsWith('>'))
      return `<!DOCTYPE html><html><head><title>Processed Document</title></head><body>${html}</body></html>`;
    return html;
  }

  private async fetchHTML(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache',
        },
        maxContentLength: this.maxSize, maxRedirects: 5,
        validateStatus: (s) => s >= 200 && s < 400,
      });
      if (response.status !== 200)
        throw new DocumentProcessingError(`HTTP ${response.status}: ${response.statusText}`);
      const ct = response.headers['content-type'] || '';
      if (!ct.includes('text/html'))
        this.logger.warn(`URL returned non-HTML content type: ${ct}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error))
        throw new DocumentProcessingError(`Failed to fetch URL: ${error.message}`, error);
      throw error;
    }
  }

  private convertToMarkdown(html: string): string {
    try { return this.turndownService.turndown(html); }
    catch (error) { this.logger.warn('Failed to convert to Markdown:', error); return ''; }
  }

  async shutdown(): Promise<void> { this.logger.info('HTML processor shutdown completed'); }
}
