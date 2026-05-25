export interface PDFExtractionResult {
  text: string;
  pages: PDFPage[];
  metadata: PDFMetadata;
  images: PDFImage[];
  tables: PDFTable[];
  forms: PDFFormData[];
  quality: QualityMetrics;
}

export interface PDFPage {
  pageNumber: number;
  text: string;
  boundingBoxes: BoundingBox[];
  images: PDFImage[];
  tables: PDFTable[];
  quality: number;
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  keywords?: string[];
  pageCount: number;
  isEncrypted: boolean;
  isScanned: boolean;
  hasImages: boolean;
  hasTables: boolean;
  hasForms: boolean;
  language?: string;
}

export interface PDFImage {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  imageData?: Buffer;
  confidence: number;
  isChart: boolean;
  isDiagram: boolean;
}

export interface PDFTable {
  id: string;
  pageNumber: number;
  rows: number;
  columns: number;
  data: string[][];
  confidence: number;
  boundingBox: BoundingBox;
}

export interface PDFFormData {
  id: string;
  fieldName: string;
  fieldType: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'signature';
  value?: string;
  options?: string[];
  pageNumber: number;
  boundingBox: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QualityMetrics {
  overall: number;
  textClarity: number;
  structurePreservation: number;
  ocrConfidence?: number;
  extractionCompleteness: number;
  formattingAccuracy: number;
}

export interface PDFOptions {
  extractImages?: boolean;
  extractTables?: boolean;
  extractForms?: boolean;
  enableOCR?: boolean;
  language?: string;
  preserveFormatting?: boolean;
  maxImageSize?: number;
  imageFormat?: 'png' | 'jpg';
}
