/**
 * Impact Analyzer - Analyzes code changes and their impact on tests
 */

import { logger } from '../../utils/logger.js';
import { coverageMapper } from './CoverageMapper.js';
import { RiskCalculator } from './RiskCalculator.js';
import type {
  CodeChange,
  ImpactResult,
  AffectedTest,
  DependencyGraph,
} from './types.js';

export class ImpactAnalyzer {
  private dependencyGraphs = new Map<string, DependencyGraph>();
  private testMetadata = new Map<string, {
    name: string;
    path: string;
    estimatedRunTime: number;
    lastStatus?: 'passed' | 'failed' | 'skipped';
    lastRunTime?: Date;
  }>();
  private riskCalculator = new RiskCalculator();

  registerTest(testId: string, name: string, path: string, estimatedRunTime: number = 5000): void {
    this.testMetadata.set(testId, { name, path, estimatedRunTime });
  }

  async analyzeImpact(projectId: string, changes: CodeChange[]): Promise<ImpactResult> {
    const affectedTests: AffectedTest[] = [];
    const riskFactors: string[] = [];

    for (const change of changes) {
      const tests = await coverageMapper.getTestsForFile(change.filePath);
      riskFactors.push(...this.riskCalculator.assessChangeRisk(change));

      for (const testId of tests) {
        if (!affectedTests.find(t => t.testId === testId)) {
          affectedTests.push(this.getAffectedTest(testId, change));
        }
      }
    }

    const risk = this.riskCalculator.calculateRisk(changes, affectedTests, riskFactors);
    const directImpact = affectedTests.filter(t => t.impactLevel === 'direct').length;

    const result: ImpactResult = {
      projectId,
      changes,
      affectedTests,
      risk,
      stats: {
        totalChanges: changes.length,
        totalAffectedTests: affectedTests.length,
        directImpact,
        indirectImpact: affectedTests.filter(t => t.impactLevel === 'indirect').length,
        estimatedTestRunTime: affectedTests.reduce((sum, t) => sum + t.estimatedRunTime, 0),
      },
      timestamp: new Date(),
    };

    logger.info(
      `Analysis: changes=${changes.length}, affected=${affectedTests.length}, risk=${risk.riskLevel}`
    );

    return result;
  }

  async getAffectedTests(filePath: string, projectId?: string): Promise<AffectedTest[]> {
    const testIds = await coverageMapper.getTestsForFile(filePath);
    return testIds.map(testId => {
      const meta = this.testMetadata.get(testId);
      return {
        testId,
        testName: meta?.name ?? testId,
        filePath: meta?.path ?? '',
        impactLevel: 'direct' as const,
        relevantCoverage: [filePath],
        estimatedRunTime: meta?.estimatedRunTime ?? 5000,
        failureProbability: meta?.lastStatus === 'failed' ? 0.7 : meta?.lastStatus === 'passed' ? 0.1 : 0.3,
        lastRunStatus: meta?.lastStatus,
        lastRunTime: meta?.lastRunTime,
      };
    });
  }

  async buildDependencyGraph(projectId: string): Promise<DependencyGraph> {
    const graph: DependencyGraph = {
      projectId,
      nodes: {},
      edges: [],
    };

    const allFiles = coverageMapper.getAllFiles();

    for (const file of allFiles) {
      const tests = await coverageMapper.getTestsForFile(file);

      if (!graph.nodes[file]) {
        graph.nodes[file] = {
          type: 'source',
          dependencies: [],
          dependents: tests,
        };
      }

      for (const testId of tests) {
        if (!graph.nodes[testId]) {
          graph.nodes[testId] = {
            type: 'test',
            dependencies: [file],
            dependents: [],
          };
        } else if (!graph.nodes[testId].dependencies.includes(file)) {
          graph.nodes[testId].dependencies.push(file);
        }

        graph.edges.push({
          source: testId,
          target: file,
          type: 'covers',
        });
      }
    }

    logger.debug(`Graph: nodes=${Object.keys(graph.nodes).length}, edges=${graph.edges.length}`);
    this.dependencyGraphs.set(projectId, graph);
    return graph;
  }

  private getAffectedTest(testId: string, change: CodeChange): AffectedTest {
    const meta = this.testMetadata.get(testId);
    const impactLevel = change.changeType === 'deleted' ? 'direct' : change.additions > 100 ? 'indirect' : 'low';

    return {
      testId,
      testName: meta?.name ?? testId,
      filePath: meta?.path ?? '',
      impactLevel,
      relevantCoverage: [change.filePath],
      estimatedRunTime: meta?.estimatedRunTime ?? 5000,
      failureProbability: meta?.lastStatus === 'failed' ? 0.7 : meta?.lastStatus === 'passed' ? 0.1 : 0.3,
      lastRunStatus: meta?.lastStatus,
      lastRunTime: meta?.lastRunTime,
    };
  }

  clear(): void {
    this.dependencyGraphs.clear();
    this.testMetadata.clear();
  }
}

export const impactAnalyzer = new ImpactAnalyzer();
