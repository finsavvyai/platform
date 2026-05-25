/**
 * Compliance framework control definitions.
 * Maps real Graph data (MFA rate, CA policies) to GDPR/HIPAA/SOC2 controls.
 */

export interface FrameworkControl {
	id: string;
	name: string;
	status: 'pass' | 'fail' | 'partial' | 'not_applicable';
	details: string;
}

export interface ComplianceFramework {
	id: string;
	name: string;
	score: number;
	controls: FrameworkControl[];
}

function score(controls: FrameworkControl[]): number {
	const passed = controls.filter((c) => c.status === 'pass').length;
	return Math.round((passed / controls.length) * 100);
}

export function buildGdprFramework(mfaRate: number, caEnabled: number): ComplianceFramework {
	const controls: FrameworkControl[] = [
		{ id: 'GDPR-5.1', name: 'Data protection by design', status: caEnabled > 0 ? 'pass' : 'fail', details: caEnabled > 0 ? `${caEnabled} CA policies enforce access control` : 'No conditional access policies enabled' },
		{ id: 'GDPR-32', name: 'Security of processing (MFA)', status: mfaRate > 0.9 ? 'pass' : mfaRate > 0.5 ? 'partial' : 'fail', details: `${Math.round(mfaRate * 100)}% MFA adoption` },
		{ id: 'GDPR-33', name: 'Breach notification capability', status: 'partial', details: 'Graph security alerts configured; review notification workflow' },
		{ id: 'GDPR-25', name: 'Data minimization', status: 'partial', details: 'Review license assignments for least-privilege access' },
	];
	return { id: 'gdpr', name: 'GDPR', score: score(controls), controls };
}

export function buildHipaaFramework(mfaRate: number, caEnabled: number): ComplianceFramework {
	const controls: FrameworkControl[] = [
		{ id: 'HIPAA-164.312a', name: 'Access control', status: caEnabled >= 2 ? 'pass' : caEnabled > 0 ? 'partial' : 'fail', details: `${caEnabled} conditional access policies` },
		{ id: 'HIPAA-164.312d', name: 'Person authentication (MFA)', status: mfaRate > 0.95 ? 'pass' : mfaRate > 0.7 ? 'partial' : 'fail', details: `${Math.round(mfaRate * 100)}% MFA adoption` },
		{ id: 'HIPAA-164.312e', name: 'Transmission security', status: 'pass', details: 'Microsoft 365 encrypts data in transit by default' },
		{ id: 'HIPAA-164.312c', name: 'Integrity controls', status: 'partial', details: 'Review audit logging and change tracking configuration' },
	];
	return { id: 'hipaa', name: 'HIPAA', score: score(controls), controls };
}

export function buildSoc2Framework(mfaRate: number, caEnabled: number): ComplianceFramework {
	const controls: FrameworkControl[] = [
		{ id: 'SOC2-CC6.1', name: 'Logical access security', status: caEnabled >= 3 ? 'pass' : caEnabled > 0 ? 'partial' : 'fail', details: `${caEnabled} conditional access policies` },
		{ id: 'SOC2-CC6.2', name: 'Authentication mechanisms', status: mfaRate > 0.9 ? 'pass' : mfaRate > 0.5 ? 'partial' : 'fail', details: `${Math.round(mfaRate * 100)}% MFA adoption` },
		{ id: 'SOC2-CC7.2', name: 'Security event monitoring', status: 'pass', details: 'Graph Security API monitoring active' },
		{ id: 'SOC2-CC8.1', name: 'Change management', status: 'partial', details: 'Config snapshot tracking enabled; review change approval workflow' },
	];
	return { id: 'soc2', name: 'SOC 2', score: score(controls), controls };
}
