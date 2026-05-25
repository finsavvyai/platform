/**
 * @amliq/investigate-decision — public surface.
 *
 * Boot a server by composing your env-derived DI inputs into createApp().
 * See README.md "Production wiring" for a worked example.
 */

export * from "./types.js";
export { route, HIGH_RISK_MCCS, LARGE_TXN_THRESHOLD_MINOR } from "./router.js";
export {
  aggregate,
  BLOCK_THRESHOLD,
  FLAG_THRESHOLD,
  type AggregateOutput,
} from "./aggregator.js";
export { createEngineClient, type CreateEngineClientDeps } from "./engine-client.js";
export {
  createDecisionService,
  AuditEmitFailure,
  type DecisionService,
  type DecisionServiceDeps,
} from "./decision-service.js";
export {
  createApp,
  type App,
  type CreateAppDeps,
  type AuthClaims,
} from "./server.js";
