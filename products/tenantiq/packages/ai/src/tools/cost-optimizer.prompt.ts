/**
 * Cost Optimization Advisor — AI prompt generation
 */

import type { CostOptimizationResult } from './cost-optimizer.types';

/**
 * Generate AI prompt for cost optimization analysis
 */
export function generateCostOptimizationPrompt(result: CostOptimizationResult, tenantName: string): string {
	return `You are analyzing cost optimization opportunities for ${tenantName}.

Current Monthly License Cost: $${result.totalMonthlyCost.toFixed(2)}
Potential Monthly Savings: $${result.potentialMonthlySavings.toFixed(2)}
Potential Annual Savings: $${result.potentialAnnualSavings.toFixed(2)}

${result.recommendations.length} Recommendations Found:

${result.recommendations
	.map(
		(rec, idx) => `
${idx + 1}. ${rec.title} (${rec.severity.toUpperCase()} priority)
   - Potential Savings: $${rec.monthlySavings.toFixed(2)}/month ($${rec.annualSavings.toFixed(2)}/year)
   - Affected Users: ${rec.affectedUsers}
   - Risk Level: ${rec.riskLevel}
   - Implementation: ${rec.implementationEffort}
   - Description: ${rec.description}
`
	)
	.join('\n')}

Please provide:
1. A prioritized action plan for implementing these recommendations
2. Risk mitigation strategies for each recommendation
3. A suggested timeline for implementation (quick wins vs longer-term projects)
4. Key stakeholders who should be involved in each recommendation
5. Metrics to track to measure success

Be specific and actionable. Focus on the highest-impact, lowest-risk recommendations first.`;
}
