/**
 * Tests for EnhancedProjectGraph and enhanced data models
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedProjectGraphBuilder } from '../../graph/EnhancedProjectGraph';
import type { EnhancedProjectGraph } from '../../graph/models';

describe('EnhancedProjectGraphBuilder', () => {
  let builder: EnhancedProjectGraphBuilder;

  beforeEach(() => {
    builder = new EnhancedProjectGraphBuilder();
  });

  describe('Basic Graph Building', () => {
    it('should create an enhanced project graph', () => {
      // Add test files
      builder.addFile({
        path: '/test/index.ts',
        size: 1000,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'test-hash'
      }, `export function main() {
  console.log('Hello World');
  return 42;
}`);

      builder.addFile({
        path: '/test/helper.ts',
        size: 500,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'helper-hash'
      }, `export function helper() {
  return 'helper result';
}`);

      // Add dependency
      builder.addDependency({
        from: '/test/index.ts',
        to: '/test/helper.ts',
        type: 'import' as any,
        strength: 'medium' as any,
        metadata: {
          lineNumbers: [1],
          sourceType: 'import'
        }
      });

      const graph = builder.build();

      expect(graph.files).toHaveLength(2);
      expect(graph.dependencies).toHaveLength(1);
      expect(graph.metadata.fileCount).toBe(2);
      expect(graph.metadata.dependencyCount).toBe(1);
      expect(graph.metadata.languages).toContain('typescript');
    });

    it('should export and import graphs', () => {
      // Build a simple graph
      builder.addFile({
        path: '/test/test.ts',
        size: 100,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'test'
      }, 'export const test = true;');

      const graph = builder.build();
      const exported = builder.export();

      // Import the exported graph
      const imported = EnhancedProjectGraphBuilder.import(exported) as EnhancedProjectGraph;

      expect(imported.files).toEqual(graph.files);
      expect(imported.dependencies).toEqual(graph.dependencies);
      expect(imported.metadata.version).toBe(graph.metadata.version);
    });
  });

  describe('Enhanced File Metrics', () => {
    it('should calculate comprehensive file metrics', () => {
      const content = `
import { something } from './module';

export class TestClass {
  private value: number;

  constructor(value: number) {
    this.value = value;
  }

  public getValue(): number {
    if (this.value > 0) {
      return this.value;
    } else {
      return 0;
    }
  }

  private complexMethod(param: string): boolean {
    for (let i = 0; i < param.length; i++) {
      if (param[i] === 'a') {
        return true;
      }
    }
    return false;
  }
}

// Simple function
export function simpleFunction() {
  return 'simple';
}
`;

      builder.addFile({
        path: '/test/complex.ts',
        size: content.length,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'complex-hash'
      }, content);

      const graph = builder.build();
      const file = graph.files.find(f => f.path === '/test/complex.ts');

      expect(file).toBeDefined();
      expect(file!.metrics.lines.code).toBeGreaterThan(0);
      expect(file!.metrics.lines.comment).toBeGreaterThanOrEqual(0);
      expect(file!.metrics.complexity.cyclomatic).toBeGreaterThan(1);
      expect(file!.metrics.structure.classes).toBe(1);
      expect(file!.metrics.structure.functions).toBe(2);
      expect(file!.metrics.structure.imports).toBe(1);
      expect(file!.metrics.structure.exports).toBe(2);
    });

    it('should analyze language information', () => {
      builder.addFile({
        path: '/test/typescript.ts',
        size: 100,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'ts-hash'
      }, 'export const test: string = "typescript";');

      const graph = builder.build();
      const file = graph.files.find(f => f.path === '/test/typescript.ts');

      expect(file).toBeDefined();
      expect(file!.languageInfo.language).toBe('typescript');
      expect(file!.languageInfo.version).toBe('5.0');
      expect(file!.languageInfo.features).toContain('generics');
      expect(file!.languageInfo.parser).toBe('typescript-parser');
    });

    it('should calculate quality metrics', () => {
      builder.addFile({
        path: '/test/quality.ts',
        size: 200,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'quality-hash'
      }, `
// Well-documented function
/**
 * Calculates the factorial of a number
 * @param n The number to calculate factorial for
 * @returns The factorial result
 */
