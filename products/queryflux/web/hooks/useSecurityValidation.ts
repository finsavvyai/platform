/**
 * Security Validation Hook
 *
 * Provides client-side security validation and threat detection
 */

import { useCallback, useState } from 'react';
import apiClient from '../lib/enhanced-api-client';
import {
  ALLOWED_FILE_TYPES, MAX_FILE_SIZE, DANGEROUS_FILE_EXTENSIONS,
  detectSQLInjection as detectSQLInjectionPure,
  detectXSS as detectXSSPure,
} from './securityPatterns';
import type { SecurityEvent, SecurityValidationResult, UseSecurityValidationReturn } from './securityTypes';

export type {
  SecurityValidationResult, SQLInjectionResult, XSSResult,
  SecurityEvent, UseSecurityValidationReturn,
} from './securityTypes';
export {
  escapeHTML, escapeSQL, isValidUUID, validatePasswordStrength,
  generateSecureToken, hashString, isSafeForRendering, truncateString, validateAndSanitize,
} from './securityUtils';

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSecurityValidation(): UseSecurityValidationReturn {
  const [events, setEvents] = useState<SecurityEvent[]>([]);

  const detectSQLInjection = useCallback((input: string) => detectSQLInjectionPure(input), []);

  // Validate SQL query
  const validateSQLQuery = useCallback(async (query: string): Promise<SecurityValidationResult> => {
    const response = await apiClient.request<SecurityValidationResult>(
      'POST',
      '/api/v1/security/validate/sql',
      { query }
    );
    return response;
  }, []);

  const detectXSS = useCallback((input: string) => detectXSSPure(input), []);

  // Sanitize HTML
  const sanitizeHTML = useCallback((html: string): string => {
    // Remove all HTML tags
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }, []);

  // Validate email
  const validateEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  // Validate URL
  const validateURL = useCallback((url: string): boolean => {
    try {
      const parsed = new URL(url);
      // Only allow http and https
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, []);

  // Sanitize input
  const sanitizeInput = useCallback((input: string): string => {
    // Trim whitespace
    let sanitized = input.trim();

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Remove potentially dangerous characters
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }, []);

  // Log security event
  const logSecurityEvent = useCallback((event: Omit<SecurityEvent, 'timestamp'>) => {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    };

    setEvents((prev) => [...prev.slice(-99), securityEvent]);

    // Also send to backend
    apiClient.request('/api/v1/security/events', 'POST', securityEvent).catch((err) => {
      console.error('Failed to log security event:', err);
    });
  }, []);

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Check rate limit
  const checkRateLimit = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiClient.request<{ allowed: boolean }>(
        'GET',
        '/api/v1/security/ratelimit/check'
      );
      return response.allowed;
    } catch {
      return true; // Allow if check fails
    }
  }, []);

  // Validate file upload
  const validateFileUpload = useCallback(async (file: File): Promise<SecurityValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      errors.push(`File type not allowed: ${file.type}`);
      score -= 50;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File too large: ${file.size} bytes (max ${MAX_FILE_SIZE})`);
      score -= 30;
    }

    // Check file extension
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (DANGEROUS_FILE_EXTENSIONS.includes(extension)) {
      errors.push(`Dangerous file extension: ${extension}`);
      score -= 100;
    }

    // Check for double extensions
    const parts = file.name.split('.');
    if (parts.length > 2) {
      const lastTwo = parts.slice(-2).join('.');
      if (DANGEROUS_FILE_EXTENSIONS.some(ext => lastTwo.endsWith(ext))) {
        warnings.push('Double extension detected');
        score -= 20;
      }
    }

    // Check file name for suspicious patterns
    const suspiciousPatterns = [
      /\.\./, // Directory traversal
      /[<>:"|?*]/, // Invalid characters
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Windows reserved names
    ];

    suspiciousPatterns.forEach((pattern) => {
      if (pattern.test(file.name)) {
        warnings.push(`Suspicious file name pattern detected`);
        score -= 10;
      }
    });

    const threatLevel = score >= 80 ? 'low' : score >= 50 ? 'medium' : score >= 20 ? 'high' : 'critical';

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      score,
      threatLevel,
    };
  }, []);

  return {
    // SQL injection detection
    detectSQLInjection, validateSQLQuery,
    detectXSS, sanitizeHTML,
    validateEmail, validateURL, sanitizeInput,
    events, logSecurityEvent, clearEvents,
    checkRateLimit, validateFileUpload,
  };
}
