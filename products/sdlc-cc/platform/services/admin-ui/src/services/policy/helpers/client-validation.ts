// @ts-nocheck
/**
 * Client-side validation for policies
 */

import { getRequiredKeywords } from './policy-helpers';

interface ValidationError {
  line: number;
  column: number;
  message: string;
  type: string;
  severity: string;
  rule?: string;
  fix?: string;
}

interface ValidationWarning {
  line: number;
  column: number;
  message: string;
  type: string;
  suggestion: string;
}

export async function performClientValidation(
  code: string,
  category: string
): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    // Check for balanced braces
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push({
        line: 0, column: 0,
        message: 'Unbalanced braces in Rego code',
        type: 'syntax', severity: 'error', rule: 'balanced_braces'
      });
    }

    // Check for required keywords based on category
    const requiredKeywords = getRequiredKeywords(category);
    for (const keyword of requiredKeywords) {
      if (!code.includes(keyword)) {
        warnings.push({
          line: 0, column: 0,
          message: `Policy might be missing required keyword: ${keyword}`,
          type: 'missing_keyword',
          suggestion: `Consider adding '${keyword}' to your policy`
        });
      }
    }

    // Security validation
    if (code.includes('http.send')) {
      errors.push({
        line: 0, column: 0,
        message: 'HTTP requests are not allowed in policies',
        type: 'security', severity: 'error',
        rule: 'no_http_requests',
        fix: 'Remove HTTP requests from policy or use external data'
      });
    }
  } catch (error) {
    errors.push({
      line: 0, column: 0,
      message: 'Unexpected error during validation',
      type: 'semantic', severity: 'error'
    });
  }

  return { errors, warnings };
}