export function factorial(n: number): number {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}`);

      const graph = builder.build();
      const file = graph.files.find(f => f.path === '/test/quality.ts');

      expect(file).toBeDefined();
      expect(file!.quality.maintainability).toBeGreaterThan(0);
      expect(file!.quality.readability).toBeGreaterThan(0);
      expect(file!.quality.duplication.percentage).toBeGreaterThanOrEqual(0);
      expect(file!.quality.technicalDebt.time).toBeGreaterThanOrEqual(0);
      expect(file!.quality.documentation.coverage).toBeGreaterThan(0);
    });

    it('should analyze security metrics', () => {
      const contentWithSecurityIssues = `
import { exec } from 'child_process';

export function dangerousFunction(userInput: string) {
  // This is a security issue - command injection
  exec('ls ' + userInput);

  // Hardcoded password
  const password = 'secret123';

  return 'done';
}`;

      builder.addFile({
        path: '/test/security.ts',
        size: contentWithSecurityIssues.length,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'security-hash'
      }, contentWithSecurityIssues);

      const graph = builder.build();
      const file = graph.files.find(f => f.path === '/test/security.ts');

      expect(file).toBeDefined();
      expect(file!.security.score).toBeGreaterThanOrEqual(0);
      expect(file!.security.score).toBeLessThanOrEqual(10);
      expect(file!.security.vulnerabilities.length).toBeGreaterThanOrEqual(0);
      expect(file!.security.issues.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Enhanced Dependencies', () => {
    it('should enhance dependencies with metadata', () => {
      builder.addFile({
        path: '/test/source.ts',
        size: 100,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'source-hash'
      }, 'import { external } from "external-lib";');

      builder.addFile({
        path: '/test/target.ts',
        size: 100,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'target-hash'
      }, 'export const external = "value";');

      // Add external dependency
      builder.addDependency({
        from: '/test/source.ts',
        to: 'external-lib',
        type: 'import' as any,
        strength: 'medium' as any
      });

      // Add internal dependency
      builder.addDependency({
        from: '/test/source.ts',
        to: '/test/target.ts',
        type: 'import' as any,
        strength: 'medium' as any
      });

      const graph = builder.build();
      const externalDep = graph.dependencies.find(d => d.to === 'external-lib');
      const internalDep = graph.dependencies.find(d => d.to === '/test/target.ts');

      expect(externalDep).toBeDefined();
      expect(externalDep!.isExternal).toBe(true);
      expect(externalDep!.isBuiltin).toBe(false);
      expect(externalDep!.health.status).toBeDefined();
      expect(externalDep!.usage).toBeDefined();

      expect(internalDep).toBeDefined();
      expect(internalDep!.isExternal).toBe(false);
      expect(internalDep!.health.confidence).toBeGreaterThan(0);
    });

    it('should detect test and dev dependencies', () => {
      builder.addFile({
        path: '/test/test.spec.ts',
        size: 100,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'test-spec-hash'
      }, 'import { expect } from "jest";');

      builder.addDependency({
        from: '/test/test.spec.ts',
        to: 'jest',
        type: 'import' as any,
        strength: 'medium' as any
      });

      const graph = builder.build();
      const jestDep = graph.dependencies.find(d => d.to === 'jest');

      expect(jestDep).toBeDefined();
      expect(jestDep!.isTest).toBe(true);
    });
  });

  describe('Graph Analytics', () => {
    it('should provide comprehensive analytics', () => {
      // Create a more complex graph
      for (let i = 0; i < 5; i++) {
        builder.addFile({
          path: `/test/file${i}.ts`,
          size: 200 + i * 50,
          language: 'typescript',
          lastModified: Date.now() + i * 1000,
          hash: `hash${i}`
        }, `
