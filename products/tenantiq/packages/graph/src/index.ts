export { GraphClient } from './client';
export { UserOperations } from './users';
export { GroupOperations } from './groups';
export { LicenseOperations } from './licenses';
export { SecurityOperations } from './security';
export { PolicyOperations } from './policies';
export { ReportOperations } from './reports';
export { IntuneOperations } from './intune';
export { PimOperations, PIM_PRIVILEGED_TEMPLATE_IDS } from './pim';
export type {
	PimAssignmentKind,
	PimRoleDefinition,
	PimRoleAssignment,
} from './pim';
export type {
	IntuneOs,
	IntuneComplianceState,
	IntuneManagedDevice,
	IntuneCompliancePolicy,
	IntuneAppProtectionPolicy,
} from './intune';
export {
	listEmailAlerts,
	getAlertDetail,
	buildEmailAlertsFilter,
	buildEmailAlertsPath,
	DefenderEmailAlertsOperations,
} from './security-alerts';
export type {
	DefenderAlert,
	DefenderAlertDetail,
	DefenderAlertEvidence,
	DefenderAlertSeverity,
	DefenderAlertStatus,
	DefenderAlertClassification,
	DefenderAlertDetermination,
} from './security-alerts';
