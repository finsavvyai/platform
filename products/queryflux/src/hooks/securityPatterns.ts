/**
 * Security Validation — patterns, constants, and pure detection functions
 */

import type { SQLInjectionResult, XSSResult } from './securityTypes';

export const SQL_INJECTION_PATTERNS = [
  { pattern: /('|;|--)\s*(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi, name: 'SQL injection with union/select', severity: 'critical' },
  { pattern: /'\s*or\s*'1'\s*=\s*'1/gi, name: 'SQL injection tautology', severity: 'high' },
  { pattern: /'\s*or\s*1\s*=\s*1/gi, name: 'SQL injection numeric tautology', severity: 'high' },
  { pattern: /'.*--/g, name: 'SQL comment injection', severity: 'critical' },
  { pattern: /\/\*.*\*\//g, name: 'SQL multi-line comment', severity: 'medium' },
  { pattern: /';\s*drop\s+table/gi, name: 'SQL DROP TABLE injection', severity: 'critical' },
  { pattern: /';\s*insert\s+into/gi, name: 'SQL INSERT injection', severity: 'critical' },
];

export const XSS_PATTERNS = [
  { pattern: /<script[^>]*>.*?<\/script>/gis, name: 'Script tag injection', severity: 'critical' },
  { pattern: /javascript:/gi, name: 'JavaScript protocol', severity: 'high' },
  { pattern: /onerror\s*=/gi, name: 'Error event handler', severity: 'high' },
  { pattern: /onload\s*=/gi, name: 'Load event handler', severity: 'high' },
  { pattern: /<iframe[^>]*>/gi, name: 'Iframe injection', severity: 'medium' },
  { pattern: /<embed[^>]*>/gi, name: 'Embed injection', severity: 'medium' },
  { pattern: /<object[^>]*>/gi, name: 'Object injection', severity: 'medium' },
];

export const ALLOWED_FILE_TYPES = [
  'text/plain', 'text/csv', 'application/json', 'application/pdf',
  'image/jpeg', 'image/png', 'image/gif',
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const DANGEROUS_FILE_EXTENSIONS = ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar'];

export function detectSQLInjection(input: string): SQLInjectionResult {
  const detectedPatterns: string[] = [];
  let maxConfidence = 0;

  SQL_INJECTION_PATTERNS.forEach(({ pattern, name, severity }) => {
    if (pattern.test(input)) {
      detectedPatterns.push(name);
      const confidence = severity === 'critical' ? 0.95 : severity === 'high' ? 0.85 : 0.7;
      maxConfidence = Math.max(maxConfidence, confidence);
    }
  });

  let sanitized = input;
  detectedPatterns.forEach((patternName) => {
    const p = SQL_INJECTION_PATTERNS.find(q => q.name === patternName);
    if (p) sanitized = sanitized.replace(p.pattern, '');
  });

  return { isDetected: detectedPatterns.length > 0, confidence: maxConfidence, patterns: detectedPatterns, sanitized: sanitized.trim() };
}

export function detectXSS(input: string): XSSResult {
  const detectedPatterns: string[] = [];
  let maxConfidence = 0;

  XSS_PATTERNS.forEach(({ pattern, name, severity }) => {
    if (input.match(pattern)) {
      detectedPatterns.push(name);
      const confidence = severity === 'critical' ? 0.95 : severity === 'high' ? 0.85 : 0.7;
      maxConfidence = Math.max(maxConfidence, confidence);
    }
  });

  let sanitized = input;
  XSS_PATTERNS.forEach(({ pattern }) => { sanitized = sanitized.replace(pattern, ''); });

  return { isDetected: detectedPatterns.length > 0, confidence: maxConfidence, patterns: detectedPatterns, sanitized: sanitized.trim() };
}
