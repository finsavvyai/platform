/**
 * Code Sandbox — Safe execution wrapper for user-provided code
 *
 * Validates code against dangerous patterns before executing via
 * new Function(). Not a true VM isolate, but prevents the most
 * common attack vectors: require/import, process access, network,
 * filesystem, and eval chains.
 */

import { logger } from '../utils/logger.js';

const BLOCKED_PATTERNS = [
  /\brequire\s*\(/,
  /\bimport\s*\(/,
  /\bimport\s+/,
  /\bprocess\b/,
  /\b__dirname\b/,
  /\b__filename\b/,
  /\bglobalThis\b/,
  /\bglobal\b\./,
  /\bchild_process\b/,
  /\bexecSync\b/,
  /\bspawnSync\b/,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\bconstructor\s*\[/,
  /\bconstructor\s*\.\s*constructor/,
  /\.constructor\s*\(/,
  /\bfs\s*\./,
  /\bhttp\s*\./,
  /\bhttps\s*\./,
  /\bnet\s*\./,
  /\bdgram\s*\./,
  /\bchild_process/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest/,
  /\bWebSocket\s*\(/,
];

const MAX_CODE_LENGTH = 50_000;
const EXECUTION_TIMEOUT_MS = 10_000;

export interface SandboxResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

/**
 * Validate code for dangerous patterns before execution
 */
export function validateCode(code: string): {
  safe: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  if (code.length > MAX_CODE_LENGTH) {
    violations.push(`Code exceeds max length (${code.length} > ${MAX_CODE_LENGTH})`);
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(code)) {
      violations.push(`Blocked pattern: ${pattern.source}`);
    }
  }

  return { safe: violations.length === 0, violations };
}

/**
 * Execute code in a sandboxed new Function() with validation
 */
export async function executeInSandbox(
  code: string,
  args: Record<string, unknown> = {},
): Promise<SandboxResult> {
  const start = Date.now();

  const validation = validateCode(code);
  if (!validation.safe) {
    logger.warn('Code sandbox: blocked unsafe code', {
      violations: validation.violations,
    });
    return {
      success: false,
      error: `Code validation failed: ${validation.violations.join(', ')}`,
      duration: Date.now() - start,
    };
  }

  try {
    const argNames = Object.keys(args);
    const argValues = Object.values(args);

    const fn = new Function(...argNames, `'use strict';\n${code}`);

    const resultPromise = Promise.resolve(fn(...argValues));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Execution timeout')), EXECUTION_TIMEOUT_MS),
    );

    const result = await Promise.race([resultPromise, timeoutPromise]);

    return {
      success: true,
      result,
      duration: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Code sandbox: execution failed', { error: message });
    return {
      success: false,
      error: message,
      duration: Date.now() - start,
    };
  }
}

/**
 * Validate-only mode — check if code would be allowed without executing
 */
export function isCodeSafe(code: string): boolean {
  return validateCode(code).safe;
}
