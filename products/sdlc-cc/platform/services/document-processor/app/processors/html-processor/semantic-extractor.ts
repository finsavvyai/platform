/**
 * Semantic Element Extraction
 * Extracts forms, navigation, sections, headers, and footers
 */

import * as cheerio from 'cheerio';
import type {
  HTMLStructure,
  FormField,
  Link,
  NavItem,
  Navigation,
} from './types';

export class SemanticExtractor {
  extractForms($: cheerio.CheerioAPI, s: HTMLStructure): void {
    $('form').each((_, el) => {
      const $el = $(el);
      const fields: FormField[] = [];
      $el.find('input, select, textarea').each((_, field) => {
        const $f = $(field);
        const type = $f.attr('type') || field.tagName.toLowerCase();
        fields.push({
          name: $f.attr('name') || '', type,
          label: $f.siblings('label').text().trim(),
          placeholder: $f.attr('placeholder'),
          required: $f.attr('required') !== undefined ? true : undefined,
          options: type === 'select'
            ? $f.find('option').map((_, opt) => $(opt).text().trim()).get()
            : undefined,
        });
      });
      s.forms.push({
        action: $el.attr('action'), method: $el.attr('method'),
        fields, className: $el.attr('class'), id: $el.attr('id'),
      });
    });
  }

  extractNavigation($: cheerio.CheerioAPI, s: HTMLStructure): void {
    $('nav, [role="navigation"]').each((_, el) => {
      const $el = $(el);
      s.navigation.push({
        type: this.inferNavigationType($el),
        items: this.extractNavigationItems($el),
        className: $el.attr('class'),
        id: $el.attr('id'),
      });
    });
  }

  extractSections($: cheerio.CheerioAPI, s: HTMLStructure): void {
    $('section, article, main, aside').each((_, el) => {
      const $el = $(el);
      s.sections.push({
        tag: el.tagName.toLowerCase(),
        id: $el.attr('id'), className: $el.attr('class'),
        content: $el.text().trim(), role: $el.attr('role'),
      });
    });
  }

  extractHeadersAndFooters(
    $: cheerio.CheerioAPI, s: HTMLStructure,
  ): void {
    $('header').each((_, el) => {
      const $el = $(el);
      s.headers.push({
        content: $el.text().trim(), navigation: [],
        className: $el.attr('class'), id: $el.attr('id'),
      });
    });
    $('footer').each((_, el) => {
      const $el = $(el);
      const links: Link[] = [];
      $el.find('a[href]').each((_, link) => {
        const $link = $(link);
        links.push({
          href: $link.attr('href') || '',
          text: $link.text().trim(),
          title: $link.attr('title'),
        });
      });
      s.footers.push({
        content: $el.text().trim(), links,
        className: $el.attr('class'), id: $el.attr('id'),
      });
    });
  }

  private inferNavigationType(
    $el: cheerio.Cheerio<any>,
  ): Navigation['type'] {
    const cn = $el.attr('class') || '';
    const id = $el.attr('id') || '';
    if (cn.includes('breadcrumb') || id.includes('breadcrumb'))
      return 'breadcrumb';
    if (cn.includes('pagination') || id.includes('pagination'))
      return 'pagination';
    if (cn.includes('toc') || id.includes('toc') || cn.includes('menu'))
      return 'toc';
    return 'menu';
  }

  private extractNavigationItems(
    $el: cheerio.Cheerio<any>,
  ): NavItem[] {
    const items: NavItem[] = [];
    $el.find('a').each((_, el) => {
      const $link = cheerio.load(el)('a');
      items.push({
        text: $link.text().trim(),
        href: $link.attr('href'),
        active: $link.hasClass('active') ||
          $link.attr('aria-current') === 'page',
      });
    });
    return items;
  }
}
