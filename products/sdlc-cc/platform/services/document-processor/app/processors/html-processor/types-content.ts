/**
 * HTML Content, Metadata, and Options Types
 */

import type { HTMLStructure } from './types-structure';

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
  title?: string | undefined;
  description?: string | undefined;
  keywords?: string[] | undefined;
  author?: string | undefined;
  publishedDate?: Date | undefined;
  modifiedDate?: Date | undefined;
  language?: string | undefined;
  charset?: string | undefined;
  viewport?: string | undefined;
  canonicalUrl?: string | undefined;
  openGraph?: OpenGraphData | undefined;
  twitterCard?: TwitterCardData | undefined;
  jsonLD?: JSONLDData[] | undefined;
  favicon?: string | undefined;
  robots?: string | undefined;
  contentType: 'html' | 'xml' | 'markdown' | 'text';
  sourceUrl?: string | undefined;
  fetchedAt?: Date | undefined;
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
  [key: string]: unknown;
}

export interface HTMLContent {
  mainContent: string;
  sidebarContent?: string | undefined;
  headerContent?: string | undefined;
  footerContent?: string | undefined;
  navigationContent?: string | undefined;
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
