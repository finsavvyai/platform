import { describe, expect, it } from 'vitest';
import {
	generateRotationChecklist,
	updateChecklistWithRotation,
	verifyRotationCompleteness,
	buildRotationReport,
	type CredentialEntry,
} from './credential-rotation-verifier';

const BREACH = new Date('2026-03-28T00:00:00Z');

const credentials: CredentialEntry[] = [
	{ id: 'c1', type: 'app_secret', name: 'App Secret 1', owner: 'admin', lastRotated: null, expiresAt: null },
	{ id: 'c2', type: 'api_key', name: 'API Key 1', owner: 'svc', lastRotated: null, expiresAt: null },
	{ id: 'c3', type: 'token', name: 'Token 1', owner: 'ci', lastRotated: null, expiresAt: null },
];

describe('Credential Rotation Verifier', () => {
	describe('generateRotationChecklist', () => {
		it('creates pending items for all credentials', () => {
			const checklist = generateRotationChecklist(credentials, BREACH);
			expect(checklist).toHaveLength(3);
			expect(checklist.every((i) => i.status === 'pending')).toBe(true);
		});
	});

	describe('updateChecklistWithRotation', () => {
		it('marks credential as rotated with timestamp', () => {
			const checklist = generateRotationChecklist(credentials, BREACH);
			const rotateTime = new Date('2026-03-28T00:02:00Z');
			const updated = updateChecklistWithRotation(checklist, 'c1', rotateTime, BREACH);

			const item = updated.find((i) => i.credentialId === 'c1');
			expect(item!.status).toBe('rotated');
			expect(item!.timeSinceBreachMs).toBe(120_000); // 2 minutes
		});

		it('leaves other credentials unchanged', () => {
			const checklist = generateRotationChecklist(credentials, BREACH);
			const updated = updateChecklistWithRotation(checklist, 'c1', new Date(), BREACH);
			expect(updated.find((i) => i.credentialId === 'c2')!.status).toBe('pending');
		});
	});

	describe('verifyRotationCompleteness', () => {
		it('marks as verified when no post-rotation activity', () => {
			let checklist = generateRotationChecklist(credentials, BREACH);
			checklist = updateChecklistWithRotation(checklist, 'c1', new Date('2026-03-28T00:01:00Z'), BREACH);

			const verified = verifyRotationCompleteness(checklist, []);
			const item = verified.find((i) => i.credentialId === 'c1');
			expect(item!.status).toBe('verified');
		});

		it('flags stale usage when old token used post-rotation', () => {
			let checklist = generateRotationChecklist(credentials, BREACH);
			checklist = updateChecklistWithRotation(checklist, 'c1', new Date('2026-03-28T00:01:00Z'), BREACH);

			const auditLogs = [{
				credentialId: 'c1',
				activities: [{
					timestamp: '2026-03-28T00:05:00Z',
					action: 'api_call',
					ipAddress: '1.2.3.4',
					userAgent: 'curl/7.0',
				}],
			}];

			const verified = verifyRotationCompleteness(checklist, auditLogs);
			const item = verified.find((i) => i.credentialId === 'c1');
			expect(item!.status).toBe('stale_usage');
			expect(item!.oldTokenActivity).toHaveLength(1);
		});
	});

	describe('buildRotationReport', () => {
		it('generates complete report with warnings', () => {
			let checklist = generateRotationChecklist(credentials, BREACH);
			checklist = updateChecklistWithRotation(checklist, 'c1', new Date('2026-03-28T00:01:00Z'), BREACH);
			checklist = updateChecklistWithRotation(checklist, 'c2', new Date('2026-03-28T00:08:00Z'), BREACH);

			const report = buildRotationReport(checklist, BREACH);
			expect(report.totalCredentials).toBe(3);
			expect(report.rotatedCount).toBe(2);
			expect(report.pendingCount).toBe(1);
			expect(report.warnings.some((w) => w.includes('pending'))).toBe(true);
			expect(report.warnings.some((w) => w.includes('exceeds 5min'))).toBe(true);
		});

		it('reports 100% completion when all rotated', () => {
			let checklist = generateRotationChecklist([credentials[0]], BREACH);
			checklist = updateChecklistWithRotation(checklist, 'c1', new Date('2026-03-28T00:01:00Z'), BREACH);

			const report = buildRotationReport(checklist, BREACH);
			expect(report.completionPercent).toBe(100);
		});
	});
});
