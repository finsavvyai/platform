/**
 * Zero Trust Assessment Engine — evaluates tenant security across 6 pillars.
 * Identity, Devices, Network, Applications, Data, Infrastructure.
 */

import type { TenantSecurityData, TenantSecurityDataNullable } from '../compliance/types';
import {
	evaluateApplications,
	evaluateData,
	evaluateInfrastructure,
	evaluateNetwork,
	pillarScore,
} from './zero-trust-pillars';

export type CheckStatus = 'pass' | 'fail' | 'partial' | 'error';
export type MaturityLevel = 'initial' | 'advanced' | 'optimal';

export interface ZeroTrustCheck {
	name: string;
	status: CheckStatus;
	evidence: string;
	errorMessage?: string;
}

export interface ZeroTrustPillar {
	name: string;
	score: number;
	checks: ZeroTrustCheck[];
	recommendations: string[];
}

export interface ZeroTrustResult {
	overallScore: number;
	maturityLevel: MaturityLevel;
	pillars: ZeroTrustPillar[];
}

/** Evaluate Zero Trust posture across all 6 pillars */
export function evaluateZeroTrust(
	securityData: TenantSecurityData | TenantSecurityDataNullable,
): ZeroTrustResult {
	const pillars: ZeroTrustPillar[] = [
		evaluateIdentity(securityData),
		evaluateDevices(securityData),
		evaluateNetwork(securityData),
		evaluateApplications(securityData),
		evaluateData(securityData),
		evaluateInfrastructure(securityData),
	];

	const overallScore = Math.round(
		pillars.reduce((sum, p) => sum + p.score, 0) / pillars.length,
	);

	const maturityLevel: MaturityLevel =
		overallScore >= 80 ? 'optimal'
		: overallScore >= 50 ? 'advanced'
		: 'initial';

	return { overallScore, maturityLevel, pillars };
}

function errCheck(name: string, msg: string): ZeroTrustCheck {
	return { name, status: 'error', evidence: 'Unable to assess', errorMessage: msg };
}

function evaluateIdentity(data: TenantSecurityData | TenantSecurityDataNullable): ZeroTrustPillar {
	const checks: ZeroTrustCheck[] = [
		data.mfaRate == null ? errCheck('MFA Adoption', 'MFA data unavailable') : {
			name: 'MFA Adoption',
			status: data.mfaRate >= 0.9 ? 'pass' : data.mfaRate >= 0.5 ? 'partial' : 'fail',
			evidence: `MFA rate: ${Math.round(data.mfaRate * 100)}%`,
		},
		data.caEnabled == null ? errCheck('Conditional Access Policies', 'CA data unavailable') : {
			name: 'Conditional Access Policies',
			status: data.caEnabled >= 3 ? 'pass' : data.caEnabled >= 1 ? 'partial' : 'fail',
			evidence: `${data.caEnabled} of ${data.caTotal ?? 0} CA policies enabled`,
		},
		data.riskyUsers == null ? errCheck('Risky Users Management', 'Risky users data unavailable') : {
			name: 'Risky Users Management',
			status: data.riskyUsers === 0 ? 'pass' : data.riskyUsers <= 3 ? 'partial' : 'fail',
			evidence: `${data.riskyUsers} risky users detected`,
		},
	];
	const recs: string[] = [];
	if (data.mfaRate != null && data.mfaRate < 0.9) recs.push('Increase MFA enrollment to 90%+');
	if (data.caEnabled != null && data.caEnabled < 3) recs.push('Create additional CA policies for risk-based access');
	if (data.riskyUsers != null && data.riskyUsers > 0) recs.push('Remediate risky users immediately');
	return { name: 'Identity', score: pillarScore(checks), checks, recommendations: recs };
}

function evaluateDevices(data: TenantSecurityData | TenantSecurityDataNullable): ZeroTrustPillar {
	const hasCa = data.caEnabled != null && data.caEnabled >= 1;
	const checks: ZeroTrustCheck[] = [
		data.caEnabled == null ? errCheck('Device Compliance Policy', 'CA data unavailable') : {
			name: 'Device Compliance Policy',
			status: hasCa ? 'partial' : 'fail',
			evidence: hasCa ? 'CA policies exist (device compliance inferred)' : 'No device compliance detected',
		},
		data.caEnabled == null ? errCheck('Managed Device Enforcement', 'CA data unavailable') : {
			name: 'Managed Device Enforcement',
			status: data.caEnabled >= 2 ? 'partial' : 'fail',
			evidence: `${data.caEnabled} CA policies may include device requirements`,
		},
	];
	const recs: string[] = [];
	if (!hasCa) recs.push('Require device compliance via Conditional Access');
	recs.push('Enroll devices in Intune for full management');
	return { name: 'Devices', score: pillarScore(checks), checks, recommendations: recs };
}

export { generateRoadmap } from './zero-trust-pillars';
