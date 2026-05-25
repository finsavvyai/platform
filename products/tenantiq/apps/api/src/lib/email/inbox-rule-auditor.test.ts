import { describe, it, expect } from 'vitest';
import { auditUserInboxRules, summarize, type InboxRule } from './inbox-rule-auditor';

const internal = new Set(['acme.com']);
const userId = 'u1';
const upn = 'alice@acme.com';

function rule(over: Partial<InboxRule>): InboxRule {
	return { id: 'r1', displayName: 'Test', isEnabled: true, actions: {}, ...over };
}

describe('auditUserInboxRules', () => {
	it('flags external forwarding as high when enabled', () => {
		const rules = [rule({ actions: { forwardTo: [{ emailAddress: { address: 'evil@external.com' } }] } })];
		const f = auditUserInboxRules(userId, upn, rules, internal);
		expect(f).toHaveLength(1);
		expect(f[0].riskType).toBe('external_forwarding');
		expect(f[0].severity).toBe('high');
		expect(f[0].externalDomains).toEqual(['external.com']);
	});

	it('downgrades to medium when forwarding rule is disabled', () => {
		const rules = [rule({ isEnabled: false, actions: { forwardTo: [{ emailAddress: { address: 'evil@external.com' } }] } })];
		const f = auditUserInboxRules(userId, upn, rules, internal);
		expect(f[0].severity).toBe('medium');
	});

	it('does not flag forwarding to internal recipients', () => {
		const rules = [rule({ actions: { forwardTo: [{ emailAddress: { address: 'bob@acme.com' } }] } })];
		const f = auditUserInboxRules(userId, upn, rules, internal);
		expect(f).toHaveLength(0);
	});

	it('flags external redirect as critical when enabled', () => {
		const rules = [rule({ actions: { redirectTo: [{ emailAddress: { address: 'evil@external.com' } }] } })];
		const f = auditUserInboxRules(userId, upn, rules, internal);
		expect(f.some(x => x.riskType === 'external_redirect' && x.severity === 'critical')).toBe(true);
	});

	it('flags forward-and-delete as critical (BEC pattern)', () => {
		const rules = [rule({ actions: {
			forwardTo: [{ emailAddress: { address: 'evil@external.com' } }],
			delete: true,
		} })];
		const f = auditUserInboxRules(userId, upn, rules, internal);
		expect(f.some(x => x.riskType === 'forward_and_delete' && x.severity === 'critical')).toBe(true);
	});

	it('flags permanent delete', () => {
		const rules = [rule({ actions: { permanentDelete: true } })];
		const f = auditUserInboxRules(userId, upn, rules, internal);
		expect(f.some(x => x.riskType === 'permanent_delete')).toBe(true);
	});

	it('flags suspicious low-visibility names', () => {
		const rules = [rule({ displayName: '.', actions: {} })];
		const f = auditUserInboxRules(userId, upn, rules, internal);
		expect(f.some(x => x.riskType === 'suspicious_name')).toBe(true);
	});

	it('does not flag normal rules', () => {
		const rules = [rule({ displayName: 'Move newsletters to folder', actions: { moveToFolder: 'newsletters' } })];
		const f = auditUserInboxRules(userId, upn, rules, internal);
		expect(f).toHaveLength(0);
	});

	it('flags forwardAsAttachmentTo same as forwardTo', () => {
		const rules = [rule({ actions: { forwardAsAttachmentTo: [{ emailAddress: { address: 'evil@external.com' } }] } })];
		const f = auditUserInboxRules(userId, upn, rules, internal);
		expect(f.some(x => x.riskType === 'external_forwarding')).toBe(true);
	});

	it('multi-recipient: dedupes external domains', () => {
		const rules = [rule({ actions: { forwardTo: [
			{ emailAddress: { address: 'a@ext1.com' } },
			{ emailAddress: { address: 'b@ext1.com' } },
			{ emailAddress: { address: 'c@ext2.com' } },
		] } })];
		const f = auditUserInboxRules(userId, upn, rules, internal);
		expect(f[0].externalDomains.sort()).toEqual(['ext1.com', 'ext2.com']);
	});
});

describe('summarize', () => {
	it('counts findings by severity and type', () => {
		const findings = [
			...auditUserInboxRules('u1', 'a@acme.com',
				[{ id: 'r1', isEnabled: true, actions: { redirectTo: [{ emailAddress: { address: 'x@ext.com' } }] } }],
				internal),
			...auditUserInboxRules('u2', 'b@acme.com',
				[{ id: 'r2', isEnabled: false, actions: { forwardTo: [{ emailAddress: { address: 'y@ext.com' } }] } }],
				internal),
		];
		const s = summarize(findings, 2, 2, 2);
		expect(s.usersAudited).toBe(2);
		expect(s.totalFindings).toBe(2);
		expect(s.findingsBySeverity.critical).toBe(1);
		expect(s.findingsBySeverity.medium).toBe(1);
		expect(s.findingsByType.external_redirect).toBe(1);
		expect(s.findingsByType.external_forwarding).toBe(1);
	});
});
