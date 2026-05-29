import { Logger } from '../utils/logger';
import { DocumentProcessingError } from '../utils/error-handler';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { marked } from 'marked';
import * as he from 'he';
import * as sanitizeHtml from 'sanitize-html';
import axios from 'axios';
import { URL } from 'url';

export interface HTMLProcessingResult {
  text: string;
  html: string;
  markdown: string;
  metadata: HTMLMetadata;
  structure: HTMLStructure;
  content: HTMLContent;
  quality: QualityMetrics;
}

export interface HTMLMetadata {
  title?: string;
  description?: string;
  keywords?: string[];
  author?: string;
  publishedDate?: Date;
  modifiedDate?: Date;
  language?: string;
  charset?: string;
  viewport?: string;
  canonicalUrl?: string;
  openGraph?: OpenGraphData;
  twitterCard?: TwitterCardData;
  jsonLD?: JSONLDData[];
  favicon?: string;
  robots?: string;
  contentType: 'html' | 'xml' | 'markdown' | 'text';
  sourceUrl?: string;
  fetchedAt?: Date;
}

export interface OpenGraphData {
  title?: string;
  description?: string;
  type?: string;
  url?: string;
  image?: string;
  siteName?: string;
  locale?: string;
}

export interface TwitterCardData {
  card?: string;
  site?: string;
  creator?: string;
  title?: string;
  description?: string;
  image?: string;
}

export interface JSONLDData {
  '@context': string;
  '@type': string;
  [key: string]: any;
}

export interface HTMLStructure {
  headings: Heading[];
  paragraphs: Paragraph[];
  lists: HTMLList[];
  tables: Table[];
  images: Image[];
  links: Link[];
  forms: Form[];
  navigation: Navigation[];
  sections: Section[];
  footers: Footer[];
  headers: Header[];
}

export interface Heading {
  level: number;
  text: string;
  id?: string;
  anchor?: string;
  children: Heading[];
}

export interface Paragraph {
  text: string;
  className?: string;
  id?: string;
  wordCount: number;
}

export interface HTMLList {
  type: 'ordered' | 'unordered';
  items: string[];
  className?: string;
  id?: string;
  level: number;
}

export interface Table {
  id?: string;
  className?: string;
  headers: string[];
  rows: string[][];
  caption?: string;
  summary?: string;
}

export interface Image {
  src: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
  className?: string;
  id?: string;
  isLazy?: boolean;
  srcset?: string;
}

export interface Link {
  href: string;
  text: string;
  title?: string;
  target?: string;
  rel?: string[];
  isExternal?: boolean;
  isNoFollow?: boolean;
}

export interface Form {
  action?: string;
  method?: string;
  fields: FormField[];
  className?: string;
  id?: string;
}

export interface FormField {
  name: string;
  type: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface Navigation {
  type: 'menu' | 'breadcrumb' | 'pagination' | 'toc';
  items: NavItem[];
  className?: string;
  id?: string;
}

export interface NavItem {
  text: string;
  href?: string;
  active?: boolean;
  children?: NavItem[];
}

export interface Section {
  tag: string;
  id?: string;
  className?: string;
  content: string;
  role?: string;
}

export interface Footer {
  content: string;
  links: Link[];
  className?: string;
  id?: string;
}

export interface Header {
  content: string;
  navigation?: Navigation[];
  className?: string;
  id?: string;
}

export interface HTMLContent {
  mainContent: string;
  sidebarContent?: string;
  headerContent?: string;
  footerContent?: string;
  navigationContent?: string;
  boilerplateRemoved: string;
  cleanedContent: string;
  readabilityScore: number;
}

export interface QualityMetrics {
  overall: number;
  contentExtraction: number;
  structurePreservation: number;
  boilerplateRemoval: number;
  readabilityScore: number;
  accessibilityScore: number;
  seoScore: number;
}

export interface HTMLOptions {
  removeBoilerplate?: boolean;
  preserveFormatting?: boolean;
  extractImages?: boolean;
  extractTables?: boolean;
  extractLinks?: boolean;
  extractMetadata?: boolean;
  includeScripts?: boolean;
  includeStyles?: boolean;
  sanitizeContent?: boolean;
  convertToMarkdown?: boolean;
  readabilityMode?: boolean;
  customSelectors?: {
    content?: string;
    title?: string;
    ignore?: string[];
  };
}

export class HTMLProcessor {
  private logger: Logger;
  private turndownService: TurndownService;
  private defaultUserAgent: string;
  private requestTimeout: number;
  private maxContentSize: number;

