export { InMemoryUsageMeter, type UsageMeter } from "./meter.js";
export {
  checkAndConsume,
  type GateDecision,
  type GateDeps,
} from "./gate.js";
export {
  SCREEN_TOOL,
  handleScreen,
  type ScreenClientLike,
  type ScreenToolDeps,
} from "./screen-tool.js";
export { SnapshotStore, type BillingSnapshot } from "./config-store.js";
export {
  SCREEN_ENTITLEMENT_KEY,
  type CustomerResolver,
  type ScreenToolTextResult,
} from "./types.js";

// Transport entry points (server.ts / bin.ts) import the MCP SDK and are
// intentionally NOT re-exported here, so this public API stays usable
// without the SDK and the core logic is unit-testable in isolation.