export function func${i}() {
  let result = 0;
  for (let j = 0; j < ${i + 1}; j++) {
    result += j;
  }
  return result;
}
`);

        // Add dependencies to create a network
        if (i > 0) {
          builder.addDependency({
            from: `/test/file${i}.ts`,
            to: `/test/file${i - 1}.ts`,
            type: 'import' as any,
            strength: 'medium' as any
          });
        }
      }

      const graph = builder.build();

      // Check analytics
      expect(graph.analytics.complexity).toBeGreaterThan(0);
      expect(graph.analytics.maintainabilityIndex).toBeGreaterThan(0);
      expect(graph.analytics.technicalDebt).toBeGreaterThanOrEqual(0);
      expect(graph.analytics.metrics.totalDependencies).toBe(4);

      // Check advanced complexity
      expect(graph.analytics.advancedComplexity).toBeDefined();
      expect(graph.analytics.advancedComplexity.distribution).toBeDefined();
      expect(graph.analytics.advancedComplexity.methods).toBeDefined();

      // Check coupling analysis
      expect(graph.analytics.coupling).toBeDefined();
      expect(graph.analytics.coupling.afferent).toBeGreaterThanOrEqual(0);
      expect(graph.analytics.coupling.instability).toBeGreaterThanOrEqual(0);

      // Check architecture metrics
      expect(graph.analytics.architecture).toBeDefined();
      expect(graph.analytics.architecture.modularity).toBeDefined();

      // Check technical debt analysis
      expect(graph.analytics.debt).toBeDefined();
      expect(graph.analytics.debt.total).toBeDefined();

      // Check trends
      expect(graph.analytics.trends).toBeDefined();
      expect(graph.analytics.trends.growth).toBeDefined();
    });
  });

  describe('Graph Structure Analysis', () => {
    it('should analyze graph structure', () => {
      // Create a simple graph structure
      builder.addFile({
        path: '/test/root.ts',
        size: 100,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'root-hash'
      }, 'export const root = true;');

      builder.addFile({
        path: '/test/leaf1.ts',
        size: 50,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'leaf1-hash'
      }, 'import { root } from "./root";');

      builder.addFile({
        path: '/test/leaf2.ts',
        size: 50,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'leaf2-hash'
      }, 'import { root } from "./root";');

      builder.addDependency({
        from: '/test/leaf1.ts',
        to: '/test/root.ts',
        type: 'import' as any,
        strength: 'medium' as any
      });

      builder.addDependency({
        from: '/test/leaf2.ts',
        to: '/test/root.ts',
        type: 'import' as any,
        strength: 'medium' as any
      });

      const graph = builder.build();

      // Check structure metrics
      expect(graph.structure.nodes).toBe(3);
      expect(graph.structure.edges).toBe(2);
      expect(graph.structure.density).toBeGreaterThan(0);

      // Check connectivity
      expect(graph.structure.connectivity).toBeDefined();
      expect(graph.structure.connectivity.components).toBe(1);

      // Check centrality
      expect(graph.structure.centrality).toBeDefined();
      expect(graph.structure.centrality.degree).toBeDefined();

      // Check paths
      expect(graph.structure.paths).toBeDefined();
      expect(graph.structure.paths.distances).toBeDefined();
    });
  });

  describe('Quality and Security Metrics', () => {
    it('should calculate project quality metrics', () => {
      builder.addFile({
        path: '/test/high-quality.ts',
        size: 200,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'high-quality-hash'
      }, `
/**
 * High quality, well-documented function
 * @param input The input parameter
 * @returns The processed result
 */
export function highQualityFunction(input: string): string {
  if (!input) {
    throw new Error('Input cannot be empty');
  }
  return input.trim().toUpperCase();
}`);

      const graph = builder.build();

      expect(graph.quality).toBeDefined();
      expect(graph.quality.score).toBeGreaterThan(0);
      expect(graph.quality.dimensions).toBeDefined();
      expect(graph.quality.dimensions.maintainability).toBeDefined();
      expect(graph.quality.dimensions.reliability).toBeDefined();
      expect(graph.quality.dimensions.security).toBeDefined();
      expect(graph.quality.dimensions.performance).toBeDefined();
      expect(graph.quality.dimensions.usability).toBeDefined();
      expect(graph.quality.issues).toBeDefined();
      expect(graph.quality.benchmarks).toBeDefined();
    });

    it('should calculate project security metrics', () => {
      builder.addFile({
        path: '/test/secure.ts',
        size: 150,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'secure-hash'
      }, `
import * as crypto from 'crypto';

export function secureHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}`);

      const graph = builder.build();

      expect(graph.security).toBeDefined();
      expect(graph.security.score).toBeGreaterThanOrEqual(0);
      expect(graph.security.dimensions).toBeDefined();
      expect(graph.security.issues).toBeDefined();
      expect(graph.security.compliance).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate performance metrics', () => {
      // Add multiple files to create a reasonable performance load
      for (let i = 0; i < 10; i++) {
        builder.addFile({
          path: `/test/perf${i}.ts`,
          size: 500,
          language: 'typescript',
          lastModified: Date.now() + i * 100,
          hash: `perf${i}-hash`
        }, `
