/**
 * OpenClaw Bridge — Result Parsers
 *
 * Transforms raw AI agent text output into structured results.
 */

import type { AgentResult, TenantSecurityAnalysis, LicenseOptimizationResult } from './types';

export function parseSecurityAnalysis(result: AgentResult): TenantSecurityAnalysis {
	const text = result.output;

	// Extract risk score (look for patterns like "Risk Score: 72" or "72/100")
	const scoreMatch = text.match(/risk\s+score[:\s]+(\d+)/i) || text.match(/(\d+)\s*\/\s*100/);
	const riskScore = scoreMatch ? Math.min(100, parseInt(scoreMatch[1])) : 50;

	// Extract bullet points as findings/recommendations
	const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
	const findings: string[] = [];
	const recommendations: string[] = [];
	const gaps: string[] = [];
	let section = '';

	for (const line of lines) {
		const lower = line.toLowerCase();
		if (lower.includes('critical') || lower.includes('finding')) section = 'findings';
		else if (lower.includes('recommend') || lower.includes('remediat')) section = 'recommendations';
		else if (lower.includes('compliance') || lower.includes('gap')) section = 'gaps';
		else if (line.startsWith('-') || line.startsWith('\u2022') || /^\d+\./.test(line)) {
			const content = line.replace(/^[-\u2022\d.]\s*/, '');
			if (section === 'findings') findings.push(content);
			else if (section === 'recommendations') recommendations.push(content);
			else if (section === 'gaps') gaps.push(content);
		}
	}

	// Estimate hours based on findings count
	const estimatedHours = findings.length * 2 + recommendations.length;

	return {
		riskScore,
		criticalFindings: findings.slice(0, 10),
		recommendations: recommendations.slice(0, 10),
		complianceGaps: gaps.slice(0, 5),
		estimatedRemediationHours: estimatedHours || 8,
		rawAnalysis: text,
	};
}

export function parseLicenseAnalysis(
	result: AgentResult,
	totalCost: number
): LicenseOptimizationResult {
	const text = result.output;

	// Extract numbers from text
	const wastedMatch = text.match(/(\d+)\s+wasted|waste[d]?\s+(\d+)/i);
	const wasted = wastedMatch ? parseInt(wastedMatch[1] || wastedMatch[2]) : 0;

	const savingsMatch = text.match(/\$(\d+[\d,]*(?:\.\d+)?)\s*(?:per\s+month|\/mo|monthly)/i);
	const savings = savingsMatch
		? parseFloat(savingsMatch[1].replace(',', ''))
		: totalCost * 0.15; // default 15% estimate

	const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
	const recs: LicenseOptimizationResult['recommendations'] = [];

	for (const line of lines) {
		if (line.startsWith('-') || /^\d+\./.test(line)) {
			const content = line.replace(/^[-\d.]\s*/, '');
			const lower = content.toLowerCase();
			const priority = lower.includes('critical') || lower.includes('high')
				? 'high'
				: lower.includes('medium')
					? 'medium'
					: 'low';
			recs.push({ action: content, users: [], saving: 0, priority });
		}
	}

	return {
		wastedLicenses: wasted,
		estimatedMonthlySavings: savings,
		recommendations: recs.slice(0, 10),
		rawAnalysis: text,
	};
}
