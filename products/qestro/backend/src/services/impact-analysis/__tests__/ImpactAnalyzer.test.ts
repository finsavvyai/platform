/**
 * Impact Analyzer Tests
 * Tests for code change impact analysis and test selection
 */

import { ImpactAnalyzer, impactAnalyzer } from '../ImpactAnalyzer.js';
import { CoverageMapper, coverageMapper } from '../CoverageMapper.js';
import type { CodeChange } from '../types.js';

describe('ImpactAnalyzer', () => {
  let analyzer: ImpactAnalyzer;
  let mapper: CoverageMapper;

  beforeEach(() => {
    analyzer = new ImpactAnalyzer();
    mapper = new CoverageMapper();

    // Setup test metadata
    analyzer.registerTest('test-1', 'Auth Tests', 'src/tests/auth.test.ts', 5000);
    analyzer.registerTest('test-2', 'User Tests', 'src/tests/user.test.ts', 3000);
    analyzer.registerTest('test-3', 'API Tests', 'src/tests/api.test.ts', 8000);
    analyzer.registerTest('test-4', 'Utils Tests', 'src/tests/utils.test.ts', 2000);
  });

  afterEach(() => {
    analyzer.clear();
    mapper.clear();
  });

  describe('Analyze Impact', () => {
    it('should identify affected tests from code changes', async () => {
      await mapper.updateCoverage('test-1', ['src/auth.ts', 'src/middleware.ts'], 'project-1');
      await mapper.updateCoverage('test-2', ['src/user.ts', 'src/db.ts'], 'project-1');

      const changes: CodeChange[] = [
        {
          filePath: 'src/auth.ts',
          changeType: 'modified',
          additions: 10,
          deletions: 5,
          linesChanged: ['line 1', 'line 2'],
          timestamp: new Date(),
          commitHash: 'abc123',
        },
      ];

      const result = await analyzer.analyzeImpact('project-1', changes);

      expect(result.affectedTests).toContainEqual(
        expect.objectContaining({ testId: 'test-1' })
      );
      expect(result.stats.totalAffectedTests).toBeGreaterThan(0);
    });

    it('should calculate risk levels correctly', async () => {
      await mapper.updateCoverage('test-1', ['src/auth.ts'], 'project-1');

      const changes: CodeChange[] = [
        {
          filePath: 'src/auth.ts',
          changeType: 'modified',
          additions: 100,
          deletions: 50,
          linesChanged: Array(50).fill('line'),
          timestamp: new Date(),
          commitHash: 'abc123',
        },
      ];

      const result = await analyzer.analyzeImpact('project-1', changes);

      expect(result.risk.riskLevel).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(result.risk.riskLevel);
    });

    it('should flag critical files', async () => {
      await mapper.updateCoverage('test-1', ['src/payment.ts'], 'project-1');

      const changes: CodeChange[] = [
        {
          filePath: 'src/payment.ts',
          changeType: 'modified',
          additions: 50,
          deletions: 20,
          linesChanged: Array(20).fill('line'),
          timestamp: new Date(),
          commitHash: 'abc123',
        },
      ];

      const result = await analyzer.analyzeImpact('project-1', changes);

      expect(result.risk.criticalFiles).toContain('src/payment.ts');
      expect(result.risk.riskLevel).toMatch(/high|critical/);
    });

    it('should calculate estimated run time', async () => {
      await mapper.updateCoverage('test-1', ['src/auth.ts'], 'project-1');
      await mapper.updateCoverage('test-2', ['src/auth.ts'], 'project-1');

      const changes: CodeChange[] = [
        {
          filePath: 'src/auth.ts',
          changeType: 'modified',
          additions: 10,
          deletions: 5,
          linesChanged: ['line 1'],
          timestamp: new Date(),
          commitHash: 'abc123',
        },
      ];

      const result = await analyzer.analyzeImpact('project-1', changes);

      expect(result.stats.estimatedTestRunTime).toBeGreaterThan(0);
      expect(result.risk.estimatedRunTime).toBe(result.stats.estimatedTestRunTime);
    });
  });

  describe('Affected Tests', () => {
    it('should return empty array when no tests cover file', async () => {
      const affected = await analyzer.getAffectedTests('src/unknown.ts');

      expect(affected).toHaveLength(0);
    });

    it('should return tests covering a file', async () => {
      await mapper.updateCoverage('test-1', ['src/auth.ts'], 'project-1');
      await mapper.updateCoverage('test-2', ['src/auth.ts'], 'project-1');

      const affected = await analyzer.getAffectedTests('src/auth.ts');

      expect(affected).toHaveLength(2);
      expect(affected.map(t => t.testId)).toContain('test-1');
      expect(affected.map(t => t.testId)).toContain('test-2');
    });

    it('should include test metadata', async () => {
      await mapper.updateCoverage('test-1', ['src/auth.ts'], 'project-1');

      const affected = await analyzer.getAffectedTests('src/auth.ts');

      expect(affected[0]).toEqual(
        expect.objectContaining({
          testId: 'test-1',
          testName: 'Auth Tests',
          filePath: 'src/tests/auth.test.ts',
          estimatedRunTime: 5000,
        })
      );
    });
  });

  describe('Dependency Graph', () => {
    it('should build dependency graph', async () => {
      await mapper.updateCoverage('test-1', ['src/auth.ts', 'src/middleware.ts'], 'project-1');
      await mapper.updateCoverage('test-2', ['src/user.ts'], 'project-1');

      const graph = await analyzer.buildDependencyGraph('project-1');

      expect(graph.projectId).toBe('project-1');
      expect(Object.keys(graph.nodes).length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('should link tests to files in graph', async () => {
      await mapper.updateCoverage('test-1', ['src/auth.ts'], 'project-1');

      const graph = await analyzer.buildDependencyGraph('project-1');

      expect(graph.nodes['test-1']).toBeDefined();
      expect(graph.nodes['src/auth.ts']).toBeDefined();
    });
  });

  describe('Change Risk Assessment', () => {
    it('should detect deletions as risk', async () => {
      const changes: CodeChange[] = [
        {
          filePath: 'src/deleted.ts',
          changeType: 'deleted',
          additions: 0,
          deletions: 100,
          linesChanged: [],
          timestamp: new Date(),
          commitHash: 'abc123',
        },
      ];

      const result = await analyzer.analyzeImpact('project-1', changes);

      expect(result.risk.riskFactors.some(f => f.includes('deleted'))).toBe(true);
    });

    it('should detect large changes as risk', async () => {
      const changes: CodeChange[] = [
        {
          filePath: 'src/large.ts',
          changeType: 'modified',
          additions: 600,
          deletions: 100,
          linesChanged: Array(600).fill('line'),
          timestamp: new Date(),
          commitHash: 'abc123',
        },
      ];

      const result = await analyzer.analyzeImpact('project-1', changes);

      expect(result.risk.riskFactors.some(f => f.includes('Large addition'))).toBe(true);
    });

    it('should provide recommendations', async () => {
      await mapper.updateCoverage('test-1', ['src/auth.ts'], 'project-1');
      await mapper.updateCoverage('test-2', ['src/auth.ts'], 'project-1');

      const changes: CodeChange[] = [
        {
          filePath: 'src/auth.ts',
          changeType: 'modified',
          additions: 100,
          deletions: 50,
          linesChanged: Array(50).fill('line'),
          timestamp: new Date(),
          commitHash: 'abc123',
        },
      ];

      const result = await analyzer.analyzeImpact('project-1', changes);

      expect(result.risk.recommendations.length).toBeGreaterThan(0);
    });
  });
});

describe('CoverageMapper', () => {
  let mapper: CoverageMapper;

  beforeEach(() => {
    mapper = new CoverageMapper();
  });

  afterEach(() => {
    mapper.clear();
  });

  describe('Update Coverage', () => {
    it('should update coverage for a test', async () => {
      await mapper.updateCoverage('test-1', ['src/auth.ts', 'src/middleware.ts']);

      const files = await mapper.getFilesForTest('test-1');

      expect(files).toHaveLength(2);
      expect(files).toContain('src/auth.ts');
    });

    it('should link files to tests', async () => {
      await mapper.updateCoverage('test-1', ['src/auth.ts']);
      await mapper.updateCoverage('test-2', ['src/auth.ts']);

      const tests = await mapper.getTestsForFile('src/auth.ts');

      expect(tests).toHaveLength(2);
      expect(tests).toContain('test-1');
      expect(tests).toContain('test-2');
    });
  });

  describe('Get Tests for File', () => {
    it('should return empty array for uncovered file', async () => {
      const tests = await mapper.getTestsForFile('src/unknown.ts');

      expect(tests).toHaveLength(0);
    });

    it('should return all tests covering a file', async () => {
      await mapper.updateCoverage('test-1', ['src/auth.ts']);
      await mapper.updateCoverage('test-2', ['src/auth.ts']);
      await mapper.updateCoverage('test-3', ['src/other.ts']);

      const tests = await mapper.getTestsForFile('src/auth.ts');

      expect(tests).toHaveLength(2);
    });
  });

  describe('Coverage Statistics', () => {
    it('should calculate coverage stats', async () => {
      await mapper.updateCoverage('test-1', ['src/auth.ts', 'src/user.ts'], 'project-1');
      await mapper.updateCoverage('test-2', ['src/auth.ts'], 'project-1');

      const stats = await mapper.getCoverageStats('project-1');

      expect(stats.projectId).toBe('project-1');
      expect(stats.totalFiles).toBeGreaterThan(0);
      expect(stats.coverage).toBeGreaterThanOrEqual(0);
      expect(stats.coverage).toBeLessThanOrEqual(100);
    });

    it('should track tests per file', async () => {
      await mapper.updateCoverage('test-1', ['src/auth.ts'], 'project-1');
      await mapper.updateCoverage('test-2', ['src/auth.ts'], 'project-1');

      const stats = await mapper.getCoverageStats('project-1');

      expect(stats.byFile['src/auth.ts']).toEqual(
        expect.objectContaining({
          testCount: 2,
          tests: expect.arrayContaining(['test-1', 'test-2']),
        })
      );
    });
  });

  describe('Impact Score', () => {
    it('should calculate impact score for changes', async () => {
      await mapper.updateCoverage('test-1', ['src/auth.ts', 'src/user.ts']);
      await mapper.updateCoverage('test-2', ['src/auth.ts']);
      await mapper.updateCoverage('test-3', ['src/db.ts']);

      const score = await mapper.calculateImpactScore(['src/auth.ts']);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return 0 for no coverage', async () => {
      const score = await mapper.calculateImpactScore(['src/unknown.ts']);

      expect(score).toBe(0);
    });
  });

  describe('Batch Operations', () => {
    it('should get tests for multiple files', async () => {
      await mapper.updateCoverage('test-1', ['src/auth.ts']);
      await mapper.updateCoverage('test-2', ['src/user.ts']);
      await mapper.updateCoverage('test-3', ['src/auth.ts', 'src/user.ts']);

      const tests = await mapper.getTestsForFiles(['src/auth.ts', 'src/user.ts']);

      expect(tests).toHaveLength(3);
    });
  });
});
