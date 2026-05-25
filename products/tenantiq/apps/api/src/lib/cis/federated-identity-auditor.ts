/**
 * Entra ID OIDC Trust Auditor — CIS Control CICD-05
 *
 * Audits federated identity credential configurations per app registration.
 * Validates that subject constraints are repo-scoped (not wildcard).
 * Flags service principals with Owner/Contributor + federated identity.
 */

export interface FederatedCredential {
	appId: string;
	appDisplayName: string;
	credentialId: string;
	issuer: string;
	subject: string;
	audiences: string[];
	description: string;
}

export interface FederatedIdentityFinding {
	appId: string;
	appDisplayName: string;
	credentialId: string;
	issue: 'wildcard_subject' | 'broad_repo_scope' | 'privileged_sp' | 'unknown_issuer';
	severity: 'critical' | 'high' | 'medium';
	detail: string;
	remediation: string;
}

export interface FederatedAuditResult {
	totalApps: number;
	totalCredentials: number;
	findings: FederatedIdentityFinding[];
	compliantCount: number;
	nonCompliantCount: number;
	score: number;
	scannedAt: string;
}

const KNOWN_OIDC_ISSUERS = [
	'https://token.actions.githubusercontent.com',
	'https://gitlab.com',
	'https://dev.azure.com',
];

function isWildcardSubject(subject: string): boolean {
	return subject === '*' || subject === '' || subject.endsWith(':*');
}

function isBroadRepoScope(subject: string): boolean {
	if (!subject.startsWith('repo:')) return false;
	const afterRepo = subject.slice(5); // after 'repo:'
	return !afterRepo.includes(':ref:') && !afterRepo.includes(':environment:');
}

function isUnknownIssuer(issuer: string): boolean {
	return !KNOWN_OIDC_ISSUERS.some((k) => issuer.startsWith(k));
}

export function evaluateFederatedCredentials(
	credentials: FederatedCredential[],
	privilegedAppIds: Set<string>
): FederatedIdentityFinding[] {
	const findings: FederatedIdentityFinding[] = [];

	for (const cred of credentials) {
		if (isWildcardSubject(cred.subject)) {
			findings.push({
				appId: cred.appId,
				appDisplayName: cred.appDisplayName,
				credentialId: cred.credentialId,
				issue: 'wildcard_subject',
				severity: 'critical',
				detail: `Subject "${cred.subject}" allows any workflow to assume this identity`,
				remediation: 'Scope subject to specific repo, branch, or environment',
			});
		} else if (isBroadRepoScope(cred.subject)) {
			findings.push({
				appId: cred.appId,
				appDisplayName: cred.appDisplayName,
				credentialId: cred.credentialId,
				issue: 'broad_repo_scope',
				severity: 'high',
				detail: `Subject "${cred.subject}" is repo-scoped but not branch/env-scoped`,
				remediation: 'Add :ref:refs/heads/main or :environment:production constraint',
			});
		}

		if (privilegedAppIds.has(cred.appId)) {
			findings.push({
				appId: cred.appId,
				appDisplayName: cred.appDisplayName,
				credentialId: cred.credentialId,
				issue: 'privileged_sp',
				severity: 'critical',
				detail: `App has Owner/Contributor role + federated identity credential`,
				remediation: 'Reduce SP permissions or use environment-scoped credentials',
			});
		}

		if (isUnknownIssuer(cred.issuer)) {
			findings.push({
				appId: cred.appId,
				appDisplayName: cred.appDisplayName,
				credentialId: cred.credentialId,
				issue: 'unknown_issuer',
				severity: 'medium',
				detail: `Issuer "${cred.issuer}" is not a recognized CI/CD provider`,
				remediation: 'Verify the issuer is a trusted OIDC provider',
			});
		}
	}

	return findings;
}

export function buildAuditResult(
	totalApps: number,
	credentials: FederatedCredential[],
	findings: FederatedIdentityFinding[]
): FederatedAuditResult {
	const uniqueNonCompliant = new Set(findings.map((f) => f.credentialId));
	const compliantCount = credentials.length - uniqueNonCompliant.size;
	const score = credentials.length > 0
		? Math.round((compliantCount / credentials.length) * 100)
		: 100;

	return {
		totalApps,
		totalCredentials: credentials.length,
		findings,
		compliantCount,
		nonCompliantCount: uniqueNonCompliant.size,
		score,
		scannedAt: new Date().toISOString(),
	};
}
