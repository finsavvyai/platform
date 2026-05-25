/**
 * Risk Calculator - Assesses risk of code changes
 */

import type { CodeChange, ChangeRisk, AffectedTest } from './types.js';

export class RiskCalculator {
  private readonly CRITICAL_PATTERNS = [
    /auth|security|payment|billing/i,
    /core|engine|framework/i,
    /database|schema|migration/i,
  ];

  assessChangeRisk(change: CodeChange): string[] {
    const factors: string[] = [];

    if (change.changeType === 'deleted') {
      factors.push('File deleted - potential breaking changes');
    }

    if (change.deletions > change.additions * 2) {
      factors.push('Large deletion - refactoring or feature removal');
    }

    if (change.additions > 500) {
      factors.push('Large addition - may introduce complexity');
    }

    if (/test|spec/i.test(change.filePath)) {
      factors.push('Test file modified - affects coverage');
    }

    return factors;
  }

  calculateRisk(
    changes: CodeChange[],
    affectedTests: AffectedTest[],
    riskFactors: string[]
  ): ChangeRisk {
    const criticalFiles = changes
      .filter(c => this.CRITICAL_PATTERNS.some(p => p.test(c.filePath)))
      .map(c => c.filePath);

    const failureProb = affectedTests.reduce((sum, t) => sum + t.failureProbability, 0) / Math.max(affectedTests.length, 1);
    const changeScore = Math.min(
      (changes.length * 0.2 + affectedTests.length * 0.5 + failureProb * 30) / 100,
      1
    );

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (changeScore > 0.75 || criticalFiles.length > 0) riskLevel = 'critical';
    else if (changeScore > 0.5 || affectedTests.length > 20) riskLevel = 'high';
    else if (changeScore > 0.25 || affectedTests.length > 5) riskLevel = 'medium';

    const recommendations: string[] = [];
    if (criticalFiles.length > 0) {
      recommendations.push(`⚠️ Critical files changed: ${criticalFiles.join(', ')}`);
      recommendations.push('Run full test suite before deployment');
    }
    if (affectedTests.length > 50) {
      recommendations.push('Large test suite. Consider parallel execution.');
    }

    return {
      riskLevel,
      riskScore: changeScore,
      riskFactors,
      affectedTestsCount: affectedTests.length,
      estimatedRunTime: affectedTests.reduce((sum, t) => sum + t.estimatedRunTime, 0),
      criticalFiles,
      recommendations,
    };
  }
}
