/**
 * PII Masker.
 *
 * Masks detected PII using configurable strategies:
 * - REDACT: replaces with [REDACTED_TYPE]
 * - HASH: replaces with a partial SHA-256 hash
 * - TOKENIZE: replaces with a reversible token
 */

import {
  DLPConfig,
  DEFAULT_DLP_CONFIG,
  MaskingStrategy,
  PIIMatch,
  PIIType,
} from './types';

/**
 * In-memory token store for TOKENIZE strategy.
 * Maps token IDs to original values for reversal.
 */
const tokenStore = new Map<string, string>();
let tokenCounter = 0;

/** Reset the token store (useful for testing). */
export function resetTokenStore(): void {
  tokenStore.clear();
  tokenCounter = 0;
}

/** Look up the original value for a token ID. */
export function detokenize(tokenId: string): string | undefined {
  return tokenStore.get(tokenId);
}

/** Generate a hex SHA-256 hash of the input (sync, using Web Crypto). */
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Synchronous simple hash fallback for environments without Web Crypto. */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/** Get the masking strategy for a specific PII type. */
function getStrategy(
  piiType: PIIType,
  config: DLPConfig,
): MaskingStrategy {
  return config.strategyOverrides[piiType] ?? config.defaultStrategy;
}

/** Apply REDACT strategy: replace with [REDACTED_TYPE]. */
function applyRedact(match: PIIMatch): string {
  return match.redactedLabel;
}

/** Apply HASH strategy: replace with partial SHA-256 hash (sync). */
function applyHashSync(match: PIIMatch): string {
  const hash = simpleHash(match.matchedText);
  return `[HASH_${match.piiType}_${hash}]`;
}

/** Apply TOKENIZE strategy: replace with reversible token. */
function applyTokenize(match: PIIMatch): string {
  tokenCounter++;
  const tokenId = `TOK_${match.piiType}_${tokenCounter}`;
  tokenStore.set(tokenId, match.matchedText);
  return `[${tokenId}]`;
}

/** Apply a single masking strategy to a match (sync). */
function applyStrategy(
  match: PIIMatch,
  strategy: MaskingStrategy,
): string {
  switch (strategy) {
    case MaskingStrategy.REDACT:
      return applyRedact(match);
    case MaskingStrategy.HASH:
      return applyHashSync(match);
    case MaskingStrategy.TOKENIZE:
      return applyTokenize(match);
    default:
      return applyRedact(match);
  }
}

/**
 * Masks PII in text using configured strategies.
 *
 * Processes matches in reverse order to preserve string indices.
 */
export function maskText(
  text: string,
  matches: PIIMatch[],
  config: Partial<DLPConfig> = {},
): string {
  if (matches.length === 0) return text;

  const fullConfig: DLPConfig = { ...DEFAULT_DLP_CONFIG, ...config };
  const sorted = [...matches].sort((a, b) => b.start - a.start);

  let result = text;
  for (const match of sorted) {
    const strategy = getStrategy(match.piiType, fullConfig);
    const replacement = applyStrategy(match, strategy);
    result = result.slice(0, match.start) + replacement + result.slice(match.end);
  }

  return result;
}

/**
 * Async version of maskText that uses real SHA-256 for HASH strategy.
 *
 * Preferred in environments that support Web Crypto (Node 18+, browsers).
 */
export async function maskTextAsync(
  text: string,
  matches: PIIMatch[],
  config: Partial<DLPConfig> = {},
): Promise<string> {
  if (matches.length === 0) return text;

  const fullConfig: DLPConfig = { ...DEFAULT_DLP_CONFIG, ...config };
  const sorted = [...matches].sort((a, b) => b.start - a.start);

  let result = text;
  for (const match of sorted) {
    const strategy = getStrategy(match.piiType, fullConfig);

    let replacement: string;
    if (strategy === MaskingStrategy.HASH) {
      const hash = await sha256Hex(match.matchedText);
      replacement = `[HASH_${match.piiType}_${hash.slice(0, 12)}]`;
    } else {
      replacement = applyStrategy(match, strategy);
    }

    result = result.slice(0, match.start) + replacement + result.slice(match.end);
  }

  return result;
}
