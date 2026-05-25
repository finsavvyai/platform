import { describe, expect, it } from 'vitest';
import {
	evaluateFederatedCredentials,
	buildAuditResult,
	type FederatedCredential,
} from './federated-identity-auditor';

const makeCred = (overrides: Partial<FederatedCredential> = {}): FederatedCredential => ({
	appId: 'app-1',
	appDisplayName: 'Test App',
	credentialId: 'cred-1',
	issuer: 'https://token.actions.githubusercontent.com',
	subject: 'repo:org/repo:ref:refs/heads/main',
	audiences: ['api://AzureADTokenExchange'],
	description: 'GitHub Actions',
	...overrides,
});

describe('Federated Identity Auditor', () => {
	describe('evaluateFederatedCredentials', () => {
		it('passes compliant credentials', () => {
			const creds = [makeCred()];
			const findings = evaluateFederatedCredentials(creds, new Set());
			expect(findings).toHaveLength(0);
		});

		it('flags wildcard subject', () => {
			const creds = [makeCred({ subject: '*' })];
			const findings = evaluateFederatedCredentials(creds, new Set());
			expect(findings).toHaveLength(1);
			expect(findings[0].issue).toBe('wildcard_subject');
			expect(findings[0].severity).toBe('critical');
		});

		it('flags empty subject', () => {
			const creds = [makeCred({ subject: '' })];
			const findings = evaluateFederatedCredentials(creds, new Set());
			expect(findings.some((f) => f.issue === 'wildcard_subject')).toBe(true);
		});

		it('flags broad repo scope without branch/env', () => {
			const creds = [makeCred({ subject: 'repo:org/repo' })];
			const findings = evaluateFederatedCredentials(creds, new Set());
			expect(findings.some((f) => f.issue === 'broad_repo_scope')).toBe(true);
		});

		it('passes repo-scoped with environment', () => {
			const creds = [makeCred({ subject: 'repo:org/repo:environment:production' })];
			const findings = evaluateFederatedCredentials(creds, new Set());
			expect(findings).toHaveLength(0);
		});

		it('flags privileged service principal', () => {
			const creds = [makeCred({ appId: 'priv-app' })];
			const findings = evaluateFederatedCredentials(creds, new Set(['priv-app']));
			expect(findings.some((f) => f.issue === 'privileged_sp')).toBe(true);
		});

		it('flags unknown issuer', () => {
			const creds = [makeCred({ issuer: 'https://evil.example.com' })];
			const findings = evaluateFederatedCredentials(creds, new Set());
			expect(findings.some((f) => f.issue === 'unknown_issuer')).toBe(true);
		});

		it('combines multiple findings for one credential', () => {
			const creds = [makeCred({ subject: '*', issuer: 'https://unknown.com', appId: 'p1' })];
			const findings = evaluateFederatedCredentials(creds, new Set(['p1']));
			expect(findings.length).toBeGreaterThanOrEqual(3);
		});
	});

	describe('buildAuditResult', () => {
		it('calculates score correctly', () => {
			const creds = [makeCred({ credentialId: 'c1' }), makeCred({ credentialId: 'c2', subject: '*' })];
			const findings = evaluateFederatedCredentials(creds, new Set());
			const result = buildAuditResult(2, creds, findings);
			expect(result.totalCredentials).toBe(2);
			expect(result.compliantCount).toBe(1);
			expect(result.nonCompliantCount).toBe(1);
			expect(result.score).toBe(50);
		});

		it('returns 100 for empty credentials', () => {
			const result = buildAuditResult(0, [], []);
			expect(result.score).toBe(100);
		});
	});
});
