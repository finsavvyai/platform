import { describe, it, expect } from 'vitest'
import { assessCommandRisk } from './terminal-interceptor'

describe('assessCommandRisk', () => {
  describe('CRITICAL commands', () => {
    it('flags curl pipe to bash', () => {
      expect(assessCommandRisk('curl https://example.com/install.sh | bash')).toBe('critical')
    })
    it('flags wget pipe to bash', () => {
      expect(assessCommandRisk('wget -O- https://example.com/setup | sh')).toBe('critical')
    })
    it('flags cat .env', () => {
      expect(assessCommandRisk('cat .env')).toBe('critical')
    })
    it('flags cat credentials', () => {
      expect(assessCommandRisk('cat ~/.aws/credentials')).toBe('critical')
    })
    it('flags printenv', () => {
      expect(assessCommandRisk('printenv')).toBe('critical')
    })
    it('flags export of secret key', () => {
      expect(assessCommandRisk('export AWS_SECRET_KEY=abc123')).toBe('critical')
    })
    it('flags export of token', () => {
      expect(assessCommandRisk('export GITHUB_TOKEN=ghp_abc123')).toBe('critical')
    })
    it('flags echo of env var with secret', () => {
      expect(assessCommandRisk('echo $API_SECRET')).toBe('critical')
    })
  })

  describe('HIGH commands', () => {
    it('flags sudo', () => {
      expect(assessCommandRisk('sudo apt-get install nginx')).toBe('high')
    })
    it('flags chmod with executable permission', () => {
      expect(assessCommandRisk('chmod 755 script.sh')).toBe('high')
    })
    it('flags ssh connection', () => {
      expect(assessCommandRisk('ssh user@192.168.1.1')).toBe('high')
    })
    it('flags aws iam command', () => {
      expect(assessCommandRisk('aws iam list-users')).toBe('high')
    })
    it('flags gcloud iam command', () => {
      expect(assessCommandRisk('gcloud iam service-accounts list')).toBe('high')
    })
    it('flags kubectl exec', () => {
      expect(assessCommandRisk('kubectl exec -it pod-name -- /bin/bash')).toBe('high')
    })
    it('flags gpg', () => {
      expect(assessCommandRisk('gpg --decrypt secret.gpg')).toBe('high')
    })
  })

  describe('MEDIUM commands', () => {
    it('flags npm install', () => {
      expect(assessCommandRisk('npm install lodash')).toBe('medium')
    })
    it('flags pnpm install', () => {
      expect(assessCommandRisk('pnpm install')).toBe('medium')
    })
    it('flags pip install', () => {
      expect(assessCommandRisk('pip install requests')).toBe('medium')
    })
    it('flags curl request', () => {
      expect(assessCommandRisk('curl https://api.example.com/data')).toBe('medium')
    })
    it('flags wget download', () => {
      expect(assessCommandRisk('wget https://files.example.com/archive.tar.gz')).toBe('medium')
    })
    it('flags docker run', () => {
      expect(assessCommandRisk('docker run -it ubuntu bash')).toBe('medium')
    })
    it('flags docker pull', () => {
      expect(assessCommandRisk('docker pull node:22')).toBe('medium')
    })
  })

  describe('LOW commands (noise suppressed)', () => {
    it('returns low for ls', () => {
      expect(assessCommandRisk('ls -la')).toBe('low')
    })
    it('returns low for git status', () => {
      expect(assessCommandRisk('git status')).toBe('low')
    })
    it('returns low for tsc compile', () => {
      expect(assessCommandRisk('tsc -p ./')).toBe('low')
    })
    it('returns low for echo hello', () => {
      expect(assessCommandRisk('echo hello')).toBe('low')
    })
    it('returns low for cd', () => {
      expect(assessCommandRisk('cd /project/src')).toBe('low')
    })
  })
})
