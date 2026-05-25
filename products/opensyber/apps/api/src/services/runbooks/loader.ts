import { runbookSchema, type Runbook } from './types.js';

/**
 * Runbook loader.
 *
 * Runbook *definitions* are JSON files at skills/runbooks/*.json — versioned
 * with code so changes go through PR review. Two loading paths:
 *
 *   1. Built-in registry: bundled JSON imported at build time. Used by the
 *      Worker runtime (no fs in Workers).
 *   2. Custom source: any caller can pass an array of raw JSON values. Used
 *      by tests and by future runtime extension points (e.g., DB-stored
 *      definitions).
 */

// Built-in runbook JSON imports. Keep this list short and explicit.
// resolveJsonModule (root tsconfig) lets us import .json directly.
import phishingTriage from '../../../../../skills/runbooks/phishing-triage.json';

/**
 * The built-in registry. Add new runbooks here when shipping defaults.
 */
const BUILTIN_SOURCES: unknown[] = [phishingTriage];

/**
 * Validates a single raw runbook value. Throws on invalid schema with the
 * zod issues attached so callers can surface useful errors.
 */
export function parseRunbook(raw: unknown): Runbook {
  const parsed = runbookSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid runbook definition: ${detail}`);
  }
  return parsed.data;
}

/**
 * Validate and return all runbooks from the given sources (or built-ins
 * if omitted). Skips invalid entries silently in production paths is a
 * footgun — this throws instead so we surface bad shipped runbooks loudly.
 */
export function loadRunbooks(sources: unknown[] = BUILTIN_SOURCES): Runbook[] {
  return sources.map(parseRunbook);
}

/**
 * Look up a runbook by id from a (validated) registry.
 */
export function findRunbook(
  id: string,
  registry: Runbook[],
): Runbook | undefined {
  return registry.find((rb) => rb.id === id);
}

/**
 * Match a trigger event against a runbook's trigger spec via shallow
 * equality. Empty trigger spec ({}) matches anything (manual runs).
 */
export function matchesTrigger(
  runbook: Runbook,
  event: Record<string, unknown>,
): boolean {
  for (const [key, expected] of Object.entries(runbook.trigger)) {
    if (event[key] !== expected) return false;
  }
  return true;
}

/**
 * Find runbooks whose trigger pattern matches the given event.
 */
export function findMatchingRunbooks(
  event: Record<string, unknown>,
  registry: Runbook[],
): Runbook[] {
  return registry.filter(
    (rb) => Object.keys(rb.trigger).length > 0 && matchesTrigger(rb, event),
  );
}
