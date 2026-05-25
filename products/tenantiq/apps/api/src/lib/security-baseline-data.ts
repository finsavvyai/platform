/**
 * Security baseline control definitions by industry.
 * Each industry has 10+ prioritized controls.
 */

import {
	fintechControls,
	healthcareControls,
	legalControls,
	governmentControls,
} from './security-baseline-regulated';
import {
	educationControls,
	technologyControls,
	retailControls,
	manufacturingControls,
} from './security-baseline-commercial';

export interface SecurityControl {
	priority: number;
	category: string;
	control: string;
	description: string;
	status: 'required' | 'recommended' | 'optional';
	regulations: string[];
	industryRelevance: string;
}

export function ctrl(
	p: number, cat: string, control: string, desc: string,
	status: SecurityControl['status'], regs: string[], relevance: string,
): SecurityControl {
	return {
		priority: p, category: cat, control, description: desc,
		status, regulations: regs, industryRelevance: relevance,
	};
}

type IndustryKey =
	| 'fintech' | 'healthcare' | 'legal' | 'government'
	| 'education' | 'technology' | 'retail' | 'manufacturing';

const INDUSTRY_BASELINES: Record<IndustryKey, () => SecurityControl[]> = {
	fintech: fintechControls,
	healthcare: healthcareControls,
	legal: legalControls,
	government: governmentControls,
	education: educationControls,
	technology: technologyControls,
	retail: retailControls,
	manufacturing: manufacturingControls,
};

export function getIndustryControls(key: string | null): SecurityControl[] {
	if (key && key in INDUSTRY_BASELINES) {
		return INDUSTRY_BASELINES[key as IndustryKey]();
	}
	return genericControls();
}

function genericControls(): SecurityControl[] {
	return [
		ctrl(1, 'Identity & Access', 'Multi-factor authentication', 'Enable MFA for all users', 'required', ['CIS 1.1.1'], 'MFA is the most effective control against credential theft'),
		ctrl(2, 'Data Protection', 'Data loss prevention', 'DLP policies for PII and sensitive data', 'required', ['GDPR Art. 32'], 'Prevents accidental or intentional data exposure'),
		ctrl(3, 'Email Security', 'Anti-phishing protection', 'Advanced anti-phishing with impersonation detection', 'required', ['CIS 2.1.1'], 'Phishing is the most common attack vector'),
		ctrl(4, 'Audit & Compliance', 'Unified audit logging', 'Comprehensive audit logging across all workloads', 'required', ['CIS 5.1.1'], 'Audit logs are essential for incident detection'),
		ctrl(5, 'Identity & Access', 'Conditional access policies', 'Risk-based access policies for corporate resources', 'recommended', ['CIS 1.2.1'], 'Conditional access adapts security to risk context'),
	];
}
