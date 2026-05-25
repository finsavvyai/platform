/**
 * Coverage Mapper - Maps code coverage to test dependencies
 */

import { logger } from '../../utils/logger.js';
import type { CoverageMap, CoverageStats } from './types.js';

export class CoverageMapper {
  private coverageMaps = new Map<string, CoverageMap>();
  private fileToTests = new Map<string, Set<string>>();
  private projectCoverage = new Map<string, Map<string, Set<string>>>();

  async updateCoverage(testId: string, coveredFiles: string[], projectId?: string): Promise<void> {
    const coverage = new Set(coveredFiles);
    this.coverageMaps.set(testId, { testId, coveredFiles: coverage, coverage: coveredFiles.length > 0 ? 1 : 0, lastUpdated: new Date() });

    if (projectId) {
      if (!this.projectCoverage.has(projectId)) {
        this.projectCoverage.set(projectId, new Map());
      }
      this.projectCoverage.get(projectId)!.set(testId, coverage);
    }

    for (const file of coveredFiles) {
      if (!this.fileToTests.has(file)) {
        this.fileToTests.set(file, new Set());
      }
      this.fileToTests.get(file)!.add(testId);
    }

    logger.debug(`Coverage updated: testId=${testId}, files=${coveredFiles.length}`);
  }

  async getTestsForFile(filePath: string): Promise<string[]> {
    const tests = this.fileToTests.get(filePath);
    return tests ? Array.from(tests) : [];
  }

  async getFilesForTest(testId: string): Promise<string[]> {
    const coverage = this.coverageMaps.get(testId);
    return coverage ? Array.from(coverage.coveredFiles) : [];
  }

  async getCoverageStats(projectId: string): Promise<CoverageStats> {
    const projectTests = this.projectCoverage.get(projectId);
    const allFiles = new Set<string>();
    const byFile: CoverageStats['byFile'] = {};

    if (projectTests) {
      for (const [testId, files] of projectTests) {
        for (const file of files) {
          allFiles.add(file);
          if (!byFile[file]) {
            byFile[file] = { coverage: 0, testCount: 0, tests: [] };
          }
          byFile[file].testCount += 1;
          byFile[file].tests.push(testId);
        }
      }
    }

    const totalFiles = allFiles.size;
    const coveredFiles = Object.keys(byFile).length;
    const coverage = totalFiles > 0 ? (coveredFiles / totalFiles) * 100 : 0;

    return {
      projectId,
      totalFiles,
      coveredFiles,
      coverage,
      byFile,
      gaps: Array.from(allFiles).filter(f => !byFile[f]),
    };
  }

  async getTestsForFiles(files: string[]): Promise<string[]> {
    const testsSet = new Set<string>();
    for (const file of files) {
      const tests = this.fileToTests.get(file);
      if (tests) tests.forEach(t => testsSet.add(t));
    }
    return Array.from(testsSet);
  }

  clear(): void {
    this.coverageMaps.clear();
    this.fileToTests.clear();
    this.projectCoverage.clear();
  }

  getCoverage(testId: string): CoverageMap | undefined {
    return this.coverageMaps.get(testId);
  }

  getAllFiles(): string[] {
    return Array.from(this.fileToTests.keys());
  }

  async calculateImpactScore(changedFiles: string[]): Promise<number> {
    const totalFiles = this.fileToTests.size;
    if (totalFiles === 0) return 0;
    const affectedTests = await this.getTestsForFiles(changedFiles);
    return Math.min(affectedTests.length / totalFiles, 1);
  }
}

export const coverageMapper = new CoverageMapper();
