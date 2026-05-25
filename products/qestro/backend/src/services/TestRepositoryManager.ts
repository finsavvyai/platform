import { TestScenario } from '../workers/ai-review/types';

interface TestExecutionResult {
    scenarioId: string;
    status: 'passed' | 'failed';
    duration: number;
    error?: string;
    timestamp: Date;
}

interface TestHealthReport {
    scenarioId: string;
    flakinessScore: number; // 0-1
    stabilityStatus: 'stable' | 'flaky' | 'broken';
    suggestedFix?: string;
}

/**
 * Test Repository Manager (The Curator)
 * Responsible for maintaining the health of the test suite.
 * Detects flaky tests, suggests self-healing fixes, and archives stale tests.
 */
export class TestRepositoryManager {
    private static instance: TestRepositoryManager;
    private executionHistory: Map<string, TestExecutionResult[]> = new Map();

    private constructor() { }

    public static getInstance(): TestRepositoryManager {
        if (!TestRepositoryManager.instance) {
            TestRepositoryManager.instance = new TestRepositoryManager();
        }
        return TestRepositoryManager.instance;
    }

    /**
     * Records a test execution result and triggers health analysis.
     */
    public async recordExecution(result: TestExecutionResult): Promise<TestHealthReport> {
        if (!this.executionHistory.has(result.scenarioId)) {
            this.executionHistory.set(result.scenarioId, []);
        }
        const history = this.executionHistory.get(result.scenarioId)!;
        history.push(result);

        // Keep last 50 runs
        if (history.length > 50) history.shift();

        return this.analyzeHealth(result.scenarioId);
    }

    /**
     * Analyzes the stability of a test scenario.
     */
    public analyzeHealth(scenarioId: string): TestHealthReport {
        const history = this.executionHistory.get(scenarioId) || [];
        if (history.length === 0) {
            return { scenarioId, flakinessScore: 0, stabilityStatus: 'stable' };
        }

        const failures = history.filter(r => r.status === 'failed').length;
        const total = history.length;
        const failRate = failures / total;

        let status: 'stable' | 'flaky' | 'broken' = 'stable';
        let fix: string | undefined = undefined;

        if (failRate === 1.0) {
            status = 'broken';
            // Self-Healing Logic: specific analysis of the error
            const lastError = history[history.length - 1].error || '';
            if (lastError.includes('Element not found')) {
                fix = 'Selector outdated. Suggest updating DOM query.';
            } else if (lastError.includes('Timeout')) {
                fix = 'Performance degradation detected. Suggest increasing timeout or optimizing query.';
            }
        } else if (failRate > 0.1) {
            status = 'flaky';
            fix = 'Intermittent failure. Suggest adding retry logic or checking for race conditions.';
        }

        return {
            scenarioId,
            flakinessScore: failRate,
            stabilityStatus: status,
            suggestedFix: fix
        };
    }

    /**
     * Get suggestions for all problematic tests
     */
    public getCuratorSuggestions(): TestHealthReport[] {
        const suggestions: TestHealthReport[] = [];
        for (const id of this.executionHistory.keys()) {
            const report = this.analyzeHealth(id);
            if (report.stabilityStatus !== 'stable') {
                suggestions.push(report);
            }
        }
        return suggestions;
    }
}
