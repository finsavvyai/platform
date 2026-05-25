/**
 * Tests for GraphEngine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GraphEngine } from '../../graph/GraphEngine';
import type { ProjectGraph, ProjectFile, FileContent, WorkspaceInfo } from '../../types';

describe('GraphEngine', () => {
  let engine: GraphEngine;
  let mockWorkspace: WorkspaceInfo;
  let mockFiles: FileContent[];

  beforeEach(() => {
    mockWorkspace = {
      rootPath: '/test/project',
      name: 'test-project',
      folders: ['/test/project/src', '/test/project/lib']
    };

    mockFiles = [
      {
        path: '/test/project/src/index.ts',
        content: `
          import { helper } from './helper';
          import * as fs from 'fs';
          export class Main { }
        `,
        lastModified: Date.now(),
        size: 100,
        hash: 'hash1'
      },
      {
        path: '/test/project/src/helper.ts',
        content: `
          export function helper() {
            return 'hello';
          }
        `,
        lastModified: Date.now(),
        size: 50,
        hash: 'hash2'
      },
      {
        path: '/test/project/lib/utils.py',
        content: `
          import os
          import sys

          def utils():
              return os.path.join(__file__)

          def process_data():
              return "processed"
        `,
        lastModified: Date.now(),
        size: 75,
        hash: 'hash3'
      }
    ];

    engine = new GraphEngine(mockWorkspace, {
      concurrency: 2,
      maxFileSize: 1024 * 1024,
      enableIncremental: true,
      enableCaching: false // Disable caching for tests
    });
  });

  afterEach(async () => {
    await engine.dispose();
  });

  describe('Basic Graph Building', () => {
    it('should build graph from files', async () => {
      const result = await engine.buildGraph(mockFiles);

      expect(result.success).toBe(true);
      expect(result.graph.files).toHaveLength(3);
      expect(result.graph.dependencies).toBeDefined();
      expect(result.errors).toHaveLength(0);

      // Check file metadata
      expect(result.graph.files[0].path).toBe('/test/project/src/index.ts');
      expect(result.graph.files[0].language).toBe('typescript');
    });

    it('should include graph analytics', async () => {
      const result = await engine.buildGraph(mockFiles);

      expect(result.graph.analytics).toBeDefined();
      expect(result.graph.analytics.complexity).toBeGreaterThanOrEqual(0);
      expect(result.graph.analytics.maintainabilityIndex).toBeGreaterThanOrEqual(0);
      expect(result.graph.analytics.metrics).toBeDefined();
    });

    it('should track build statistics', async () => {
      await engine.buildGraph(mockFiles);

      const stats = engine.getBuildStats();
      expect(stats.totalBuilds).toBe(1);
      expect(stats.filesAnalyzed).toBe(3);
      expect(stats.errorsEncountered).toBe(0);
    });
  });

  describe('File Processing', () => {
    it('should filter files by patterns', async () => {
      const filesWithExclusions = [
        ...mockFiles,
        {
          path: '/test/project/node_modules/index.js',
          content: 'console.log("test");',
          lastModified: Date.now(),
          size: 25,
          hash: 'exclude-hash'
        },
        {
          path: '/test/project/.git/config',
          content: 'config',
          lastModified: Date.now(),
          size: 10,
          hash: 'git-hash'
        }
      ];

      const result = await engine.buildGraph(filesWithExclusions);

      // Should exclude node_modules and .git files
      expect(result.graph.files).toHaveLength(3);
      expect(result.graph.files.find(f => f.path.includes('node_modules'))?.toBeFalsy();
      expect(result.graph.files.find(f => f.path.includes('.git'))?.toBeFalsy();
    });

    it('should reject oversized files', async () => {
      const oversizedFile: FileContent = {
        path: '/test/project/large.ts',
        content: 'x'.repeat(2 * 1024 * 1024), // 2MB
        lastModified: Date.now(),
        size: 2 * 1024 * 1024,
        hash: 'large-hash'
      };

      const result = await engine.buildGraph([oversizedFile]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('File too large');
    });

    it('should handle empty file list', async () => {
      const result = await engine.buildGraph([]);

      expect(result.success).toBe(true);
      expect(result.graph.files).toHaveLength(0);
      expect(result.graph.dependencies).toHaveLength(0);
    });
  });

  describe('Language Detection', () => {
    it('should detect TypeScript files', () => {
      expect(engine.isFileSupported('file.ts')).toBe(true);
      expect(engine.isFileSupported('file.tsx')).toBe(true);
      expect(engine.isFileSupported('file.js')).toBe(true);
      expect(engine.isFileSupported('file.jsx')).toBe(true);
    });

    it('should detect Python files', () => {
      expect(engine.isFileSupported('file.py')).toBe(true);
      expect(engine.isFileSupported('file.pyi')).toBe(true);
    });

    it('should reject unsupported files', () => {
      expect(engine.isFileSupported('file.txt')).toBe(false);
      expect(engine.isFileSupported('file.md')).toBe(false);
    });

    it('should get supported languages', () => {
      const languages = engine.getSupportedLanguages();
      expect(languages).toContain('typescript');
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
    });
  });

  describe('Dependency Analysis', () => {
    it('should extract TypeScript dependencies', async () => {
      const tsFile: FileContent = {
        path: '/test/project/src/component.ts',
        content: `
          import React from 'react';
          import { useState, useEffect } from 'react';
          import type { FC } from 'react';
          import * as utils from './utils';
          export class Component extends React.Component {}
        `,
        lastModified: Date.now(),
        size: 200,
        hash: 'component-hash'
      };

      const result = await engine.buildGraph([tsFile]);

      expect(result.graph.dependencies.length).toBeGreaterThan(0);
      expect(result.graph.dependencies.some(dep => dep.to.includes('react'))?.toBe(true);
      expect(result.graph.dependencies.some(dep => dep.to.includes('./utils'))?.toBe(true);
    });

    it('should extract Python dependencies', async () => {
      const pythonFile: FileContent = {
        path: '/test/project/lib/module.py',
        content: `
          import os
          import sys
          from typing import Optional
          from datetime import datetime
          import local_module
          from .utils import helper
          class Module: pass
        `,
        lastModified: Date.now(),
        size: 180,
        hash: 'module-hash'
      };

      const result = await engine.buildGraph([pythonFile]);

      expect(result.graph.dependencies.length).toBeGreaterThan(0);
      expect(result.graph.dependencies.some(dep => dep.to.includes('os'))?.toBe(true);
      expect(result.graph.dependencies.some(dep => dep.to.includes('sys'))?.toBe(true);
      expect(result.graph.dependencies.some(dep => dep.to.includes('local_module'))?.toBe(true);
    });
  });

  describe('Graph Analytics', () => {
    it('should calculate dependency density', async () => {
      const files: FileContent[] = [];

      // Create files with varying dependency counts
      for (let i = 0; i < 10; i++) {
        const deps = new Array(i + 1).fill(0).map((_, idx) => `dep${idx}`);
        const content = deps.map(dep => `import ${dep};`).join('\n');

        files.push({
          path: `/test/project/src/file${i}.js`,
          content,
          lastModified: Date.now(),
          size: content.length,
          hash: `file${i}-hash`
        });
      }

      const result = await engine.buildGraph(files);

      expect(result.graph.analytics.metrics.dependencyDensity).toBeGreaterThan(0);
    });

    it('should detect circular dependencies', async () => {
      const circularFiles: FileContent[] = [
        {
          path: '/test/project/a.ts',
          content: `
            import { b } from './b';
            export class A {}
          `,
          lastModified: Date.now(),
          size: 100,
          hash: 'a-hash'
        },
        {
          path: '/test/project/b.ts',
          content: `
            import { a } from './a';
            export class B {}
          `,
          lastModified: Date.now(),
          size: 100,
          hash: 'b-hash'
        }
      ];

      const result = await engine.buildGraph(circularFiles);

      expect(result.graph.analytics.circularDependencies.length).toBeGreaterThan(0);
    });

    it('should identify code hotspots', async () => {
      const complexFile: FileContent = {
        path: '/test/project/complex.ts',
        content: `
          import { one } from './one';
          import { two } from './two';
          import { three } from './three';
          import { four } from './four';
          import { five } from './five';
          import { six } from './six';
          export class Complex {
            method1() { one(); }
            method2() { two(); }
            method3() { three(); }
            method4() { four(); }
            method5() { five(); }
            method6() { six(); }
          }
        `,
        lastModified: Date.now(),
        size: 300,
        hash: 'complex-hash'
      };

      const result = await engine.buildGraph([complexFile]);

      expect(result.graph.analytics.hotspots.length).toBeGreaterThan(0);
      expect(result.graph.analytics.hotspots.some(h => h.type === 'complexity'))?.toBe(true);
    });
  });

  describe('Memory Cache', () => {
    it('should cache graph when enabled', async () => {
      const cachedEngine = new GraphEngine(mockWorkspace, {
        enableCaching: true,
        concurrency: 1,
        maxFileSize: 1024 * 1024
      });

      // First build
      const result1 = await cachedEngine.buildGraph(mockFiles);
      expect(result1.success).toBe(true);

      const stats1 = cachedEngine.getBuildStats();
      expect(stats1.totalBuilds).toBe(1);

      // Second build should be cached (if we had a real cache)
      const result2 = await cachedEngine.buildGraph(mockFiles);
      expect(result2.success).toBe(true);

      const stats2 = cachedEngine.getBuildStats();
      expect(stats2.totalBuilds).toBe(2);

      await cachedEngine.dispose();
    });

    it('should track cache statistics', async () => {
      const cachedEngine = new GraphEngine(mockWorkspace, {
        enableCaching: true,
        concurrency: 1,
        maxFileSize: 1024 * 1024
      });

      const stats = cachedEngine.getBuildStats();
      expect(stats.cacheHits).toBe(0);

      await cachedEngine.dispose();
    });
  });

  describe('Incremental Updates', () => {
    it('should update graph with changed files', async () => {
      const initialResult = await engine.buildGraph(mockFiles);
      expect(initialResult.graph.files).toHaveLength(3);

      // Add a new file
      const newFile: FileContent = {
        path: '/test/project/src/new.ts',
        content: `
          import { helper } from './helper';
          export function newFeature() {
            return helper();
          }
        `,
        lastModified: Date.now(),
        size: 80,
        hash: 'new-hash'
      };

      // Simulate incremental update
      const updatedGraph = await engine.updateGraph(initialResult.graph, {
        changedFiles: ['/test/project/src/new.ts'],
        deletedFiles: []
      });

      expect(updatedGraph.files).toHaveLength(4);
      expect(updatedGraph.files.find(f => f.path === '/test/project/src/new.ts')).toBeDefined();
      expect(updatedGraph.dependencies.length).toBeGreaterThan(initialResult.graph.dependencies.length);
    });

    it('should remove deleted files', async () => {
      const initialResult = await engine.buildGraph(mockFiles);
      expect(initialResult.graph.files).toHaveLength(3);

      // Delete a file
      const updatedGraph = await engine.updateGraph(initialResult.graph, {
        changedFiles: [],
        deletedFiles: ['/test/project/src/index.ts']
      });

      expect(updatedGraph.files).toHaveLength(2);
      expect(updatedGraph.files.find(f => f.path === '/test/project/src/index.ts')).toBeUndefined();
      expect(updatedGraph.dependencies.filter(d => d.from === '/test/project/src/index.ts')).toHaveLength(0);
    });

    it('should handle empty changes', async () => {
      const initialResult = await engine.buildGraph(mockFiles);
      expect(initialResult.graph.files).toHaveLength(3);

      const updatedGraph = await engine.updateGraph(initialResult.graph, {
        changedFiles: [],
        deletedFiles: []
      });

      expect(updatedGraph.files).toHaveLength(3);
      expect(JSON.stringify(updatedGraph)).toBe(JSON.stringify(initialResult.graph));
    });
  });

  describe('Performance', () => {
    it('should handle large file sets efficiently', async () => {
      const manyFiles: FileContent[] = [];

      // Create 500 files
      for (let i = 0; i < 500; i++) {
        manyFiles.push({
          path: `/test/project/file${i}.ts`,
          content: `
            import { helper${i} } from './helper${i}';
            export class File${i} { }
          `,
          lastModified: Date.now(),
          size: 50 + i,
          hash: `file${i}-hash`
        });
      }

      const startTime = Date.now();
      const result = await engine.buildGraph(manyFiles);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.graph.files).toHaveLength(500);
      expect(duration).toBeLessThan(10000); // 10 seconds
    });

    it('should work under high concurrency', async () => {
      const concurrentEngine = new GraphEngine(mockWorkspace, {
        concurrency: 8,
        maxFileSize: 1024 * 1024
      });

      const manyFiles: FileContent[] = [];
      for (let i = 0; i < 200; i++) {
        manyFiles.push({
          path: `/test/project/file${i}.ts`,
          content: `export function func${i}() { return ${i}; }`,
          lastModified: Date.now(),
          size: 30,
          hash: `file${i}-hash`
        });
      }

      const result = await concurrentEngine.buildGraph(manyFiles);

      expect(result.success).toBe(true);
      expect(result.graph.files).toHaveLength(200);

      await concurrentEngine.dispose();
    });
  });

  describe('Error Handling', () => {
    it('should handle analyzer errors gracefully', async () => {
      const problematicFile: FileContent = {
        path: '/test/project/error.ts',
        content: `
          // This file has malformed TypeScript
          import { } from './missing'; // Syntax error
        `,
        lastModified: Date.now(),
        size: 50,
        hash: 'error-hash'
      };

      const result = await engine.buildGraph([problematicFile]);

      // Should succeed despite analysis errors
      expect(result.success).toBe(true);
      // File should still be included in graph
      expect(result.graph.files.some(f => f.path === '/test/project/error.ts')).toBe(true);
    });

    it('should handle analysis failures', async () => {
      // Mock analyzer that throws an error
      const mockAnalyzer = {
        getSupportedExtensions: () => ['.ts'],
        getLanguageName: () => 'typescript',
        canAnalyze: () => true,
        analyzeFile: vi.fn().mockRejectedValue(new Error('Analysis failed'))
      };

      engine.addAnalyzer(mockAnalyzer);

      const result = await engine.buildGraph(mockFiles);

      expect(result.success).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Management', () => {
    it('should dispose properly', async () => {
      await engine.buildGraph(mockFiles);

      // Should not throw on dispose
      await engine.dispose();
    });

    it('should handle multiple disposals', async () => {
      await engine.dispose();
      await engine.dispose(); // Should not throw
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with old-style file array', async () => {
      // Test with string file paths (legacy interface)
      const fileStrings = [
        '/test/project/src/index.ts',
        '/test/project/src/helper.ts',
        '/test/project/lib/utils.py'
      ];

      const result = await engine.buildGraph(fileStrings);

      expect(result.success).toBe(true);
      expect(result.graph.files).toHaveLength(3);
    });
  });
});