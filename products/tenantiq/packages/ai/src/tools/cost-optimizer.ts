/**
 * Cost Optimization Advisor Tool
 * Analyzes license usage and provides AI-powered cost savings recommendations
 *
 * Re-exports from split modules:
 *   - cost-optimizer.types.ts    — LicenseUsageData, CostOptimizationResult, CostRecommendation
 *   - cost-optimizer.analysis.ts — analyzeCostOptimization()
 *   - cost-optimizer.prompt.ts   — generateCostOptimizationPrompt()
 */

export type { LicenseUsageData, CostOptimizationResult, CostRecommendation } from './cost-optimizer.types';
export { analyzeCostOptimization } from './cost-optimizer.analysis';
export { generateCostOptimizationPrompt } from './cost-optimizer.prompt';
