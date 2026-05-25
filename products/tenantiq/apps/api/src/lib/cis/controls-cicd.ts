/**
 * CIS CI/CD & Supply Chain Security Controls
 */
import type { CisControl } from './control-definitions';

const ENTRA = 'https://portal.azure.com/#view/Microsoft_AAD_IAM';

export const CICD_CONTROLS: CisControl[] = [
	{ id: 'CICD-05', section: 'CI/CD', title: 'Federated identity credentials are repo-scoped', description: 'Federated identity credentials must use repo-scoped subject constraints, not wildcards', severity: 'critical', level: 'L2', graphCheck: 'federated_identity_scoped', expectedValue: 'All federated credentials scoped to specific repo + branch/environment', remediationHint: 'Update federated identity credential subject to include repo:org/repo:ref:refs/heads/main', portalUrl: `${ENTRA}/RegisteredApps`, autoRemediable: false },
];
