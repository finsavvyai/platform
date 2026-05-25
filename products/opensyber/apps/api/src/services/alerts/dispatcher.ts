/**
 * Alert dispatcher service - barrel re-exports
 *
 * All consumers import from this file for backward compatibility.
 * Implementation is split across:
 *   - dispatcher-types.ts (shared types and message builder)
 *   - rate-limiter.ts (per-channel rate limiting)
 *   - dispatcher-core.ts (core dispatch logic)
 *   - dispatcher-specialized.ts (violation, CSPM, and test alerts)
 */

// Types and message builder
export type { DispatchResult, AlertFinding } from './dispatcher-types.js';
export { buildAlertMessage } from './dispatcher-types.js';

// Core dispatch
export { dispatchAlerts } from './dispatcher-core.js';

// Specialized dispatchers
export {
  dispatchViolationAlerts,
  dispatchCspmAlerts,
  sendTestAlert,
} from './dispatcher-specialized.js';
