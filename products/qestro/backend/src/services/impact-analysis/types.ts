/**
 * Test Impact Analysis Types
 * Defines structures for analyzing impact of code changes on tests
 */

/**
 * Represents a code change (commit, file diff)
 */
export interface CodeChange {
  filePath: string;
  changeType: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
  linesChanged: string[];
  timestamp: Date;
  commitHash?: string;
  author?: string;
}

/**
 * A test affected by code changes
 */
export interface AffectedTest {
  testId: string;
  testName: string;
  filePath: string;
  impactLevel: 'direct' | 'indirect' | 'low';
  relevantCoverage: string[];
  estimatedRunTime: number;
  failureProbability: number;
  lastRunStatus?: 'passed' | 'failed' | 'skipped';
  lastRunTime?: Date;
}

/**
 * Dependency graph for a project
 */
export interface DependencyGraph {
  projectId: string;
  nodes: {
    [key: string]: {
      type: 'test' | 'source';
      dependencies: string[];
      dependents: string[];
    };
  };
  edges: Array<{
    source: string;
    target: string;
    type: 'covers' | 'depends_on';
  }>;
}

/**
 * Coverage map linking tests to source files
 */
export interface CoverageMap {
  testId: string;
  coveredFiles: Set<string>;
  coverage: number;
  lastUpdated: Date;
}

/**
 * Coverage statistics for a project
 */
export interface CoverageStats {
  projectId: string;
  totalFiles: number;
  coveredFiles: number;
  coverage: number;
  byFile: {
    [filePath: string]: {
      coverage: number;
      testCount: number;
      tests: string[];
    };
  };
  gaps: string[];
}

/**
 * Change risk assessment
 */
export interface ChangeRisk {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  riskFactors: string[];
  affectedTestsCount: number;
  estimatedRunTime: number;
  criticalFiles: string[];
  recommendations: string[];
}

/**
 * Complete impact analysis result
 */
export interface ImpactResult {
  projectId: string;
  changes: CodeChange[];
  affectedTests: AffectedTest[];
  risk: ChangeRisk;
  stats: {
    totalChanges: number;
    totalAffectedTests: number;
    directImpact: number;
    indirectImpact: number;
    estimatedTestRunTime: number;
  };
  timestamp: Date;
}