export function performanceFunction${i}() {
  const data = new Array(1000).fill(0).map((_, index) => index);
  return data.reduce((sum, val) => sum + val, 0);
}
`);

        if (i > 0) {
          builder.addDependency({
            from: `/test/perf${i}.ts`,
            to: `/test/perf${i - 1}.ts`,
            type: 'import' as any,
            strength: 'medium' as any
          });
        }
      }

      const graph = builder.build();

      expect(graph.performance).toBeDefined();
      expect(graph.performance.build).toBeDefined();
      expect(graph.performance.runtime).toBeDefined();
      expect(graph.performance.memory).toBeDefined();
      expect(graph.performance.io).toBeDefined();

      // Check build performance
      expect(graph.performance.build.duration).toBeGreaterThan(0);
      expect(graph.performance.build.filesAnalyzed).toBe(10);
      expect(graph.performance.build.dependenciesResolved).toBe(9);

      // Check memory usage
      expect(graph.performance.memory.peak).toBeGreaterThan(0);
      expect(graph.performance.memory.average).toBeGreaterThan(0);
    });
  });

  describe('Graph Validation', () => {
    it('should validate graph structure', () => {
      builder.addFile({
        path: '/test/valid.ts',
        size: 100,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'valid-hash'
      }, 'export const valid = true;');

      builder.addDependency({
        from: '/test/valid.ts',
        to: '/test/valid.ts', // Self-reference
        type: 'import' as any,
        strength: 'medium' as any
      });

      const validation = builder.validate();

      expect(validation.valid).toBeDefined();
      expect(validation.errors).toBeDefined();
      expect(validation.warnings).toBeDefined();
    });

    it('should detect orphaned files', () => {
      builder.addFile({
        path: '/test/orphaned.ts',
        size: 100,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'orphaned-hash'
      }, 'export const orphaned = true;');

      const validation = builder.validate();

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some(w => w.includes('orphaned'))).toBe(true);
    });
  });

  describe('Test File Detection', () => {
    it('should identify test files and calculate coverage', () => {
      builder.addFile({
        path: '/test/unit.test.ts',
        size: 200,
        language: 'typescript',
        lastModified: Date.now(),
        hash: 'test-coverage-hash'
      }, `
import { expect, test } from 'vitest';
import { functionToTest } from './source';

test('should work correctly', () => {
  expect(functionToTest()).toBe(true);
});

test('should handle edge cases', () => {
  expect(functionToTest(null)).toBe(false);
});

describe('edge cases', () => {
  test('should work with empty input', () => {
    expect(functionToTest('')).toBe(false);
  });
});

function helperFunction() {
  return 'helper';
}
`);

      const graph = builder.build();
      const testFile = graph.files.find(f => f.path === '/test/unit.test.ts');

      expect(testFile).toBeDefined();
      expect(testFile!.testCoverage).toBeDefined();
      expect(testFile!.testCoverage!.functions.coverage).toBeGreaterThan(0);
      expect(testFile!.testCoverage!.lines.coverage).toBeGreaterThan(0);
      expect(testFile!.testCoverage!.functions.covered).toBe(3); // test + describe + helperFunction
    });
  });

  describe('Comprehensive Integration', () => {
    it('should handle a realistic project structure', () => {
      // Simulate a small project with multiple files and relationships
      const files = [
        {
          path: '/src/index.ts',
          content: `
import { UserService } from './services/UserService';
import { DatabaseService } from './services/DatabaseService';

export class Application {
  private userService: UserService;
  private dbService: DatabaseService;

  constructor() {
    this.userService = new UserService();
    this.dbService = new DatabaseService();
  }

  async run() {
    await this.dbService.connect();
    return this.userService.getUserCount();
  }
}
`,
          size: 300
        },
        {
          path: '/src/services/UserService.ts',
          content: `
import { User } from '../types/User';
import { DatabaseService } from './DatabaseService';

export class UserService {
  constructor(private db: DatabaseService) {}

  async getUserCount(): Promise<number> {
    const users = await this.db.query('SELECT COUNT(*) FROM users');
    return users[0].count;
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const user = { ...userData, id: Date.now() } as User;
    await this.db.insert('users', user);
    return user;
  }
}
`,
          size: 400
        },
        {
          path: '/src/services/DatabaseService.ts',
          content: `
export interface QueryResult {
  rows: any[];
  count: number;
}

export class DatabaseService {
  private connection: any = null;

  async connect(): Promise<void> {
    // Simulate database connection
    this.connection = { connected: true };
  }

  async query(sql: string): Promise<any[]> {
    if (!this.connection) {
      throw new Error('Database not connected');
    }
    // Simulate query execution
    return [{ count: 100 }];
  }

