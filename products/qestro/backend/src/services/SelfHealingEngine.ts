/**
 * SelfHealingEngine - Intelligent Test Failure Analysis & Auto-Repair
 *
 * Core orchestrator for analyzing test failures and applying intelligent fixes.
 * Analyzes: selector changes, timing issues, assertion drift, API schema changes.
 *
 * Features:
 * - Multi-strategy healing (5 approaches per failure type)
 * - Confidence scoring (0-1) with auto-apply threshold (0.85)
 * - OpenClaw integration for low-confidence suggestions
 * - Healing history tracking & analytics
 *
 * Max 200 lines: delegates to focused healers in ./healers/
 */

import { logger } from '../utils/logger.js';
import { openClawBridge } from './OpenClawBridgeService.js';
import { SelectorHealer, TimingHealer, AssertionHealer, APIHealer } from './healers/index.js';
import type {
  FailureType,
  FailureAnalysis,
  HealingSuggestion,
  HealingRecord,
  HealingResult,
} from './healers/index.js';
import type { TestResult } from '../types/TestingTypes.js';

export type { FailureType, FailureAnalysis, HealingSuggestion, HealingRecord, HealingResult };

class SelfHealingEngine {
  private readonly AUTO_APPLY_THRESHOLD = 0.85;
  private healingHistoryMap = new Map<string, HealingRecord[]>();
  private healers = {
    selector: new SelectorHealer(),
    timing: new TimingHealer(),
    assertion: new AssertionHealer(),
    api: new APIHealer(),
  };

  async analyzeAndHeal(testId: string, testResult: TestResult, testCode?: string): Promise<HealingResult> {
    try {
      const analysis = this.analyzeFailure(testResult);
      const suggestions = this.generateSuggestions(analysis, testResult, testCode);
      const bestSuggestion = suggestions.sort((a, b) => b.confidence - a.confidence)[0];
      const confidenceScore = bestSuggestion?.confidence ?? 0;
      const healed = confidenceScore >= this.AUTO_APPLY_THRESHOLD && !!bestSuggestion;

      const healingResult: HealingResult = {
        testId,
        healed,
        appliedFix: healed ? bestSuggestion : undefined,
        suggestions,
        analysis,
        confidenceScore,
        timestamp: new Date(),
        healingHistory: this.getHealingHistory(testId),
      };

      if (bestSuggestion) {
        this.recordHealing(testId, bestSuggestion, healed);
        if (!healed && confidenceScore < this.AUTO_APPLY_THRESHOLD) {
          await this.notifyOpenClaw(testId, analysis, bestSuggestion, confidenceScore);
        }
      }

      logger.info(`Self-healing: testId=${testId}, healed=${healingResult.healed}, confidence=${confidenceScore.toFixed(2)}`);
      return healingResult;
    } catch (error) {
      logger.error(`Self-healing error for ${testId}: ${error}`);
      throw error;
    }
  }

  private analyzeFailure(testResult: TestResult): FailureAnalysis {
    const errorMsg = testResult.errors.join('\n').toLowerCase();
    const patterns = [
      /selector|locator|element|find/i,
      /timeout|wait|loading/i,
      /assert|expect|equal/i,
      /network|api|response|schema|field/i,
    ];

    const errorPatterns = patterns.filter(p => p.test(errorMsg)).map(p => p.source);
    const type = this.classifyFailure(errorPatterns);

    return {
      type,
      originalError: testResult.errors[0] ?? 'Unknown error',
      errorPatterns,
      diagnosis: this.getDiagnosis(type),
      severity: this.calculateSeverity(type, testResult),
    };
  }

  private classifyFailure(patterns: string[]): FailureType {
    if (patterns.some(p => /selector|locator|element/i.test(p))) return 'selector_changed';
    if (patterns.some(p => /timeout|wait/i.test(p))) return 'timing_issue';
    if (patterns.some(p => /network|api|schema/i.test(p))) return 'api_schema_change';
    if (patterns.some(p => /assert|expect/i.test(p))) return 'assertion_drift';
    return 'unknown';
  }

  private generateSuggestions(analysis: FailureAnalysis, testResult: TestResult, testCode?: string): HealingSuggestion[] {
    switch (analysis.type) {
      case 'selector_changed': return this.healers.selector.heal(testResult, testCode);
      case 'timing_issue': return this.healers.timing.heal(testResult, testCode);
      case 'assertion_drift': return this.healers.assertion.heal(testResult, testCode);
      case 'api_schema_change': return this.healers.api.heal(testResult, testCode);
      default: return [];
    }
  }

  private getDiagnosis(type: FailureType): string {
    const diagnoses: Record<FailureType, string> = {
      selector_changed: 'Element selector is stale. DOM structure may have changed.',
      timing_issue: 'Element not ready. Consider adding waits or increasing timeouts.',
      assertion_drift: 'Expected value differs from actual. Page content may have changed.',
      api_schema_change: 'API response schema changed. Fields/structure modified.',
      unknown: 'Unable to diagnose. Manual review required.',
    };
    return diagnoses[type];
  }

  private calculateSeverity(type: FailureType, testResult: TestResult): 'low' | 'medium' | 'high' {
    if (type === 'api_schema_change') return 'high';
    if (type === 'selector_changed') return 'medium';
    if (testResult.duration > 30000) return 'high';
    return 'low';
  }

  private recordHealing(testId: string, suggestion: HealingSuggestion, applied: boolean): void {
    const record: HealingRecord = {
      timestamp: new Date(),
      fixType: suggestion.type,
      confidence: suggestion.confidence,
      applied,
      originalValue: suggestion.originalValue,
      suggestedValue: suggestion.suggestedValue,
    };
    const history = this.getHealingHistory(testId);
    history.push(record);
    this.healingHistoryMap.set(testId, history);
  }

  private async notifyOpenClaw(
    testId: string,
    analysis: FailureAnalysis,
    suggestion: HealingSuggestion,
    confidence: number
  ): Promise<void> {
    try {
      await openClawBridge.onSelfHealing({
        testName: testId,
        testId,
        healingType: suggestion.type as 'locator_update' | 'wait_added' | 'retry_logic' | 'assertion_fix',
        originalError: analysis.originalError,
        fixApplied: suggestion.suggestedValue,
        confidence,
      });
    } catch (error) {
      logger.warn(`OpenClaw notification failed: ${error}`);
    }
  }

  getHealingHistory(testId: string): HealingRecord[] {
    return this.healingHistoryMap.get(testId) ?? [];
  }

  getHealingStats(testId?: string) {
    const allRecords = testId
      ? this.getHealingHistory(testId)
      : Array.from(this.healingHistoryMap.values()).flat();

    const totalAttempted = allRecords.length;
    const totalHealed = allRecords.filter(r => r.applied).length;

    return {
      totalHealed,
      totalAttempted,
      successRate: totalAttempted > 0 ? totalHealed / totalAttempted : 0,
      byType: allRecords.reduce((acc, r) => {
        acc[r.fixType] = (acc[r.fixType] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  clearHistory(testId?: string): void {
    testId ? this.healingHistoryMap.delete(testId) : this.healingHistoryMap.clear();
  }
}

export const selfHealingEngine = new SelfHealingEngine();
