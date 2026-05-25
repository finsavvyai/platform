/**
 * HTML Structure Types
 * Headings, paragraphs, lists, tables, images, links, forms, nav
 */

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
  id?: string | undefined;
  anchor?: string | undefined;
  children: Heading[];
}

export interface Paragraph {
  text: string;
  className?: string | undefined;
  id?: string | undefined;
  wordCount: number;
}

export interface HTMLList {
  type: 'ordered' | 'unordered';
  items: string[];
  className?: string | undefined;
  id?: string | undefined;
  level: number;
}

export interface Table {
  id?: string | undefined;
  className?: string | undefined;
  headers: string[];
  rows: string[][];
  caption?: string | undefined;
  summary?: string | undefined;
}

export interface Image {
  src: string;
  alt?: string | undefined;
  title?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  className?: string | undefined;
  id?: string | undefined;
  isLazy?: boolean | undefined;
  srcset?: string | undefined;
}

export interface Link {
  href: string;
  text: string;
  title?: string | undefined;
  target?: string | undefined;
  rel?: string[] | undefined;
  isExternal?: boolean | undefined;
  isNoFollow?: boolean | undefined;
}

export interface Form {
  action?: string | undefined;
  method?: string | undefined;
  fields: FormField[];
  className?: string | undefined;
  id?: string | undefined;
}

export interface FormField {
  name: string;
  type: string;
  label?: string | undefined;
  placeholder?: string | undefined;
  required?: boolean | undefined;
  options?: string[] | undefined;
}

export interface Navigation {
  type: 'menu' | 'breadcrumb' | 'pagination' | 'toc';
  items: NavItem[];
  className?: string | undefined;
  id?: string | undefined;
}

export interface NavItem {
  text: string;
  href?: string | undefined;
  active?: boolean | undefined;
  children?: NavItem[] | undefined;
}

export interface Section {
  tag: string;
  id?: string | undefined;
  className?: string | undefined;
  content: string;
  role?: string | undefined;
}

export interface Footer {
  content: string;
  links: Link[];
  className?: string | undefined;
  id?: string | undefined;
}

export interface Header {
  content: string;
  navigation?: Navigation[] | undefined;
  className?: string | undefined;
  id?: string | undefined;
}
