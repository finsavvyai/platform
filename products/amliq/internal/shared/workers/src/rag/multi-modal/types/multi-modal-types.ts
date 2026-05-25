/**
 * Multi-Modal Processing Types and Interfaces
 */

export type DocumentType =
  | "auto"
  | "pdf"
  | "image"
  | "scanned_document"
  | "chart"
  | "audio"
  | "video"
  | "structured_data";

export interface MultiModalRequest {
  id: string;
  documentType: DocumentType;
  content: ArrayBuffer;
  options?: ProcessingOptions;
  userId?: string;
  timestamp?: string;
}

export interface ProcessingOptions {
  format?: string;
  extractImages?: boolean;
  extractTables?: boolean;
  extractForms?: boolean;
  extractAudio?: boolean;
  extractVideoFrames?: boolean;
  timeout?: number;
  language?: string;
}

export interface MultiModalResult {
  id: string;
  requestId: string;
  documentType: DocumentType;
  content: ExtractedContent | null;
  embeddings: number[];
  entities: any[];
  classification: any;
  metadata: MultiModalMetadata;
  status: "completed" | "failed";
  error?: string;
}

export interface ExtractedContent {
  text: string;
  media: MediaContent[];
  structuredData: StructuredData[];
  extractedFields: ExtractedField[];
  metadata: {
    [key: string]: any;
    pageCount?: number;
    hasImages?: boolean;
    hasTables?: boolean;
    hasForms?: boolean;
    imageType?: string;
    isScannedDocument?: boolean;
    hasText?: boolean;
    hasStructuredData?: boolean;
    chartType?: string;
    hasData?: boolean;
    hasTrends?: boolean;
    audioType?: string;
    language?: string;
    duration?: number;
    hasTranscription?: boolean;
    videoType?: string;
    frameCount?: number;
    hasAudio?: boolean;
    format?: string;
    recordCount?: number;
    hasHeaders?: boolean;
  };
}

export interface MediaContent {
  type: "image" | "audio" | "video" | "chart";
  content: ArrayBuffer;
  metadata: {
    [key: string]: any;
    description?: string;
    position?: { x: number; y: number; width: number; height: number };
    size?: number;
    confidence?: number;
    isScannedDocument?: boolean;
    extractedElements?: string[];
    chartType?: string;
    title?: string;
    axes?: { x: string; y: string };
    dataPoints?: number;
    trends?: string[];
    summary?: string;
    duration?: number;
    sampleRate?: number;
    channels?: number;
    language?: string;
    speakerCount?: number;
    hasBackgroundNoise?: boolean;
    frameNumber?: number;
    timestamp?: number;
    analysis?: string;
    source?: string;
    transcribed?: boolean;
  };
}

export interface StructuredData {
  type: "table" | "form" | "chart_data" | "json" | "xml";
  data: any;
  metadata: {
    [key: string]: any;
    position?: { x: number; y: number; width: number; height: number };
    headers?: string[];
    rowCount?: number;
    colCount?: number;
    confidence?: number;
    fieldType?: string;
    format?: string;
    extractedAt?: string;
  };
}

export interface ExtractedField {
  name: string;
  value: string;
  confidence: number;
  type?: string;
  position?: { x: number; y: number; width: number; height: number };
}

export interface MultiModalMetadata {
  processingTime: number;
  confidence: number;
  mediaCount: number;
  structuredDataCount: number;
  textLength: number;
  extractedFields: number;
}
