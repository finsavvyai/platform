import { describe, it, expect } from 'vitest'
import { assessFileRisk } from './risk-classifier'

describe('assessFileRisk', () => {
  describe('CRITICAL paths', () => {
    it('flags .env file', () => {
      expect(assessFileRisk('/project/.env')).toBe('critical')
    })
    it('flags .env.local', () => {
      expect(assessFileRisk('/project/.env.local')).toBe('critical')
    })
    it('flags AWS credentials', () => {
      expect(assessFileRisk('/home/user/.aws/credentials')).toBe('critical')
    })
    it('flags id_rsa SSH key', () => {
      expect(assessFileRisk('/home/user/.ssh/id_rsa')).toBe('critical')
    })
    it('flags id_ed25519 SSH key', () => {
      expect(assessFileRisk('/home/user/.ssh/id_ed25519')).toBe('critical')
    })
    it('flags .pem certificate', () => {
      expect(assessFileRisk('/certs/server.pem')).toBe('critical')
    })
    it('flags .p12 keystore', () => {
      expect(assessFileRisk('/keys/client.p12')).toBe('critical')
    })
    it('flags secrets.yaml', () => {
      expect(assessFileRisk('/config/secrets.yaml')).toBe('critical')
    })
    it('flags credentials.yml', () => {
      expect(assessFileRisk('/app/credentials.yml')).toBe('critical')
    })
    it('flags Windows path .env', () => {
      expect(assessFileRisk('C:\\project\\.env')).toBe('critical')
    })
  })

  describe('HIGH paths', () => {
    // .env.production / .env.staging match the critical pattern (they contain .env.) — correct
    it('flags .env.production as critical (contains production secrets)', () => {
      expect(assessFileRisk('/project/.env.production')).toBe('critical')
    })
    it('flags .env.staging as critical (staging secrets are still secrets)', () => {
      expect(assessFileRisk('/project/.env.staging')).toBe('critical')
    })
    it('flags .npmrc', () => {
      expect(assessFileRisk('/home/user/.npmrc')).toBe('high')
    })
    it('flags .netrc', () => {
      expect(assessFileRisk('/home/user/.netrc')).toBe('high')
    })
    it('flags config.json', () => {
      expect(assessFileRisk('/app/config.json')).toBe('high')
    })
    it('flags settings.yaml', () => {
      expect(assessFileRisk('/app/settings.yaml')).toBe('high')
    })
    it('flags terraform.tfvars', () => {
      expect(assessFileRisk('/infra/terraform.tfvars')).toBe('high')
    })
    it('flags kubeconfig', () => {
      expect(assessFileRisk('/home/user/.kube/kubeconfig')).toBe('high')
    })
  })

  describe('MEDIUM paths', () => {
    it('flags package.json', () => {
      expect(assessFileRisk('/project/package.json')).toBe('medium')
    })
    it('flags requirements.txt', () => {
      expect(assessFileRisk('/project/requirements.txt')).toBe('medium')
    })
    it('flags go.mod', () => {
      expect(assessFileRisk('/project/go.mod')).toBe('medium')
    })
    it('flags docker-compose.yml', () => {
      expect(assessFileRisk('/project/docker-compose.yml')).toBe('medium')
    })
    it('flags Dockerfile', () => {
      expect(assessFileRisk('/project/Dockerfile')).toBe('medium')
    })
    it('flags .tf Terraform file', () => {
      expect(assessFileRisk('/infra/main.tf')).toBe('medium')
    })
  })

  describe('LOW paths (noise suppressed)', () => {
    it('returns low for .ts source file', () => {
      expect(assessFileRisk('/project/src/index.ts')).toBe('low')
    })
    it('returns low for .tsx component', () => {
      expect(assessFileRisk('/project/src/App.tsx')).toBe('low')
    })
    it('returns low for README.md', () => {
      expect(assessFileRisk('/project/README.md')).toBe('low')
    })
    it('returns low for .json inside dist', () => {
      expect(assessFileRisk('/project/dist/bundle.json')).toBe('low')
    })
  })
})
