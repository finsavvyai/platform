/**
 * Security Validation — shared types
 */

export interface SecurityValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  score: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SQLInjectionResult {
  isDetected: boolean;
  confidence: number;
  patterns: string[];
  sanitized: string;
}

export interface XSSResult {
  isDetected: boolean;
  confidence: number;
  patterns: string[];
  sanitized: string;
}

export interface SecurityEvent {
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface UseSecurityValidationReturn {
  detectSQLInjection: (input: string) => SQLInjectionResult;
  validateSQLQuery: (query: string) => Promise<SecurityValidationResult>;
  detectXSS: (input: string) => XSSResult;
  sanitizeHTML: (html: string) => string;
  validateEmail: (email: string) => boolean;
  validateURL: (url: string) => boolean;
  sanitizeInput: (input: string) => string;
  events: SecurityEvent[];
  logSecurityEvent: (event: Omit<SecurityEvent, 'timestamp'>) => void;
  clearEvents: () => void;
  checkRateLimit: () => Promise<boolean>;
  validateFileUpload: (file: File) => Promise<SecurityValidationResult>;
}
