/**
 * HTML Content Extraction
 * Main content, sidebar, header, footer, boilerplate removal, readability
 */

import * as cheerio from 'cheerio';
import { Logger } from '../../utils/logger';
import type { HTMLContent, HTMLOptions } from './types';

export class ContentExtractor {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async extractContent(
    $: cheerio.CheerioAPI,
    options: HTMLOptions,
  ): Promise<HTMLContent> {
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
      content.mainContent = this.extractMain($);
      content.sidebarContent = this.extractSidebar($);
      content.headerContent = $('header').first().text().trim();
      content.footerContent = $('footer').first().text().trim();
      content.navigationContent =
        $('nav, [role="navigation"]').text().trim();
      content.readabilityScore =
        this.calculateReadabilityScore(content.mainContent);
      return content;
    } catch (error) {
      this.logger.warn('Failed to extract HTML content:', error);
      return content;
    }
  }

  async extractTextContent(
    $: cheerio.CheerioAPI,
    options: HTMLOptions,
  ): Promise<string> {
    try {
      let text = '';

      if (options.readabilityMode) {
        const contentSelectors = [
          'main', '[role="main"]', '.main-content',
          '.content', 'article',
        ];
        for (const selector of contentSelectors) {
          const $content = $(selector);
          if ($content.length > 0) {
            text = $content.text().trim();
            break;
          }
        }
      }

      if (!text) {
        text = $('body').text().trim();
      }

      text = text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

      return text;
    } catch (error) {
      this.logger.warn('Failed to extract text content:', error);
      return $('body').text().trim() || '';
    }
  }

  async removeBoilerplate($: cheerio.CheerioAPI): Promise<string> {
    try {
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

      const $clone = $.root().clone();
      boilerplateSelectors.forEach(selector => {
        $clone.find(selector).remove();
      });
      return $clone.text().trim();
    } catch (error) {
      this.logger.warn('Failed to remove boilerplate:', error);
      return $.root().text().trim();
    }
  }

  private extractMain($: cheerio.CheerioAPI): string {
    const mainSelectors = [
      'main', '[role="main"]', '.main-content',
      '#main-content', '.content', '#content',
      'article', '.article-content',
    ];
    for (const selector of mainSelectors) {
      const $main = $(selector);
      if ($main.length > 0) {
        return $main.text().trim();
      }
    }
    return $('body').text().trim();
  }

  private extractSidebar($: cheerio.CheerioAPI): string {
    const sidebarSelectors = [
      'aside', '.sidebar', '#sidebar', '.side-content',
    ];
    for (const selector of sidebarSelectors) {
      const $sidebar = $(selector);
      if ($sidebar.length > 0) {
        return $sidebar.text().trim();
      }
    }
    return '';
  }

  calculateReadabilityScore(text: string): number {
    if (!text || text.length === 0) return 0;

    const sentences = text.split(/[.!?]+/)
      .filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce(
      (count, word) => count + this.countSyllables(word), 0,
    );

    if (sentences.length === 0 || words.length === 0) return 0;

    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;

    const score = 206.835
      - (1.015 * avgWordsPerSentence)
      - (84.6 * avgSyllablesPerWord);

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
}
