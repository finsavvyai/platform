import { describe, it, expect, beforeEach } from 'vitest';
import { TypeScriptAnalyzer } from '../src/analyzers/TypeScriptAnalyzer';

describe('TypeScriptAnalyzer', () => {
    let analyzer: TypeScriptAnalyzer;

    beforeEach(() => {
        analyzer = new TypeScriptAnalyzer();
    });

    describe('Basic Analysis', () => {
        it('should analyze a simple class', async () => {
            const content = `
        export class UserService {
          constructor(private db: Database) {}
          async getUser(id: string) { return this.db.query(id); }
        }
      `;

            const result = await analyzer.analyzeFile({
                path: 'UserService.ts',
                content,
                lastModified: Date.now(),
                size: content.length,
                hash: 'test'
            });

            expect(result.success).toBe(true);
            expect(result.metrics.classCount).toBe(1);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect multiple classes', async () => {
            const content = `
        class Repository {}
        class Service {}
        class Controller {}
      `;

            const result = await analyzer.analyzeFile({
                path: 'multi.ts',
                content,
                lastModified: Date.now(),
                size: content.length,
                hash: 'test'
            });

            expect(result.success).toBe(true);
            expect(result.metrics.classCount).toBe(3);
        });

        it('should handle empty file', async () => {
            const result = await analyzer.analyzeFile({
                path: 'empty.ts',
                content: '',
                lastModified: Date.now(),
                size: 0,
                hash: 'test'
            });

            expect(result.success).toBe(true);
            expect(result.metrics.classCount).toBe(0);
            expect(result.metrics.functionCount).toBe(0);
        });
    });

    describe('Import Detection', () => {
        it('should detect ES6 imports', async () => {
            const content = `
        import React from 'react';
        import { useState, useEffect } from 'react';
        import * as utils from './utils';
      `;

            const result = await analyzer.analyzeFile({
                path: 'component.tsx',
                content,
                lastModified: Date.now(),
                size: content.length,
                hash: 'test'
            });

            expect(result.success).toBe(true);
        });

        it('should detect dynamic imports', async () => {
            const content = `
        async function loadModule() {
          const module = await import('./dynamicModule');
          return module;
        }
      `;

            const result = await analyzer.analyzeFile({
                path: 'dynamic.ts',
                content,
                lastModified: Date.now(),
                size: content.length,
                hash: 'test'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle files with syntax errors gracefully', async () => {
            const content = `
        class Broken {
          constructor( {
            // Missing closing paren and brace
        }
      `;

            const result = await analyzer.analyzeFile({
                path: 'broken.ts',
                content,
                lastModified: Date.now(),
                size: content.length,
                hash: 'test'
            });

            // Should not crash, may return partial results or errors
            expect(result).toBeDefined();
        });

        it('should handle very large files', async () => {
            const largeContent = `
        class Test {
          ${Array(1000).fill('method' + Math.random() + '() {}').join('\n')}
        }
      `;

            const result = await analyzer.analyzeFile({
                path: 'large.ts',
                content: largeContent,
                lastModified: Date.now(),
                size: largeContent.length,
                hash: 'test'
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });
    });

    describe('TypeScript Features', () => {
        it('should handle interfaces', async () => {
            const content = `
        interface User {
          id: string;
          name: string;
        }
        
        interface Admin extends User {
          permissions: string[];
        }
      `;

            const result = await analyzer.analyzeFile({
                path: 'types.ts',
                content,
                lastModified: Date.now(),
                size: content.length,
                hash: 'test'
            });

            expect(result.success).toBe(true);
        });

        it('should handle generics', async () => {
            const content = `
        class Repository<T> {
          items: T[] = [];
          add(item: T): void { this.items.push(item); }
          find(id: string): T | undefined { return this.items[0]; }
        }
      `;

            const result = await analyzer.analyzeFile({
                path: 'repository.ts',
                content,
                lastModified: Date.now(),
                size: content.length,
                hash: 'test'
            });

            expect(result.success).toBe(true);
            expect(result.metrics.classCount).toBe(1);
        });

        it('should handle decorators', async () => {
            const content = `
        @Injectable()
        class UserController {
          @Get('/users')
          getUsers() { return []; }
        }
      `;

            const result = await analyzer.analyzeFile({
                path: 'controller.ts',
                content,
                lastModified: Date.now(),
                size: content.length,
                hash: 'test'
            });

            expect(result.success).toBe(true);
            expect(result.metrics.classCount).toBe(1);
        });
    });

    describe('JavaScript Analysis', () => {
        it('should analyze plain JavaScript', async () => {
            const content = `
        function greet(name) {
          return 'Hello, ' + name;
        }
        
        class Person {
          constructor(name) {
            this.name = name;
          }
        }
      `;

            const result = await analyzer.analyzeFile({
                path: 'app.js',
                content,
                lastModified: Date.now(),
                size: content.length,
                hash: 'test'
            });

            expect(result.success).toBe(true);
            expect(result.metrics.classCount).toBe(1);
        });

        it('should handle JSX', async () => {
            const content = `
        import React from 'react';
        
        function App() {
          return <div>Hello World</div>;
        }
        
        export default App;
      `;

            const result = await analyzer.analyzeFile({
                path: 'App.jsx',
                content,
                lastModified: Date.now(),
                size: content.length,
                hash: 'test'
            });

            expect(result.success).toBe(true);
        });
    });
});
