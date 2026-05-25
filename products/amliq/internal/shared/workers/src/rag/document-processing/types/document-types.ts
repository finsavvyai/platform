/**
 * Intelligent Document Processing Types and Interfaces
 */

export interface DocumentProcessingRequest {
  id: string;
  documentType:
    | "auto"
    | "pdf"
    | "image"
    | "scanned_document"
    | "structured_data";
  content: ArrayBuffer;
  options?: {
    extractImages?: boolean;
    extractTables?: boolean;
    extractForms?: boolean;
    format?: string;
    timeout?: number;
    language?: string;
  };
  userId?: string;
  timestamp?: string;
}

export interface DocumentProcessingResult {
  id: string;
  requestId: string;
  documentType: string;
  classification: DocumentClassification | null;
  content: any | null;
  specializedProcessing: any | null;
  embeddings: number[];
  knowledgeGraphUpdates: any | null;
  metadata: DocumentProcessingMetadata;
  status: "completed" | "failed";
  error?: string;
}

export interface DocumentClassification {
  category: string;
  subcategories: string[];
  industry: string;
  purpose: string;
  confidence: number;
  indicators: string[];
  metadata: {
    documentType: string;
    processedAt: string;
    model: string;
    version: string;
    error?: string;
  };
}

export interface ExtractedTerms {
  type: string;
  value: string;
  importance: string;
  confidence?: number;
  position?: { start: number; end: number };
}

export interface FinancialData {
  amounts: string[];
  currencies: string[];
  dates: string[];
  accounts: string[];
  balances?: {
    [account: string]: string;
  };
  transactions?: any[];
  revenue?: string;
  expenses?: string;
  totalAmount?: number;
  dateRange?: {
    from: string;
    to: string;
  };
  hasAnomalies?: boolean;
}

export interface ComplianceMapping {
  applicableFrameworks: string[];
  requirements: ComplianceRequirement[];
  controls: ComplianceControl[];
  violations: ComplianceViolation[];
}

export interface ComplianceRequirement {
  id: string;
  framework: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: "compliant" | "non_compliant" | "partial";
}

export interface ComplianceControl {
  id: string;
  name: string;
  description: string;
  type: string;
  effectiveness: number;
  status: "active" | "inactive" | "pending";
}

export interface ComplianceViolation {
  id: string;
  requirement: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  evidence: string[];
  remediation?: string;
}

export interface DocumentProcessingMetadata {
  processingTime: number;
  pageCount: number;
  wordCount: number;
  tableCount: number;
  imageCount: number;
  confidence: number;
  languages: string[];
  hasSensitiveData: boolean;
  complianceFlags: number;
}

export interface ProcessingConfig {
  classification: {
    enabled: boolean;
    model: string;
    confidenceThreshold: number;
    categories: string[];
  };
  extraction: {
    enabled: boolean;
    model: string;
    ocrThreshold: number;
    entityThreshold: number;
    tableExtraction: boolean;
    formExtraction: boolean;
  };
  financial: {
    enabled: boolean;
    currencyDetection: boolean;
    dateNormalization: boolean;
    amountExtraction: boolean;
    accountNumberDetection: boolean;
    reconciliation: boolean;
  };
  compliance: {
    enabled: boolean;
    regulatoryFrameworks: string[];
    riskAssessment: boolean;
    complianceMapping: boolean;
    violationDetection: boolean;
  };
  processing: {
    maxFileSize: number;
    timeoutMs: number;
    enableCaching: boolean;
    cacheTTL: number;
  };
}
