/**
 * HTML Structure Extraction
 * Extracts headings, paragraphs, lists, tables, images, links
 */

import * as cheerio from 'cheerio';
import { Logger } from '../../utils/logger';
import type { HTMLStructure, FormField, Link, NavItem, Navigation } from './types';
import { SemanticExtractor } from './semantic-extractor';

export class StructureExtractor {
  private logger: Logger;
  private semantic: SemanticExtractor;

  constructor(logger: Logger) {
    this.logger = logger;
    this.semantic = new SemanticExtractor();
  }

  async extract($: cheerio.CheerioAPI): Promise<HTMLStructure> {
    const structure: HTMLStructure = {
      headings: [], paragraphs: [], lists: [], tables: [],
      images: [], links: [], forms: [], navigation: [],
      sections: [], footers: [], headers: [],
    };
    try {
      this.extractHeadings($, structure);
      this.extractParagraphs($, structure);
      this.extractLists($, structure);
      this.extractTables($, structure);
      this.extractImages($, structure);
      this.extractLinks($, structure);
      this.semantic.extractForms($, structure);
      this.semantic.extractNavigation($, structure);
      this.semantic.extractSections($, structure);
      this.semantic.extractHeadersAndFooters($, structure);
      return structure;
    } catch (error) {
      this.logger.warn('Failed to extract HTML structure:', error);
      return structure;
    }
  }

  private extractHeadings($: cheerio.CheerioAPI, s: HTMLStructure): void {
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const $el = $(el);
      s.headings.push({
        level: parseInt(el.tagName.substring(1), 10),
        text: $el.text().trim(),
        id: $el.attr('id'),
        anchor: $el.find('a').first().attr('href'),
        children: [],
      });
    });
  }

  private extractParagraphs($: cheerio.CheerioAPI, s: HTMLStructure): void {
    $('p').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (text.length > 0) {
        s.paragraphs.push({
          text, className: $el.attr('class'),
          id: $el.attr('id'), wordCount: text.split(/\s+/).length,
        });
      }
    });
  }

  private extractLists($: cheerio.CheerioAPI, s: HTMLStructure): void {
    $('ul, ol').each((_, el) => {
      const $el = $(el);
      const type = el.tagName.toLowerCase() === 'ul' ? 'unordered' : 'ordered';
      const items: string[] = [];
      $el.find('li').each((_, li) => {
        const text = $(li).text().trim();
        if (text.length > 0) items.push(text);
      });
      if (items.length > 0) {
        s.lists.push({
          type, items, className: $el.attr('class'),
          id: $el.attr('id'), level: this.getNestingLevel($el),
        });
      }
    });
  }

  private extractTables($: cheerio.CheerioAPI, s: HTMLStructure): void {
    $('table').each((_, el) => {
      const $el = $(el);
      const headers: string[] = [];
      const rows: string[][] = [];
      $el.find('tr').first().find('th, td').each((_, cell) => {
        headers.push($(cell).text().trim());
      });
      $el.find('tr').slice(1).each((_, row) => {
        const rowData: string[] = [];
        $(row).find('td, th').each((_, cell) => {
          rowData.push($(cell).text().trim());
        });
        if (rowData.length > 0) rows.push(rowData);
      });
      s.tables.push({
        id: $el.attr('id'), className: $el.attr('class'),
        headers, rows,
        caption: $el.find('caption').text().trim(),
        summary: $el.attr('summary'),
      });
    });
  }

  private extractImages($: cheerio.CheerioAPI, s: HTMLStructure): void {
    $('img').each((_, el) => {
      const $el = $(el);
      s.images.push({
        src: $el.attr('src') || '', alt: $el.attr('alt'),
        title: $el.attr('title'),
        width: parseInt($el.attr('width') || '0', 10) || undefined,
        height: parseInt($el.attr('height') || '0', 10) || undefined,
        className: $el.attr('class'), id: $el.attr('id'),
        isLazy: $el.attr('loading') === 'lazy' || $el.attr('data-src') !== undefined,
        srcset: $el.attr('srcset'),
      });
    });
  }

  private extractLinks($: cheerio.CheerioAPI, s: HTMLStructure): void {
    $('a[href]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      s.links.push({
        href, text: $el.text().trim(),
        title: $el.attr('title'), target: $el.attr('target'),
        rel: $el.attr('rel')?.split(' ').filter(Boolean) || [],
        isExternal: this.isExternalLink(href),
        isNoFollow: $el.attr('rel')?.includes('nofollow') || false,
      });
    });
  }

  getNestingLevel($el: cheerio.Cheerio<any>): number {
    let level = 0;
    let parent = $el.parent();
    while (parent.length > 0 && !parent.is('body')) {
      if (parent.is('ul, ol')) level++;
      parent = parent.parent();
    }
    return level;
  }

  isExternalLink(href: string): boolean {
    if (!href || href.startsWith('#') ||
      href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    try {
      const url = new URL(href, 'http://example.com');
      return url.hostname !== 'example.com';
    } catch { return false; }
  }
}