  async insert(table: string, data: any): Promise<void> {
    if (!this.connection) {
      throw new Error('Database not connected');
    }
    // Simulate insert operation
  }

  async disconnect(): Promise<void> {
    this.connection = null;
  }
}
`,
          size: 500
        },
        {
          path: '/src/types/User.ts',
          content: `
export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'user' | 'guest';

export interface CreateUserRequest {
  name: string;
  email: string;
  role?: UserRole;
}
`,
          size: 200
        },
        {
          path: '/src/utils/validation.ts',
          content: `
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

export function validateName(name: string): boolean {
  return name.length >= 2 && name.length <= 50;
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /\\d/.test(password) && /[A-Z]/.test(password);
}
`,
          size: 300
        },
        {
          path: '/tests/services/UserService.test.ts',
          content: `
import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from '../../src/services/UserService';
import { DatabaseService } from '../../src/services/DatabaseService';

describe('UserService', () => {
  let userService: UserService;
  let mockDb: DatabaseService;

  beforeEach(() => {
    mockDb = new DatabaseService();
    userService = new UserService(mockDb);
  });

  it('should get user count', async () => {
    const count = await userService.getUserCount();
    expect(count).toBe(100);
  });

  it('should create a new user', async () => {
    const userData = { name: 'Test User', email: 'test@example.com' };
    const user = await userService.createUser(userData);
    expect(user.id).toBeDefined();
    expect(user.name).toBe(userData.name);
    expect(user.email).toBe(userData.email);
  });
});
`,
          size: 400
        }
      ];

      // Add all files
      files.forEach(file => {
        builder.addFile({
          path: file.path,
          size: file.size,
          language: 'typescript',
          lastModified: Date.now(),
          hash: `hash-${file.path.replace(/[^a-zA-Z0-9]/g, '')}`
        }, file.content);
      });

      // Add dependencies
      const dependencies = [
        { from: '/src/index.ts', to: '/src/services/UserService.ts' },
        { from: '/src/index.ts', to: '/src/services/DatabaseService.ts' },
        { from: '/src/services/UserService.ts', to: '/src/types/User.ts' },
        { from: '/src/services/UserService.ts', to: '/src/services/DatabaseService.ts' },
        { from: '/tests/services/UserService.test.ts', to: '/src/services/UserService.ts' },
        { from: '/tests/services/UserService.test.ts', to: '/src/services/DatabaseService.ts' },
        { from: '/src/services/UserService.ts', to: 'src/utils/validation.ts' } // External import
      ];

      dependencies.forEach(dep => {
        builder.addDependency({
          from: dep.from,
          to: dep.to,
          type: 'import' as any,
          strength: 'medium' as any
        });
      });

      const graph = builder.build();

      // Verify graph structure
      expect(graph.files).toHaveLength(6);
      expect(graph.dependencies).toHaveLength(7);
      expect(graph.metadata.languages).toContain('typescript');

      // Verify enhanced file metrics
      const userServiceFile = graph.files.find(f => f.path === '/src/services/UserService.ts');
      expect(userServiceFile).toBeDefined();
      expect(userServiceFile!.metrics.structure.classes).toBe(1);
      expect(userServiceFile!.metrics.structure.functions).toBe(2);
      expect(userServiceFile!.quality.maintainability).toBeGreaterThan(0);

      // Verify test file detection
      const testFile = graph.files.find(f => f.path === '/tests/services/UserService.test.ts');
      expect(testFile).toBeDefined();
      expect(testFile!.testCoverage).toBeDefined();
      expect(testFile!.testCoverage!.functions.covered).toBeGreaterThan(0);

      // Verify dependency enhancement
      const externalDep = graph.dependencies.find(d => d.to === 'src/utils/validation.ts');
      expect(externalDep).toBeDefined();
      expect(externalDep!.isExternal).toBe(true);

      // Verify analytics
      expect(graph.analytics.complexity).toBeGreaterThan(0);
      expect(graph.analytics.modules).toHaveLength(6);
      expect(graph.analytics.metrics.totalDependencies).toBe(7);

      // Verify quality metrics
      expect(graph.quality.score).toBeGreaterThan(0);
      expect(graph.quality.dimensions.maintainability.score).toBeGreaterThan(0);

      // Verify validation
      const validation = builder.validate();
      expect(validation.errors).toHaveLength(0);
    });
  });
});