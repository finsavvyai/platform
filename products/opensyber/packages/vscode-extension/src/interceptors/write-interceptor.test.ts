import { describe, it, expect } from 'vitest'
import { assessWriteRisk } from './risk-classifier'

describe('assessWriteRisk', () => {
  describe('CRITICAL paths (same as read)', () => {
    it('flags writing to .env file', () => {
      expect(assessWriteRisk('/project/.env')).toBe('critical')
    })
    it('flags writing to .env.local', () => {
      expect(assessWriteRisk('/project/.env.local')).toBe('critical')
    })
    it('flags writing to AWS credentials', () => {
      expect(assessWriteRisk('/home/user/.aws/credentials')).toBe('critical')
    })
    it('flags writing to SSH private key', () => {
      expect(assessWriteRisk('/home/user/.ssh/id_rsa')).toBe('critical')
    })
    it('flags writing to .pem certificate', () => {
      expect(assessWriteRisk('/certs/server.pem')).toBe('critical')
    })
    it('flags writing to secrets.yaml', () => {
      expect(assessWriteRisk('/config/secrets.yaml')).toBe('critical')
    })
  })

  describe('HIGH paths (write-specific elevations)', () => {
    it('flags writing to auth middleware', () => {
      expect(assessWriteRisk('/project/src/middleware/auth.ts')).toBe('high')
    })
    it('flags writing to middleware directory', () => {
      expect(assessWriteRisk('/project/src/middleware/rate-limit.ts')).toBe('high')
    })
    it('flags writing to auth directory', () => {
      expect(assessWriteRisk('/project/src/auth/login.ts')).toBe('high')
    })
    it('flags writing to authentication directory', () => {
      expect(assessWriteRisk('/project/src/authentication/provider.ts')).toBe('high')
    })
    it('flags writing to GitHub workflows', () => {
      expect(assessWriteRisk('/project/.github/workflows/ci.yml')).toBe('high')
    })
    it('flags writing to Makefile', () => {
      expect(assessWriteRisk('/project/Makefile')).toBe('high')
    })
    it('flags writing to .npmrc (base high)', () => {
      expect(assessWriteRisk('/home/user/.npmrc')).toBe('high')
    })
    it('flags writing to config.json (base high)', () => {
      expect(assessWriteRisk('/app/config.json')).toBe('high')
    })
    it('flags writing to terraform.tfvars (base high)', () => {
      expect(assessWriteRisk('/infra/terraform.tfvars')).toBe('high')
    })
  })

  describe('MEDIUM paths', () => {
    it('flags writing to Dockerfile', () => {
      expect(assessWriteRisk('/project/Dockerfile')).toBe('medium')
    })
    it('flags writing to docker-compose.yml', () => {
      expect(assessWriteRisk('/project/docker-compose.yml')).toBe('medium')
    })
    it('flags writing to package.json', () => {
      expect(assessWriteRisk('/project/package.json')).toBe('medium')
    })
    it('flags writing to requirements.txt', () => {
      expect(assessWriteRisk('/project/requirements.txt')).toBe('medium')
    })
    it('flags writing to .tf Terraform file', () => {
      expect(assessWriteRisk('/infra/main.tf')).toBe('medium')
    })
  })

  describe('LOW paths', () => {
    it('returns low for regular .ts source file', () => {
      expect(assessWriteRisk('/project/src/index.ts')).toBe('low')
    })
    it('returns low for .tsx component', () => {
      expect(assessWriteRisk('/project/src/App.tsx')).toBe('low')
    })
    it('returns low for README.md', () => {
      expect(assessWriteRisk('/project/README.md')).toBe('low')
    })
  })
})
