"use strict";
/**
 * SelfHealingEngine — analyze test failures and produce auto-fix suggestions.
 *
 * Framework-agnostic. Pass in a `TestResult` and get ranked `HealingSuggestion`s.
 * When a suggestion's confidence meets the auto-apply threshold (default 0.85),
 * the engine marks it as `healed` so the caller can apply it to the test file.
 * Below the threshold, the optional `onLowConfidence` notifier fires for human
 * review.
 *
 * Made by Qestro — https://qestro.app
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfHealingEngine = void 0;
const index_js_1 = require("./healers/index.cjs");
const NOOP_LOGGER = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};
const DEFAULT_AUTO_APPLY_THRESHOLD = 0.85;
class SelfHealingEngine {
    autoApplyThreshold;
    logger;
    onLowConfidence;
    healers = {
        selector_changed: new index_js_1.SelectorHealer(),
        timing_issue: new index_js_1.TimingHealer(),
        assertion_drift: new index_js_1.AssertionHealer(),
        api_schema_change: new index_js_1.APIHealer(),
    };
    healingHistoryMap = new Map();
    constructor(options = {}) {
        this.autoApplyThreshold = options.autoApplyThreshold ?? DEFAULT_AUTO_APPLY_THRESHOLD;
        this.logger = options.logger ?? NOOP_LOGGER;
        this.onLowConfidence = options.onLowConfidence;
    }
    async analyzeAndHeal(testId, testResult, testCode) {
        const analysis = this.analyzeFailure(testResult);
        const suggestions = this.generateSuggestions(analysis, testResult, testCode);
        const bestSuggestion = [...suggestions].sort((a, b) => b.confidence - a.confidence)[0];
        const confidenceScore = bestSuggestion?.confidence ?? 0;
        const healed = !!bestSuggestion && confidenceScore >= this.autoApplyThreshold;
        const result = {
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
            if (!healed && this.onLowConfidence) {
                try {
                    await this.onLowConfidence({
                        testId,
                        analysis,
                        suggestion: bestSuggestion,
                        confidence: confidenceScore,
                    });
                }
                catch (error) {
                    this.logger.warn(`onLowConfidence notifier failed: ${String(error)}`);
                }
            }
        }
        this.logger.info(`self-healing testId=${testId} healed=${healed} confidence=${confidenceScore.toFixed(2)}`);
        return result;
    }
    getHealingHistory(testId) {
        return this.healingHistoryMap.get(testId) ?? [];
    }
    getHealingStats(testId) {
        const records = testId
            ? this.getHealingHistory(testId)
            : Array.from(this.healingHistoryMap.values()).flat();
        const totalAttempted = records.length;
        const totalHealed = records.filter((r) => r.applied).length;
        return {
            totalHealed,
            totalAttempted,
            successRate: totalAttempted > 0 ? totalHealed / totalAttempted : 0,
            byType: records.reduce((acc, r) => {
                acc[r.fixType] = (acc[r.fixType] ?? 0) + 1;
                return acc;
            }, {}),
        };
    }
    clearHistory(testId) {
        if (testId) {
            this.healingHistoryMap.delete(testId);
        }
        else {
            this.healingHistoryMap.clear();
        }
    }
    analyzeFailure(testResult) {
        const errorMsg = testResult.errors.join('\n').toLowerCase();
        const patterns = [
            /selector|locator|element|find/i,
            /timeout|wait|loading/i,
            /assert|expect|equal/i,
            /network|api|response|schema|field/i,
        ];
        const errorPatterns = patterns.filter((p) => p.test(errorMsg)).map((p) => p.source);
        const type = this.classifyFailure(errorPatterns);
        return {
            type,
            originalError: testResult.errors[0] ?? 'Unknown error',
            errorPatterns,
            diagnosis: this.getDiagnosis(type),
            severity: this.calculateSeverity(type, testResult),
        };
    }
    classifyFailure(patterns) {
        if (patterns.some((p) => /selector|locator|element/i.test(p)))
            return 'selector_changed';
        if (patterns.some((p) => /timeout|wait/i.test(p)))
            return 'timing_issue';
        if (patterns.some((p) => /network|api|schema/i.test(p)))
            return 'api_schema_change';
        if (patterns.some((p) => /assert|expect/i.test(p)))
            return 'assertion_drift';
        return 'unknown';
    }
    generateSuggestions(analysis, testResult, testCode) {
        if (analysis.type === 'unknown')
            return [];
        return this.healers[analysis.type].heal(testResult, testCode);
    }
    getDiagnosis(type) {
        const diagnoses = {
            selector_changed: 'Element selector is stale. DOM structure may have changed.',
            timing_issue: 'Element not ready. Consider adding waits or increasing timeouts.',
            assertion_drift: 'Expected value differs from actual. Page content may have changed.',
            api_schema_change: 'API response schema changed. Fields/structure modified.',
            unknown: 'Unable to diagnose. Manual review required.',
        };
        return diagnoses[type];
    }
    calculateSeverity(type, testResult) {
        if (type === 'api_schema_change')
            return 'high';
        if (type === 'selector_changed')
            return 'medium';
        if (testResult.duration > 30000)
            return 'high';
        return 'low';
    }
    recordHealing(testId, suggestion, applied) {
        const record = {
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
}
exports.SelfHealingEngine = SelfHealingEngine;
//# sourceMappingURL=engine.js.map