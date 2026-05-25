/**
 * @sdlc/dlp — Shared DLP (Data Loss Prevention) engine.
 *
 * Provides PII detection, masking, and policy evaluation
 * for cross-project use in the SDLC platform.
 */

export {
  PIIType,
  MaskingStrategy,
  PolicyAction,
  DEFAULT_DLP_CONFIG,
} from './types';

export type {
  PIIMatch,
  DLPConfig,
  ScanResult,
  PolicyRule,
  PolicyEvalResult,
} from './types';

export {
  FastPIIDetector,
  luhnCheck,
  validateIpRange,
} from './detector';

export {
  maskText,
  maskTextAsync,
  detokenize,
  resetTokenStore,
} from './masker';

export {
  PolicyEvaluator,
  createDefaultRules,
} from './policy';
