/**
 * Security Baseline Generator
 *
 * Generates prioritized security controls based on
 * industry vertical and compliance requirements.
 */

import {
	type SecurityControl,
	getIndustryControls,
} from './security-baseline-data';

export type { SecurityControl };

type IndustryKey =
	| 'fintech'
	| 'healthcare'
	| 'legal'
	| 'government'
	| 'education'
	| 'technology'
	| 'retail'
	| 'manufacturing';

function normalizeIndustry(raw: string): IndustryKey | null {
	const lower = raw.toLowerCase();
	if (lower.includes('fintech') || lower.includes('banking')) return 'fintech';
	if (lower.includes('health')) return 'healthcare';
	if (lower.includes('legal')) return 'legal';
	if (lower.includes('gov')) return 'government';
	if (lower.includes('edu')) return 'education';
	if (lower.includes('tech')) return 'technology';
	if (lower.includes('retail')) return 'retail';
	if (lower.includes('manuf')) return 'manufacturing';
	return null;
}

export function generateSecurityBaseline(
	industry: string,
	compliance: string[],
): SecurityControl[] {
	const key = normalizeIndustry(industry);
	const base = getIndustryControls(key);
	return elevateByCompliance(base, compliance);
}

function elevateByCompliance(
	controls: SecurityControl[],
	compliance: string[],
): SecurityControl[] {
	if (!compliance.length) return controls;
	return controls.map((c) => {
		const overlap = c.regulations.some((r) =>
			compliance.some((req) => r.toLowerCase().includes(req.toLowerCase())),
		);
		if (overlap && c.status === 'optional') {
			return { ...c, status: 'recommended' as const };
		}
		return c;
	});
}
