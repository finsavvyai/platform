/**
 * Test Intelligence Engine - Main Exports
 * Central entry point for all intelligence services
 */

// Core Services (import for local use + re-export)
import { FlakyDetector } from './FlakyDetector.js';
import { TestPrioritizer } from './TestPrioritizer.js';
import { AutoFixEngine } from './AutoFixEngine.js';
import { PredictiveAnalytics } from './PredictiveAnalytics.js';

export { FlakyDetector, TestPrioritizer, AutoFixEngine, PredictiveAnalytics };

// Types
export type {
  // Flaky detection
  FlakyTestReport,
  FlakyTest,
  FailurePattern,
  FailurePatternType,

  // Prioritization
  TestPriority,
  TestPriorityLevel,
  CodeChange,
  ChangeContext,

  // Auto-fix
  AutoFixSuggestion,
  ApplyResult,
  ValidationResult,
  FixCategory,

  // Analytics
  PredictiveInsight,
  TestTrend,
  TestHealthScore,
  RiskAssessment,
  ImpactScore,

  // Shared
  TestRun,
  TestFailure,
  WeightedTestRun,
} from './types.js';

// Convenience factory for initializing all services
export class TestIntelligenceEngineFactory {
  static createFlaky(): FlakyDetector {
    return new FlakyDetector();
  }

  static createPrioritizer(): TestPrioritizer {
    return new TestPrioritizer();
  }

  static createAutoFix(): AutoFixEngine {
    return new AutoFixEngine();
  }

  static createAnalytics(): PredictiveAnalytics {
    return new PredictiveAnalytics();
  }

  static createAll() {
    return {
      flaky: this.createFlaky(),
      prioritizer: this.createPrioritizer(),
      autoFix: this.createAutoFix(),
      analytics: this.createAnalytics(),
    };
  }
}

// Re-export routes
export { default as testIntelligenceRoutes } from '../../routes/test-intelligence.routes.js';
