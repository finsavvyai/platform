/**
 * Re-export barrel — preserved for backward compatibility.
 * Implementation moved to ./openclaw-bridge/ directory.
 */
export {
	OpenClawBridge,
	getOpenClawBridge,
	type AgentResult,
	type SearchResult,
	type TenantSecurityAnalysis,
	type LicenseOptimizationResult,
	type TenantSecurityContext,
	type LicenseContext,
} from './openclaw-bridge/index';
