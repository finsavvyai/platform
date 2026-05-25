export { RemediationExecutor } from './executor';
export type { RemediationAction, RemediationResult, DryRunResult } from './executor';
export {
	executeRollback,
	createRollbackPlan,
	isRollbackSupported,
	getIrreversibleReason,
	RollbackNotSupportedError
} from './rollback';
export type { RollbackAction } from './rollback';
export { getDryRunResult } from './dry-run';
export type { DryRunPreview } from './dry-run';
export { decommissionUser } from './actions/decommission-user';
export { enableMfa } from './actions/enable-mfa';
export { blockIp } from './actions/block-ip';
export { downgradeLicense } from './actions/downgrade-license';
export { revokeSessions } from './actions/revoke-sessions';
export { removeGuest } from './actions/remove-guest';
export { forcePasswordReset } from './actions/force-password-reset';
export { restrictSharing } from './actions/restrict-sharing';
export { enableConditionalAccess } from './actions/enable-conditional-access';
