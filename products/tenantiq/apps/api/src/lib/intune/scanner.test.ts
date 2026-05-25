import { describe, expect, it } from 'vitest';
import { assembleScan } from './scanner';
import type {
	IntuneManagedDevice,
	IntuneCompliancePolicy,
	IntuneAppProtectionPolicy,
} from '@tenantiq/graph';

function dev(overrides: Partial<IntuneManagedDevice> = {}): IntuneManagedDevice {
	return {
		id: 'd-' + Math.random().toString(36).slice(2, 8),
		deviceName: 'Test Device',
		userPrincipalName: 'user@example.com',
		operatingSystem: 'Windows',
		osVersion: '10.0.22631.4317',
		complianceState: 'compliant',
		lastSyncDateTime: new Date().toISOString(),
		enrolledDateTime: new Date(Date.now() - 30 * 86400_000).toISOString(),
		isEncrypted: true,
		jailBroken: 'False',
		managementAgent: 'mdm',
		manufacturer: null,
		model: null,
		serialNumber: null,
		...overrides,
	};
}

function pol(overrides: Partial<IntuneCompliancePolicy> = {}): IntuneCompliancePolicy {
	return {
		id: 'p-' + Math.random().toString(36).slice(2, 8),
		displayName: 'Win10 baseline',
		platform: 'Windows',
		createdDateTime: '',
		lastModifiedDateTime: '',
		roleScopeTagIds: [],
		assignmentCount: 1,
		...overrides,
	};
}

function mam(overrides: Partial<IntuneAppProtectionPolicy> = {}): IntuneAppProtectionPolicy {
	return {
		id: 'mam-' + Math.random().toString(36).slice(2, 8),
		displayName: 'iOS managed apps',
		platform: 'iOS',
		deployedAppCount: 5,
		pinRequired: true,
		encryptAppData: true,
		disableAppPinIfDevicePinIsSet: false,
		managedBrowserBlockedAppNamespace: null,
		createdDateTime: '',
		lastModifiedDateTime: '',
		...overrides,
	};
}

describe('Intune scanner', () => {
	it('returns clean summary for healthy fleet', () => {
		const devices = [dev(), dev({ operatingSystem: 'iOS', osVersion: '17.5' })];
		const result = assembleScan(devices, [pol(), pol({ platform: 'iOS' })], [mam()]);
		expect(result.summary.totalDevices).toBe(2);
		expect(result.summary.compliantDevices).toBe(2);
		expect(result.summary.encryptionRate).toBe(1);
		expect(result.summary.postureScore).toBeGreaterThan(80);
		expect(result.findings.filter((f) => f.severity === 'critical')).toHaveLength(0);
	});

	it('flags unencrypted devices as critical', () => {
		const devices = [dev({ isEncrypted: false }), dev({ isEncrypted: false })];
		const result = assembleScan(devices, [pol()], []);
		const finding = result.findings.find((f) => f.id === 'INTUNE-DEV-002');
		expect(finding).toBeDefined();
		expect(finding?.severity).toBe('critical');
		expect(finding?.affectedCount).toBe(2);
	});

	it('flags jailbroken devices', () => {
		const devices = [dev({ operatingSystem: 'iOS', jailBroken: 'True', osVersion: '17.0' })];
		const result = assembleScan(devices, [pol({ platform: 'iOS' })], []);
		const finding = result.findings.find((f) => f.id === 'INTUNE-DEV-003');
		expect(finding?.severity).toBe('critical');
	});

	it('flags stale enrollments (>30d since lastSync)', () => {
		const stale = dev({
			lastSyncDateTime: new Date(Date.now() - 45 * 86400_000).toISOString(),
		});
		const result = assembleScan([stale, dev()], [pol()], []);
		const finding = result.findings.find((f) => f.id === 'INTUNE-DEV-004');
		expect(finding).toBeDefined();
		expect(finding?.affectedCount).toBe(1);
	});

	it('flags outdated iOS', () => {
		const old = dev({ operatingSystem: 'iOS', osVersion: '14.2', isEncrypted: true });
		const result = assembleScan([old], [pol({ platform: 'iOS' })], []);
		expect(result.findings.find((f) => f.id === 'INTUNE-DEV-005')).toBeDefined();
	});

	it('flags compliance policy without assignments', () => {
		const result = assembleScan([dev()], [pol({ assignmentCount: 0 })], []);
		expect(result.findings.find((f) => f.id === 'INTUNE-POL-001')).toBeDefined();
	});

	it('flags platform without any compliance policy assignment', () => {
		const result = assembleScan(
			[dev({ operatingSystem: 'Android', osVersion: '13.0' })],
			[], // no policies at all
			[],
		);
		const finding = result.findings.find((f) => f.id === 'INTUNE-POL-002');
		expect(finding).toBeDefined();
		expect(finding?.title).toContain('Android');
	});

	it('flags missing MAM for iOS in fleet', () => {
		const result = assembleScan(
			[dev({ operatingSystem: 'iOS', osVersion: '17.0' })],
			[pol({ platform: 'iOS' })],
			[],
		);
		expect(result.findings.find((f) => f.id === 'INTUNE-MAM-IOS-001')).toBeDefined();
	});

	it('flags MAM policy without PIN requirement', () => {
		const result = assembleScan(
			[dev({ operatingSystem: 'iOS', osVersion: '17.0' })],
			[pol({ platform: 'iOS' })],
			[mam({ pinRequired: false })],
		);
		expect(result.findings.find((f) => f.id === 'INTUNE-MAM-IOS-002')).toBeDefined();
	});

	it('flags MAM policy without app-data encryption', () => {
		const result = assembleScan(
			[dev({ operatingSystem: 'iOS', osVersion: '17.0' })],
			[pol({ platform: 'iOS' })],
			[mam({ encryptAppData: false })],
		);
		expect(result.findings.find((f) => f.id === 'INTUNE-MAM-IOS-003')).toBeDefined();
	});

	it('handles empty fleet gracefully', () => {
		const result = assembleScan([], [], []);
		expect(result.summary.totalDevices).toBe(0);
		expect(result.summary.postureScore).toBe(0);
		expect(result.findings).toHaveLength(0);
	});

	it('penalizes posture score for criticals + high findings', () => {
		const result = assembleScan(
			[dev({ isEncrypted: false }), dev({ jailBroken: 'True', operatingSystem: 'iOS', osVersion: '17.0' })],
			[],
			[],
		);
		expect(result.summary.postureScore).toBeLessThan(70);
	});
});
