export { discoverFromActivity } from './agent-activity-discoverer.js';
export { discoverFromCspmFindings } from './cspm-discoverer.js';
export { runDiscoveryPipeline, upsertAssets, upsertRelations } from './discovery-pipeline.js';
export { classifyFileSensitivity, classifyEnvVarSensitivity } from './sensitivity-rules.js';
export { discoverAfterActivitySync, discoverAfterCspmScan } from './hooks.js';
export type {
  DiscoveredAsset, DiscoveredRelation, DiscoveryResult,
  AgentActivityRecord, CspmFindingRecord,
} from './types.js';
