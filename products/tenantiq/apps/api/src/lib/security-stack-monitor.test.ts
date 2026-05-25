import { describe, it, expect } from 'vitest';
import {
	detectSecurityDrifts,
	type SecurityStackSnapshot,
} from './security-stack-monitor';

describe('Security Stack Monitor', () => {
	const baselineSnapshot: SecurityStackSnapshot = {
		conditionalAccess: {
			policyCount: 5,
			mfaEnabled: true,
			legacyBlocked: true,
		},
		dlp: {
			policyCount: 3,
			labelsCount: 8,
		},
		identity: {
			mfaCoverage: 95,
			riskyUsers: 2,
			signInRiskPolicy: true,
		},
		email: {
			safeLinks: true,
			safeAttachments: true,
			antiPhishing: true,
		},
		timestamp: new Date().toISOString(),
	};

	it('should detect CA policy count change', () => {
		const current: SecurityStackSnapshot = {
			...baselineSnapshot,
			conditionalAccess: { ...baselineSnapshot.conditionalAccess, policyCount: 4 },
		};

		const drifts = detectSecurityDrifts(current, baselineSnapshot);
		expect(drifts).toHaveLength(1);
		expect(drifts[0].field).toBe('policyCount');
		expect(drifts[0].severity).toBe('high');
	});

	it('should detect MFA enablement change (critical)', () => {
		const current: SecurityStackSnapshot = {
			...baselineSnapshot,
			conditionalAccess: { ...baselineSnapshot.conditionalAccess, mfaEnabled: false },
		};

		const drifts = detectSecurityDrifts(current, baselineSnapshot);
		const mfaDrift = drifts.find((d) => d.field === 'mfaEnabled');
		expect(mfaDrift?.severity).toBe('critical');
	});

	it('should detect legacy auth blocking change', () => {
		const current: SecurityStackSnapshot = {
			...baselineSnapshot,
			conditionalAccess: { ...baselineSnapshot.conditionalAccess, legacyBlocked: false },
		};

		const drifts = detectSecurityDrifts(current, baselineSnapshot);
		const legacyDrift = drifts.find((d) => d.field === 'legacyBlocked');
		expect(legacyDrift?.severity).toBe('high');
	});

	it('should detect anti-phishing change (critical)', () => {
		const current: SecurityStackSnapshot = {
			...baselineSnapshot,
			email: { ...baselineSnapshot.email, antiPhishing: false },
		};

		const drifts = detectSecurityDrifts(current, baselineSnapshot);
		const phishingDrift = drifts.find((d) => d.field === 'antiPhishing');
		expect(phishingDrift?.severity).toBe('critical');
	});

	it('should detect MFA coverage decline', () => {
		const current: SecurityStackSnapshot = {
			...baselineSnapshot,
			identity: { ...baselineSnapshot.identity, mfaCoverage: 80 },
		};

		const drifts = detectSecurityDrifts(current, baselineSnapshot);
		const coverageDrift = drifts.find((d) => d.field === 'mfaCoverage');
		expect(coverageDrift?.severity).toBe('medium');
	});

	it('should not detect changes when snapshots match', () => {
		const drifts = detectSecurityDrifts(baselineSnapshot, baselineSnapshot);
		expect(drifts).toHaveLength(0);
	});

	it('should handle null previous snapshot gracefully', () => {
		const drifts = detectSecurityDrifts(baselineSnapshot, null);
		expect(drifts).toHaveLength(0);
	});

	it('should detect multiple simultaneous drifts', () => {
		const current: SecurityStackSnapshot = {
			...baselineSnapshot,
			conditionalAccess: {
				...baselineSnapshot.conditionalAccess,
				mfaEnabled: false,
				legacyBlocked: false,
			},
			email: {
				...baselineSnapshot.email,
				antiPhishing: false,
				safeLinks: false,
			},
		};

		const drifts = detectSecurityDrifts(current, baselineSnapshot);
		expect(drifts.length).toBeGreaterThan(1);
		expect(drifts.some((d) => d.severity === 'critical')).toBe(true);
	});
});
