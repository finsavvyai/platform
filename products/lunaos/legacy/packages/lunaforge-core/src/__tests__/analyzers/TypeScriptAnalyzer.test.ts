/**
 * Tests for TypeScriptAnalyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TypeScriptAnalyzer } from '../../analyzers/TypeScriptAnalyzer';
import type { FileContent, FileAnalysisResult } from '../../types';

describe('TypeScriptAnalyzer', () => {
  let analyzer: TypeScriptAnalyzer;

  beforeEach(() => {
    analyzer = new TypeScriptAnalyzer({
      includeDynamicImports: true,
      followTypeOnlyImports: true,
      resolveTransitiveDependencies: false
    });
  });

  describe('Language Support', () => {
    it('should support TypeScript extensions', () => {
      expect(analyzer.getSupportedExtensions()).toContain('.ts');
      expect(analyzer.getSupportedExtensions()).toContain('.tsx');
    });

    it('should support JavaScript extensions', () => {
      expect(analyzer.getSupportedExtensions()).toContain('.js');
      expect(analyzer.getSupportedExtensions()).toContain('.jsx');
      expect(analyzer.getSupportedExtensions()).toContain('.mjs');
      expect(analyzer.getSupportedExtensions()).toContain('.cjs');
    });

    it('should report correct language name', () => {
      expect(analyzer.getLanguageName()).toBe('typescript');
    });

    it('should analyze supported files', () => {
      expect(analyzer.canAnalyze('file.ts')).toBe(true);
      expect(analyzer.canAnalyze('file.tsx')).toBe(true);
      expect(analyzer.canAnalyze('file.js')).toBe(true);
      expect(analyzer.canAnalyze('component.jsx')).toBe(true);
    });

    it('should reject unsupported files', () => {
      expect(analyzer.canAnalyze('file.py')).toBe(false);
      expect(analyzer.canAnalyze('file.txt')).toBe(false);
      expect(analyzer.canAnalyze('file.json')).toBe(false);
    });
  });

  describe('Import Analysis', () => {
    it('should extract ES6 imports', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: `
          import { React, useState } from 'react';
          import express from 'express';
          import * as fs from 'fs';
          import { default as lodash } from 'lodash';
        `,
        lastModified: Date.now(),
        size: 150,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.dependencies).toHaveLength(4);

      const depPaths = result.dependencies.map(d => d.path);
      expect(depPaths).toContain('react');
      expect(depPaths).toContain('express');
      expect(depPaths).toContain('fs');
      expect(depPaths).toContain('lodash');
    });

    it('should extract CommonJS imports', async () => {
      const content: FileContent = {
        path: '/test/file.js',
        content: `
          const React = require('react');
          const { useState } = require('react');
          const fs = require('fs');
          const express = require('express');
        `,
        lastModified: Date.now(),
        size: 120,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.dependencies.length).toBeGreaterThan(0);

      const depPaths = result.dependencies.map(d => d.path);
      expect(depPaths).toContain('react');
      expect(depPaths).toContain('fs');
      expect(depPaths).toContain('express');
    });

    it('should handle relative imports', async () => {
      const content: FileContent = {
        path: '/test/src/component.ts',
        content: `
          import { helper } from './helper';
          import { utils } from '../utils/index';
          import { config } from '../../config';
        `,
        lastModified: Date.now(),
        size: 100,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.dependencies).toHaveLength(3);

      const relativeDeps = result.dependencies.filter(d => d.path.startsWith('.'));
      expect(relativeDeps).toHaveLength(3);
    });

    it('should extract dynamic imports', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: `
          const module = await import('./module');
          import('react').then(React => {
            const lazyModule = await import(\`./modules/\${name}\`);
          });
        `,
        lastModified: Date.now(),
        size: 120,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.dynamicImports).toHaveLength(2);
      expect(result.dynamicImports[0]).toContain('./module');
      expect(result.dynamicImports[1]).toContain('react');
    });

    it('should handle type-only imports', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: `
          import type { User, Product } from './types';
          import type React from 'react';
          import { type Component, type FC } from 'react';
        `,
        lastModified: Date.now(),
        size: 100,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.dependencies.length).toBeGreaterThan(0);

      // Should extract type-only imports when configured
      const typeDeps = result.dependencies.filter(d => d.isTypeOnly);
      expect(typeDeps.length).toBeGreaterThan(0);
    });
  });

  describe('Export Analysis', () => {
    it('should extract named exports', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: `
          export const API_URL = 'https://api.example.com';
          export function calculateTotal(items: Item[]) {
            return items.reduce((sum, item) => sum + item.price, 0);
          }
          export interface User {
            id: string;
            name: string;
          }
          export { helper, utility };
        `,
        lastModified: Date.now(),
        size: 200,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.exports).toContain('API_URL');
      expect(result.exports).toContain('calculateTotal');
      expect(result.exports).toContain('User');
      expect(result.exports).toContain('helper');
      expect(result.exports).toContain('utility');
    });

    it('should extract default exports', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: `
          export default class UserService {
            private users: User[] = [];

            addUser(user: User) {
              this.users.push(user);
            }
          }

          export default function createApp() {
            return new App();
          }
        `,
        lastModified: Date.now(),
        size: 150,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.hasDefaultExport).toBe(true);
    });

    it('should detect export all statements', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: `
          export * from './utils';
          export * as helpers from './helpers';
          export { default } from './config';
        `,
        lastModified: Date.now(),
        size: 80,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.reExports).toHaveLength(2);
      expect(result.reExports[0]).toBe('./utils');
      expect(result.reExports[1]).toBe('./helpers');
    });
  });

  describe('Class and Inheritance Analysis', () => {
    it('should extract class declarations', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: `
          export class UserService {
            private users: User[] = [];

            constructor() {}

            addUser(user: User) {
              this.users.push(user);
            }
          }

          class InternalHelper {
            static formatName(name: string): string {
              return name.trim();
            }
          }
        `,
        lastModified: Date.now(),
        size: 200,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.classes).toHaveLength(2);
      expect(result.classes).toContain('UserService');
      expect(result.classes).toContain('InternalHelper');
    });

    it('should detect inheritance relationships', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: `
          import { BaseService } from './base';

          export class UserService extends BaseService {
            constructor() {
              super();
            }
          }

          export class AdminService extends UserService {
            constructor() {
              super();
            }
          }
        `,
        lastModified: Date.now(),
        size: 150,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);

      // Check inheritance relationships
      const userServiceInheritance = result.inheritance.find(
        inh => inh.className === 'UserService'
      );
      expect(userServiceInheritance?.parentClass).toBe('BaseService');

      const adminServiceInheritance = result.inheritance.find(
        inh => inh.className === 'AdminService'
      );
      expect(adminServiceInheritance?.parentClass).toBe('UserService');
    });

    it('should handle interface implementation', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: `
          interface IUserService {
            getUser(id: string): User | null;
            saveUser(user: User): void;
          }

          export class UserService implements IUserService {
            getUser(id: string): User | null {
              return null;
            }

            saveUser(user: User): void {
              // Implementation
            }
          }
        `,
        lastModified: Date.now(),
        size: 180,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.classes).toContain('UserService');
    });
  });

  describe('Code Metrics', () => {
    it('should calculate function count', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: `
          export function calculateTotal(items: Item[]) {
            return items.reduce((sum, item) => sum + item.price, 0);
          }

          export function calculateTax(amount: number, rate: number): number {
            return amount * rate;
          }

          const helper = function() {
            return 'helper';
          };

          const arrow = () => {
            return 'arrow';
          };

          class UserService {
            constructor() {}

            private method() {
              return 'method';
            }
          }
        `,
        lastModified: Date.now(),
        size: 250,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.metrics.functionCount).toBe(6); // 2 functions + 1 function expression + 1 arrow function + 1 constructor + 1 method
    });

    it('should calculate class count', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: `
          export class UserService {}
          export class ProductService {}
          export class OrderService {}
          class InternalHelper {}
          export default class App {}
        `,
        lastModified: Date.now(),
        size: 120,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.metrics.classCount).toBe(5);
    });

    it('should calculate complexity estimate', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: `
          export function process(items: Item[]) {
            if (items.length === 0) {
              return 0;
            }

            let total = 0;
            for (const item of items) {
              if (item.price > 100) {
                total += item.price * 0.9;
              } else if (item.price > 50) {
                total += item.price * 0.95;
              } else {
                total += item.price;
              }
            }

            return total;
          }
        `,
        lastModified: Date.now(),
        size: 200,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.metrics.complexity).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle syntax errors gracefully', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: `
          // Malformed TypeScript
          import { } from './missing';
          export class {
        `,
        lastModified: Date.now(),
        size: 50,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      // Should still return a result but indicate failure
      expect(result.success).toBe(false);
      expect(result.dependencies).toHaveLength(0);
      expect(result.exports).toHaveLength(0);
    });

    it('should handle empty files', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: '',
        lastModified: Date.now(),
        size: 0,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.dependencies).toHaveLength(0);
      expect(result.exports).toHaveLength(0);
    });

    it('should handle files with only comments', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: `
          /**
           * This is a comment
           * Multi-line comment
           */

          // Single line comment
          /* Another comment */
        `,
        lastModified: Date.now(),
        size: 80,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.dependencies).toHaveLength(0);
      expect(result.exports).toHaveLength(0);
    });
  });

  describe('TSConfig Support', () => {
    it('should accept custom tsconfig', () => {
      const customConfig = {
        compilerOptions: {
          module: 'ESNext',
          target: 'ES2020',
          strict: true
        }
      };

      const customAnalyzer = new TypeScriptAnalyzer({
        includeDynamicImports: true,
        tsConfig: customConfig
      });

      expect(customAnalyzer).toBeDefined();
    });
  });

  describe('Dependency Type Classification', () => {
    it('should classify dependencies correctly', async () => {
      const content: FileContent = {
        path: '/test/file.ts',
        content: `
          import React from 'react';              // External
          import { helper } from './helper';      // Local
          import fs from 'fs';                     // Node.js builtin
          import { config } from '@org/config';    // Scoped package
          import type { Types } from 'types';      // Type-only
        `,
        lastModified: Date.now(),
        size: 150,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);

      // Check that dependencies are extracted with correct metadata
      const externalDep = result.dependencies.find(d => d.path === 'react');
      expect(externalDep?.isExternal).toBe(true);

      const localDep = result.dependencies.find(d => d.path.includes('./helper'));
      expect(localDep?.isExternal).toBe(false);

      const builtinDep = result.dependencies.find(d => d.path === 'fs');
      expect(builtinDep?.isExternal).toBe(true); // Node modules are considered external

      const scopedDep = result.dependencies.find(d => d.path === '@org/config');
      expect(scopedDep?.isExternal).toBe(true);
    });
  });
});