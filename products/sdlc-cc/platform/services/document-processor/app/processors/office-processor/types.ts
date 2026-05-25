/**
 * Office Processor - Type Definitions
 */

export interface OfficeDocumentResult {
  text: string;
  documentType: 'word' | 'excel' | 'powerpoint';
  metadata: OfficeMetadata;
  structure: DocumentStructure;
  content: OfficeContent;
  quality: QualityMetrics;
}

export interface OfficeMetadata {
  title?: string | undefined;
  author?: string | undefined;
  subject?: string | undefined;
  keywords?: string[] | undefined;
  creationDate?: Date | undefined;
  modificationDate?: Date | undefined;
  lastModifiedBy?: string | undefined;
  category?: string | undefined;
  comments?: string | undefined;
  template?: string | undefined;
  language?: string | undefined;
  pageCount?: number | undefined;
  wordCount?: number | undefined;
  sheetCount?: number | undefined;
  slideCount?: number | undefined;
  isTemplate: boolean;
  hasMacros: boolean;
  hasEmbeddedContent: boolean;
  version?: string | undefined;
}

export interface DocumentStructure {
  headings: Heading[];
  paragraphs: Paragraph[];
  tables: Table[];
  lists: List[];
  sections: Section[];
  footnotes: Footnote[];
  endnotes: Endnote[];
  headers: HeaderFooter[];
  footers: HeaderFooter[];
}

export interface Heading {
  level: number;
  text: string;
  pageNumber?: number | undefined;
  style?: string | undefined;
  id?: string | undefined;
}

export interface Paragraph {
  text: string;
  style?: string | undefined;
  pageNumber?: number | undefined;
  alignment?: 'left' | 'center' | 'right' | 'justify' | undefined;
  indentation?: number | undefined;
  spacing?: number | undefined;
}

export interface Table {
  id: string;
  rows: number;
  columns: number;
  data: string[][];
  headers?: string[] | undefined;
  style?: string | undefined;
  pageNumber?: number | undefined;
  title?: string | undefined;
}

export interface List {
  type: 'bulleted' | 'numbered';
  items: string[];
  level: number;
  pageNumber?: number;
  style?: string;
}

export interface Section {
  title?: string;
  pageNumber?: number;
  content: string;
  type: 'chapter' | 'section' | 'subsection' | 'appendix';
}

export interface Footnote {
  id: string;
  text: string;
  reference: string;
  pageNumber?: number;
}

export interface Endnote {
  id: string;
  text: string;
  reference: string;
  pageNumber?: number;
}

export interface HeaderFooter {
  type: 'header' | 'footer';
  text: string;
  pageNumber?: number;
  position: 'left' | 'center' | 'right';
}

export interface OfficeContent {
  mainContent: string;
  embeddedObjects: EmbeddedObject[];
  hyperlinks: Hyperlink[];
  comments: Comment[];
  revisions: Revision[];
  bookmarks: Bookmark[];
}

export interface EmbeddedObject {
  id: string;
  type: 'image' | 'chart' | 'table' | 'document' | 'media';
  name?: string;
  description?: string;
  size?: number;
  format?: string;
  data?: Buffer;
}

export interface Hyperlink {
  text: string;
  url: string;
  title?: string;
  pageNumber?: number;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  date: Date;
  pageNumber?: number;
  resolved?: boolean;
}

export interface Revision {
  id: string;
  author: string;
  type: 'insertion' | 'deletion' | 'formatting';
  text?: string;
  date: Date;
  accepted?: boolean;
}

export interface Bookmark {
  id: string;
  name: string;
  pageNumber?: number;
  position?: number;
}

export interface QualityMetrics {
  overall: number;
  textCompleteness: number;
  structurePreservation: number;
  formattingAccuracy: number;
  metadataExtraction: number;
  contentIntegrity: number;
}

export interface OfficeProcessingOptions {
  extractImages?: boolean;
  extractTables?: boolean;
  extractMetadata?: boolean;
  preserveFormatting?: boolean;
  includeComments?: boolean;
  includeRevisions?: boolean;
  extractFormulas?: boolean;
  extractSpeakerNotes?: boolean;
}
