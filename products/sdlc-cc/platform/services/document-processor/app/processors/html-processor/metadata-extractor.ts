/**
 * HTML Metadata Extraction
 * Extracts meta tags, Open Graph, Twitter Card, JSON-LD data
 */

import * as cheerio from 'cheerio';
import { Logger } from '../../utils/logger';
import type { HTMLMetadata } from './types';

export class MetadataExtractor {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async extract($: cheerio.CheerioAPI): Promise<HTMLMetadata> {
    const metadata: HTMLMetadata = {
      contentType: 'html',
      keywords: [],
      openGraph: {},
      twitterCard: {},
      jsonLD: [],
    };

    try {
      this.extractBasicMeta($, metadata);
      this.extractDates($, metadata);
      this.extractDocumentMeta($, metadata);
      this.extractOpenGraph($, metadata);
      this.extractTwitterCard($, metadata);
      this.extractJsonLD($, metadata);
      return metadata;
    } catch (error) {
      this.logger.warn('Failed to extract HTML metadata:', error);
      return metadata;
    }
  }

  private extractBasicMeta(
    $: cheerio.CheerioAPI,
    metadata: HTMLMetadata,
  ): void {
    metadata.title = $('title').first().text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content');

    metadata.description = $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content');

    const keywordsContent = $('meta[name="keywords"]').attr('content');
    if (keywordsContent) {
      metadata.keywords = keywordsContent
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
    }

    metadata.author = $('meta[name="author"]').attr('content') ||
      $('meta[property="article:author"]').attr('content');
  }

  private extractDates(
    $: cheerio.CheerioAPI,
    metadata: HTMLMetadata,
  ): void {
    const publishedDate =
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="date"]').attr('content') ||
      $('meta[property="og:updated_time"]').attr('content');

    if (publishedDate) {
      metadata.publishedDate = new Date(publishedDate);
    }

    const modifiedDate =
      $('meta[property="article:modified_time"]').attr('content');
    if (modifiedDate) {
      metadata.modifiedDate = new Date(modifiedDate);
    }
  }

  private extractDocumentMeta(
    $: cheerio.CheerioAPI,
    metadata: HTMLMetadata,
  ): void {
    metadata.language = $('html').attr('lang') ||
      $('meta[http-equiv="content-language"]').attr('content');

    metadata.charset = $('meta[charset]').attr('charset') ||
      $('meta[http-equiv="content-type"]')
        .attr('content')?.match(/charset=([^;]+)/)?.[1];

    metadata.viewport = $('meta[name="viewport"]').attr('content');
    metadata.canonicalUrl = $('link[rel="canonical"]').attr('href');
    metadata.favicon = $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href');
    metadata.robots = $('meta[name="robots"]').attr('content');
  }

  private extractOpenGraph(
    $: cheerio.CheerioAPI,
    metadata: HTMLMetadata,
  ): void {
    $('meta[property^="og:"]').each((_, element) => {
      const $el = $(element);
      const property = $el.attr('property')?.replace('og:', '');
      const content = $el.attr('content');
      if (property && content) {
        (metadata.openGraph as any)[property] = content;
      }
    });
  }

  private extractTwitterCard(
    $: cheerio.CheerioAPI,
    metadata: HTMLMetadata,
  ): void {
    $('meta[name^="twitter:"]').each((_, element) => {
      const $el = $(element);
      const name = $el.attr('name')?.replace('twitter:', '');
      const content = $el.attr('content');
      if (name && content) {
        (metadata.twitterCard as any)[name] = content;
      }
    });
  }

  private extractJsonLD(
    $: cheerio.CheerioAPI,
    metadata: HTMLMetadata,
  ): void {
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonLD = JSON.parse($(element).text() || '{}');
        if (jsonLD['@context']) {
          metadata.jsonLD!.push(jsonLD);
        }
      } catch (error) {
        this.logger.warn('Failed to parse JSON-LD:', error);
      }
    });
  }
}