  constructor() {
    this.logger = new Logger('HTMLProcessor');
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full',
    });
    this.defaultUserAgent = 'Mozilla/5.0 (compatible; SDLC-DocumentProcessor/1.0; +https://sdlc.ai)';
    this.requestTimeout = 30000; // 30 seconds
    this.maxContentSize = 10 * 1024 * 1024; // 10MB
  }

  public async processHTML(html: string, options: HTMLOptions = {}): Promise<HTMLProcessingResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Processing HTML content');

      // Validate and sanitize HTML
      const sanitizedHTML = this.validateHTML(html);

      // Load HTML into cheerio
      const $ = cheerio.load(sanitizedHTML);

      // Extract content
      const result: HTMLProcessingResult = {
        text: '',
        html: sanitizedHTML,
        markdown: '',
        metadata: await this.extractHTMLMetadata($),
        structure: await this.extractHTMLStructure($),
        content: await this.extractHTMLContent($, options),
        quality: {
          overall: 0,
          contentExtraction: 0,
          structurePreservation: 0,
          boilerplateRemoval: 0,
          readabilityScore: 0,
          accessibilityScore: 0,
          seoScore: 0,
        },
      };

      // Extract text content
      result.text = await this.extractTextContent($, options);

      // Convert to markdown if requested
      if (options.convertToMarkdown !== false) {
        result.markdown = this.convertToMarkdown(result.html);
      }

      // Remove boilerplate if requested
      if (options.removeBoilerplate !== false) {
        result.content.boilerplateRemoved = await this.removeBoilerplate($);
        result.content.cleanedContent = result.content.boilerplateRemoved;
      } else {
        result.content.cleanedContent = result.text;
      }

      // Assess quality
      result.quality = await this.assessHTMLQuality(result, options);

      const duration = Date.now() - startTime;
      this.logger.info(`HTML processing completed in ${duration}ms`);

      return result;
    } catch (error) {
      this.logger.error('HTML processing failed:', error);
      throw new DocumentProcessingError(`HTML processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  }

  public async processURL(url: string, options: HTMLOptions = {}): Promise<HTMLProcessingResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`Processing URL: ${url}`);

      // Fetch HTML from URL
      const html = await this.fetchHTML(url);

      // Process the HTML
      const result = await this.processHTML(html, options);

      // Add URL-specific metadata
      result.metadata.sourceUrl = url;
      result.metadata.fetchedAt = new Date();

      const duration = Date.now() - startTime;
      this.logger.info(`URL processing completed in ${duration}ms for: ${url}`);

      return result;
    } catch (error) {
      this.logger.error(`URL processing failed for ${url}:`, error);
      throw new DocumentProcessingError(`URL processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  }

  public async processMarkdown(markdown: string, options: HTMLOptions = {}): Promise<HTMLProcessingResult> {
    try {
      this.logger.info('Processing Markdown content');

      // Convert Markdown to HTML
      const html = marked(markdown);

      // Process as HTML
      const result = await this.processHTML(html, {
        ...options,
        convertToMarkdown: false, // Don't convert back to markdown
        contentType: 'markdown',
      });

      // Update metadata
      result.metadata.contentType = 'markdown';

      return result;
    } catch (error) {
      this.logger.error('Markdown processing failed:', error);
      throw new DocumentProcessingError(`Markdown processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  }

  private validateHTML(html: string): string {
    if (!html || html.trim().length === 0) {
      throw new DocumentProcessingError('HTML content is empty');
    }

    if (html.length > this.maxContentSize) {
      throw new DocumentProcessingError(`HTML content exceeds maximum size of ${this.maxContentSize / 1024 / 1024}MB`);
    }

    // Basic HTML validation
    const trimmedHTML = html.trim();
    if (!trimmedHTML.startsWith('<') || !trimmedHTML.endsWith('>')) {
      // Wrap in basic HTML structure if needed
      return `<!DOCTYPE html><html><head><title>Processed Document</title></head><body>${html}</body></html>`;
    }

    return html;
  }

  private async fetchHTML(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        timeout: this.requestTimeout,
        headers: {
          'User-Agent': this.defaultUserAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache',
        },
        maxContentLength: this.maxContentSize,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      if (response.status !== 200) {
        throw new DocumentProcessingError(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/html')) {
        this.logger.warn(`URL returned non-HTML content type: ${contentType}`);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new DocumentProcessingError(`Failed to fetch URL: ${error.message}`, error);
      }
      throw error;
    }
  }

  private async extractHTMLMetadata($: cheerio.CheerioAPI): Promise<HTMLMetadata> {
    const metadata: HTMLMetadata = {
      contentType: 'html',
      keywords: [],
      openGraph: {},
      twitterCard: {},
      jsonLD: [],
    };

    try {
      // Basic meta tags
      metadata.title = $('title').first().text().trim() ||
                     $('meta[property="og:title"]').attr('content') ||
                     $('meta[name="twitter:title"]').attr('content');

      metadata.description = $('meta[name="description"]').attr('content') ||
                           $('meta[property="og:description"]').attr('content') ||
                           $('meta[name="twitter:description"]').attr('content');

      // Extract keywords
      const keywordsContent = $('meta[name="keywords"]').attr('content');
      if (keywordsContent) {
        metadata.keywords = keywordsContent.split(',').map(k => k.trim()).filter(k => k.length > 0);
      }

      // Author
      metadata.author = $('meta[name="author"]').attr('content') ||
                       $('meta[property="article:author"]').attr('content');

      // Dates
      const publishedDate = $('meta[property="article:published_time"]').attr('content') ||
                          $('meta[name="date"]').attr('content') ||
                          $('meta[property="og:updated_time"]').attr('content');

      if (publishedDate) {
        metadata.publishedDate = new Date(publishedDate);
      }

      const modifiedDate = $('meta[property="article:modified_time"]').attr('content');
      if (modifiedDate) {
        metadata.modifiedDate = new Date(modifiedDate);
      }

      // Language and charset
      metadata.language = $('html').attr('lang') ||
                        $('meta[http-equiv="content-language"]').attr('content');

      metadata.charset = $('meta[charset]').attr('charset') ||
                        $('meta[http-equiv="content-type"]').attr('content')?.match(/charset=([^;]+)/)?.[1];

      // Viewport
      metadata.viewport = $('meta[name="viewport"]').attr('content');

      // Canonical URL
      metadata.canonicalUrl = $('link[rel="canonical"]').attr('href');

      // Favicon
      metadata.favicon = $('link[rel="icon"]').attr('href') ||
                        $('link[rel="shortcut icon"]').attr('href');

      // Robots
      metadata.robots = $('meta[name="robots"]').attr('content');

      // Open Graph data
      $('meta[property^="og:"]').each((_, element) => {
        const $el = $(element);
        const property = $el.attr('property')?.replace('og:', '');
        const content = $el.attr('content');
        if (property && content) {
          (metadata.openGraph as any)[property] = content;
        }
      });

      // Twitter Card data
      $('meta[name^="twitter:"]').each((_, element) => {
        const $el = $(element);
        const name = $el.attr('name')?.replace('twitter:', '');
        const content = $el.attr('content');
        if (name && content) {
          (metadata.twitterCard as any)[name] = content;
        }
      });

      // JSON-LD structured data
      $('script[type="application/ld+json"]').each((_, element) => {
        try {
          const jsonLD = JSON.parse($(element).text() || '{}');
          if (jsonLD['@context']) {
            metadata.jsonLD.push(jsonLD);
          }
        } catch (error) {
          this.logger.warn('Failed to parse JSON-LD:', error);
        }
      });

      return metadata;
    } catch (error) {
      this.logger.warn('Failed to extract HTML metadata:', error);
      return metadata;
    }
  }

  private async extractHTMLStructure($: cheerio.CheerioAPI): Promise<HTMLStructure> {
    const structure: HTMLStructure = {
      headings: [],
      paragraphs: [],
      lists: [],
      tables: [],
      images: [],
      links: [],
      forms: [],
      navigation: [],
      sections: [],
      footers: [],
      headers: [],
    };

    try {
      // Extract headings
      $('h1, h2, h3, h4, h5, h6').each((_, element) => {
        const $el = $(element);
        const level = parseInt(element.tagName.substring(1), 10);
        const text = $el.text().trim();

        structure.headings.push({
          level,
          text,
          id: $el.attr('id'),
          anchor: $el.find('a').first().attr('href'),
          children: [],
        });
      });

      // Extract paragraphs
      $('p').each((_, element) => {
        const $el = $(element);
        const text = $el.text().trim();

        if (text.length > 0) {
          structure.paragraphs.push({
            text,
            className: $el.attr('class'),
            id: $el.attr('id'),
            wordCount: text.split(/\s+/).length,
          });
        }
      });

      // Extract lists
      $('ul, ol').each((_, element) => {
        const $el = $(element);
        const type = element.tagName.toLowerCase() === 'ul' ? 'unordered' : 'ordered';
        const items: string[] = [];

        $el.find('li').each((_, li) => {
          const text = $(li).text().trim();
          if (text.length > 0) items.push(text);
        });

        if (items.length > 0) {
          structure.lists.push({
            type,
            items,
            className: $el.attr('class'),
            id: $el.attr('id'),
            level: this.getNestingLevel($el),
          });
        }
      });

      // Extract tables
      $('table').each((_, element) => {
        const $el = $(element);
        const headers: string[] = [];
        const rows: string[][] = [];

        // Extract headers
        $el.find('tr').first().find('th, td').each((_, cell) => {
          headers.push($(cell).text().trim());
        });

        // Extract data rows
        $el.find('tr').slice(1).each((_, row) => {
          const rowData: string[] = [];
          $(row).find('td, th').each((_, cell) => {
            rowData.push($(cell).text().trim());
          });
          if (rowData.length > 0) rows.push(rowData);
        });

        structure.tables.push({
          id: $el.attr('id'),
          className: $el.attr('class'),
          headers,
          rows,
          caption: $el.find('caption').text().trim(),
          summary: $el.attr('summary'),
        });
      });

      // Extract images
      $('img').each((_, element) => {
        const $el = $(element);
        structure.images.push({
          src: $el.attr('src') || '',
          alt: $el.attr('alt'),
          title: $el.attr('title'),
          width: parseInt($el.attr('width') || '0', 10) || undefined,
          height: parseInt($el.attr('height') || '0', 10) || undefined,
          className: $el.attr('class'),
          id: $el.attr('id'),
          isLazy: $el.attr('loading') === 'lazy' || $el.attr('data-src') !== undefined,
          srcset: $el.attr('srcset'),
        });
      });

      // Extract links
      $('a[href]').each((_, element) => {
        const $el = $(element);
        const href = $el.attr('href') || '';

        structure.links.push({
          href,
          text: $el.text().trim(),
          title: $el.attr('title'),
          target: $el.attr('target'),
          rel: $el.attr('rel')?.split(' ').filter(Boolean) || [],
          isExternal: this.isExternalLink(href),
          isNoFollow: $el.attr('rel')?.includes('nofollow') || false,
        });
      });

      // Extract forms
      $('form').each((_, element) => {
        const $el = $(element);
        const fields: FormField[] = [];

        $el.find('input, select, textarea').each((_, field) => {
          const $field = $(field);
          const name = $field.attr('name') || '';
          const type = $field.attr('type') || field.tagName.toLowerCase();

          fields.push({
            name,
            type,
            label: $field.siblings('label').text().trim(),
            placeholder: $field.attr('placeholder'),
            required: $field.prop('required'),
            options: type === 'select' ?
              $field.find('option').map((_, opt) => $(opt).text().trim()).get() :
              undefined,
          });
        });

        structure.forms.push({
          action: $el.attr('action'),
          method: $el.attr('method'),
          fields,
          className: $el.attr('class'),
          id: $el.attr('id'),
        });
      });

      // Extract navigation elements
      $('nav, [role="navigation"]').each((_, element) => {
        const $el = $(element);
        const navType = this.inferNavigationType($el);
        const items = this.extractNavigationItems($el);

        structure.navigation.push({
          type: navType,
          items,
          className: $el.attr('class'),
          id: $el.attr('id'),
        });
      });

      // Extract sections
      $('section, article, main, aside').each((_, element) => {
        const $el = $(element);
        structure.sections.push({
          tag: element.tagName.toLowerCase(),
          id: $el.attr('id'),
          className: $el.attr('class'),
          content: $el.text().trim(),
          role: $el.attr('role'),
        });
      });

      // Extract headers and footers
      $('header').each((_, element) => {
        const $el = $(element);
        structure.headers.push({
          content: $el.text().trim(),
          navigation: [], // Would extract nested navigation if needed
          className: $el.attr('class'),
          id: $el.attr('id'),
        });
      });

      $('footer').each((_, element) => {
        const $el = $(element);
        const links: Link[] = [];

        $el.find('a[href]').each((_, link) => {
          const $link = $(link);
          links.push({
            href: $link.attr('href') || '',
            text: $link.text().trim(),
            title: $link.attr('title'),
          });
        });

        structure.footers.push({
          content: $el.text().trim(),
          links,
          className: $el.attr('class'),
          id: $el.attr('id'),
        });
      });

      return structure;
    } catch (error) {
      this.logger.warn('Failed to extract HTML structure:', error);
      return structure;
    }
  }

  private async extractHTMLContent($: cheerio.CheerioAPI, options: HTMLOptions): Promise<HTMLContent> {
    const content: HTMLContent = {
      mainContent: '',
      sidebarContent: '',
      headerContent: '',
      footerContent: '',
      navigationContent: '',
      boilerplateRemoved: '',
      cleanedContent: '',
      readabilityScore: 0,
    };

    try {
      // Extract main content
      const mainSelectors = [
        'main',
        '[role="main"]',
        '.main-content',
        '#main-content',
        '.content',
        '#content',
        'article',
        '.article-content',
      ];

      for (const selector of mainSelectors) {
        const $main = $(selector);
        if ($main.length > 0) {
          content.mainContent = $main.text().trim();
          break;
        }
      }

      // Fallback to body content
      if (!content.mainContent) {
        content.mainContent = $('body').text().trim();
      }

      // Extract sidebar content
      const sidebarSelectors = ['aside', '.sidebar', '#sidebar', '.side-content'];
      for (const selector of sidebarSelectors) {
        const $sidebar = $(selector);
        if ($sidebar.length > 0) {
          content.sidebarContent = $sidebar.text().trim();
          break;
        }
      }

      // Extract header content
      const $header = $('header').first();
      if ($header.length > 0) {
        content.headerContent = $header.text().trim();
      }

      // Extract footer content
      const $footer = $('footer').first();
      if ($footer.length > 0) {
        content.footerContent = $footer.text().trim();
      }

      // Extract navigation content
      const $nav = $('nav, [role="navigation"]');
      if ($nav.length > 0) {
        content.navigationContent = $nav.text().trim();
      }

      // Calculate readability score
      content.readabilityScore = this.calculateReadabilityScore(content.mainContent);

      return content;
    } catch (error) {
      this.logger.warn('Failed to extract HTML content:', error);
      return content;
    }
  }

  private async extractTextContent($: cheerio.CheerioAPI, options: HTMLOptions): Promise<string> {
    try {
      let text = '';

      if (options.readabilityMode) {
        // Focus on main content areas
        const contentSelectors = [
          'main', '[role="main"]', '.main-content', '.content', 'article',
        ];

        for (const selector of contentSelectors) {
          const $content = $(selector);
          if ($content.length > 0) {
            text = $content.text().trim();
            break;
          }
        }
      }

      // Fallback to body content
      if (!text) {
        text = $('body').text().trim();
      }

      // Clean up text
      text = text
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
        .trim();

      return text;
    } catch (error) {
      this.logger.warn('Failed to extract text content:', error);
      return $('body').text().trim() || '';
    }
  }

  private convertToMarkdown(html: string): string {
    try {
      return this.turndownService.turndown(html);
    } catch (error) {
      this.logger.warn('Failed to convert HTML to Markdown:', error);
      return '';
    }
  }

  private async removeBoilerplate($: cheerio.CheerioAPI): Promise<string> {
    try {
      // Remove common boilerplate elements
      const boilerplateSelectors = [
        'script', 'style', 'noscript',
        '.advertisement', '.ads', '.ads-container',
        '.sidebar', '.menu', '.navigation', '.nav',
        'header', 'footer',
        '.social', '.share', '.comments',
        '.cookie-notice', '.popup', '.modal',
        '[role="banner"]', '[role="contentinfo"]',
        '.breadcrumb', '.breadcrumbs',
      ];

      // Clone the document to avoid modifying the original
      const $clone = $.root().clone();

      // Remove boilerplate elements
      boilerplateSelectors.forEach(selector => {
        $clone.find(selector).remove();
      });

      // Get cleaned text
      return $clone.text().trim();
    } catch (error) {
      this.logger.warn('Failed to remove boilerplate:', error);
      return $.root().text().trim();
    }
  }

  private async assessHTMLQuality(result: HTMLProcessingResult, options: HTMLOptions): Promise<QualityMetrics> {
    const metrics: QualityMetrics = {
      overall: 0,
      contentExtraction: 0,
      structurePreservation: 0,
      boilerplateRemoval: 0,
      readabilityScore: 0,
      accessibilityScore: 0,
      seoScore: 0,
    };

    try {
      // Content extraction quality
      const mainContentLength = result.content.mainContent.length;
      const totalContentLength = result.text.length;
      metrics.contentExtraction = totalContentLength > 0 ? mainContentLength / totalContentLength : 0;

      // Structure preservation
      const structureElements =
        result.structure.headings.length +
        result.structure.paragraphs.length +
        result.structure.tables.length +
        result.structure.lists.length;
      metrics.structurePreservation = Math.min(1.0, structureElements / 50);

      // Boilerplate removal effectiveness
      if (result.content.boilerplateRemoved && result.text) {
        const reductionRatio = 1 - (result.content.boilerplateRemoved.length / result.text.length);
        metrics.boilerplateRemoval = Math.max(0, Math.min(1.0, reductionRatio));
      }

      // Readability score
      metrics.readabilityScore = result.content.readabilityScore / 100; // Normalize to 0-1

      // Accessibility score (basic assessment)
      const accessibilityChecks = [
        result.structure.images.filter(img => img.alt).length / Math.max(1, result.structure.images.length),
        result.structure.headings.length > 0 ? 1 : 0,
        result.metadata.language ? 1 : 0,
      ];
      metrics.accessibilityScore = accessibilityChecks.reduce((sum, score) => sum + score, 0) / accessibilityChecks.length;

      // SEO score
      const seoChecks = [
        result.metadata.title ? 1 : 0,
        result.metadata.description ? 1 : 0,
        result.metadata.keywords && result.metadata.keywords.length > 0 ? 1 : 0,
        result.structure.headings.length > 0 ? 1 : 0,
      ];
      metrics.seoScore = seoChecks.reduce((sum, score) => sum + score, 0) / seoChecks.length;

      // Calculate overall quality
      metrics.overall = (
        metrics.contentExtraction * 0.25 +
        metrics.structurePreservation * 0.20 +
        metrics.boilerplateRemoval * 0.15 +
        metrics.readabilityScore * 0.15 +
        metrics.accessibilityScore * 0.15 +
        metrics.seoScore * 0.10
      );

      return metrics;
    } catch (error) {
      this.logger.warn('Failed to assess HTML quality:', error);
      return metrics;
    }
  }

  private getNestingLevel($el: cheerio.Cheerio<any>): number {
    let level = 0;
    let parent = $el.parent();

    while (parent.length > 0 && !parent.is('body')) {
      if (parent.is('ul, ol')) level++;
      parent = parent.parent();
    }

    return level;
  }

  private isExternalLink(href: string): boolean {
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return false;
    }

    try {
      const url = new URL(href, 'http://example.com');
      return url.hostname !== 'example.com';
    } catch {
      return false;
    }
  }

  private inferNavigationType($el: cheerio.Cheerio<any>): Navigation['type'] {
    const className = $el.attr('class') || '';
    const id = $el.attr('id') || '';

    if (className.includes('breadcrumb') || id.includes('breadcrumb')) {
      return 'breadcrumb';
    }
    if (className.includes('pagination') || id.includes('pagination')) {
      return 'pagination';
    }
    if (className.includes('toc') || id.includes('toc') || className.includes('menu')) {
      return 'toc';
    }

    return 'menu';
  }

  private extractNavigationItems($el: cheerio.Cheerio<any>): NavItem[] {
    const items: NavItem[] = [];

    $el.find('a').each((_, element) => {
      const $link = $(element);
      items.push({
        text: $link.text().trim(),
        href: $link.attr('href'),
        active: $link.hasClass('active') || $link.attr('aria-current') === 'page',
      });
    });

    return items;
  }

  private calculateReadabilityScore(text: string): number {
    if (!text || text.length === 0) return 0;

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((count, word) => count + this.countSyllables(word), 0);

    if (sentences.length === 0 || words.length === 0) return 0;

    // Flesch Reading Ease Score
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;

    const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;

    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');

    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  public async shutdown(): Promise<void> {
    this.logger.info('HTML processor shutdown completed');
  }
}
