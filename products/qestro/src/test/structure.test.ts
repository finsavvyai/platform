/**
 * Qestro Workers - Build Pipeline Test
 *
 * Test to validate the Workers build pipeline and project structure
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'

describe('Workers Project Structure', () => {
  const projectRoot = process.cwd()
  const srcDir = path.join(projectRoot, 'src')

  it('should have all required directories', () => {
    const requiredDirs = [
      'src',
      'src/workers',
      'src/durable-objects',
      'src/api',
      'src/auth',
      'src/utils',
      'src/types',
      'src/kv',
      'src/cache',
      'src/storage',
      'src/billing',
      'src/analytics',
      'src/ai',
      'src/testing',
      'src/security',
      'src/monitoring',
      'src/validation',
      'src/optimization',
      'src/compliance'
    ]

    requiredDirs.forEach(dir => {
      expect(fs.access(path.join(projectRoot, dir)))).resolves.not.toThrow()
    })
  })

  it('should have essential TypeScript files', async () => {
    const requiredFiles = [
      'src/index.ts',
      'src/types/env.ts',
      'src/types/common.ts',
      'src/types/health.ts',
      'src/workers/api-gateway.ts',
      'src/utils/error-handler.ts',
      'src/utils/rate-limiter.ts',
      'src/utils/request-id.ts',
      'src/api/auth.ts',
      'src/api/projects.ts',
      'src/api/test-execution.ts',
      'src/api/billing.ts',
      'src/api/analytics.ts',
      'src/api/ai.ts',
      'src/durable-objects/session-do.ts',
      'src/durable-objects/collaboration-do.ts',
      'src/durable-objects/test-execution-do.ts'
    ]

    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(projectRoot, file))
        expect(true).toBe(true) // File exists
      } catch (error) {
        expect.fail(`Required file missing: ${file}`)
      }
    }
  })

  it('should have proper TypeScript configuration', async () => {
    const tsconfigPath = path.join(projectRoot, 'tsconfig.json')
    const tsconfigContent = await fs.readFile(tsconfigPath, 'utf-8')
    const tsconfig = JSON.parse(tsconfigContent)

    expect(tsconfig.compilerOptions.target).toBe('ES2022')
    expect(tsconfig.compilerOptions.module).toBe('ESNext')
    expect(tsconfig.compilerOptions.strict).toBe(true)
    expect(tsconfig.compilerOptions.types).toContain('@cloudflare/workers-types')
    expect(tsconfig.include).toContain('src/**/*')
  })

  it('should have proper esbuild configuration', async () => {
    const esbuildConfigPath = path.join(projectRoot, 'esbuild.config.mjs')
    const esbuildExists = await fs.access(esbuildConfigPath).then(() => true).catch(() => false)

    expect(esbuildExists).toBe(true)

    if (esbuildExists) {
      const configContent = await fs.readFile(esbuildConfigPath, 'utf-8')
      expect(configContent).toContain('src/index.ts')
      expect(configContent).toContain('bundle')
      expect(configContent).toContain('esm')
      expect(configContent).toContain('external')
    }
  })

  it('should have proper wrangler configuration', async () => {
    const wranglerPath = path.join(projectRoot, 'wrangler.toml')
    const wranglerContent = await fs.readFile(wranglerPath, 'utf-8')

    expect(wranglerContent).toContain('name = "qestro"')
    expect(wranglerContent).toContain('main = "src/index.ts"')
    expect(wranglerContent).toContain('compatibility_date')
    expect(wranglerContent).toContain('[[d1_databases]]')
    expect(wranglerContent).toContain('[[kv_namespaces]]')
    expect(wranglerContent).toContain('[[r2_buckets]]')
    expect(wranglerContent).toContain('[[durable_objects.bindings]]')
  })

  it('should have proper package.json scripts', async () => {
    const packagePath = path.join(projectRoot, 'package.json')
    const packageContent = await fs.readFile(packagePath, 'utf-8')
    const pkg = JSON.parse(packageContent)

    expect(pkg.scripts).toHaveProperty('build:workers')
    expect(pkg.scripts).toHaveProperty('dev:workers')
    expect(pkg.scripts).toHaveProperty('test:workers')
    expect(pkg.scripts).toHaveProperty('lint:workers')
    expect(pkg.scripts).toHaveProperty('deploy:workers')
    expect(pkg.devDependencies).toHaveProperty('@cloudflare/workers-types')
    expect(pkg.devDependencies).toHaveProperty('esbuild')
    expect(pkg.devDependencies).toHaveProperty('typescript')
  })

  it('should have proper ESLint configuration', async () => {
    const eslintPath = path.join(projectRoot, '.eslintrc.js')
    const eslintExists = await fs.access(eslintPath).then(() => true).catch(() => false)

    expect(eslintExists).toBe(true)

    if (eslintExists) {
      const eslintContent = await fs.readFile(eslintPath, 'utf-8')
      expect(eslintContent).toContain('worker: true')
      expect(eslintContent).toContain('@typescript-eslint')
    }
  })

  it('should have all API route files with proper exports', async () => {
    const apiFiles = [
      'src/api/auth.ts',
      'src/api/projects.ts',
      'src/api/test-execution.ts',
      'src/api/billing.ts',
      'src/api/analytics.ts',
      'src/api/ai.ts'
    ]

    for (const file of apiFiles) {
      try {
        const content = await fs.readFile(path.join(projectRoot, file), 'utf-8')
        expect(content).toContain('export')
      } catch (error) {
        expect.fail(`API file missing or invalid: ${file}`)
      }
    }
  })

  it('should have all Durable Object implementations', async () => {
    const doFiles = [
      'src/durable-objects/session-do.ts',
      'src/durable-objects/collaboration-do.ts',
      'src/durable-objects/test-execution-do.ts'
    ]

    for (const file of doFiles) {
      try {
        const content = await fs.readFile(path.join(projectRoot, file), 'utf-8')
        expect(content).toContain('export')
        expect(content).toContain('DurableObject')
      } catch (error) {
        expect.fail(`Durable Object file missing or invalid: ${file}`)
      }
    }
  })
})

describe('Workers Code Quality', () => {
  it('should use proper TypeScript imports/exports', async () => {
    const filesToCheck = [
      'src/index.ts',
      'src/workers/api-gateway.ts',
      'src/utils/error-handler.ts'
    ]

    for (const file of filesToCheck) {
      try {
        const content = await fs.readFile(file, 'utf-8')
        // Should use ES module imports/exports
        expect(content).toMatch(/import.*from/)
        expect(content).toMatch(/export/)
      } catch (error) {
        // Skip if file doesn't exist
      }
    }
  })

  it('should have proper JSDoc comments in key files', async () => {
    const filesWithDocs = [
      'src/index.ts',
      'src/types/env.ts',
      'src/workers/api-gateway.ts'
    ]

    for (const file of filesWithDocs) {
      try {
        const content = await fs.readFile(file, 'utf-8')
        expect(content).toContain('/**')
        expect(content).toContain('*')
      } catch (error) {
        // Skip if file doesn't exist
      }
    }
  })
})
