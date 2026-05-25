import { describe, it, expect } from 'vitest'
import { SecretDetector } from './secret-detector'

// All patterns tested against MOCK secrets — never real credentials

describe('SecretDetector', () => {
  const detector = new SecretDetector()

  describe('countSecrets', () => {
    it('detects AWS access key pattern', () => {
      const content = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE'
      expect(detector.countSecrets(content)).toBeGreaterThan(0)
    })

    it('detects GitHub personal token pattern', () => {
      const content = 'GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz012345678'
      expect(detector.countSecrets(content)).toBeGreaterThan(0)
    })

    it('detects OpenAI key pattern', () => {
      const content = 'OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
      expect(detector.countSecrets(content)).toBeGreaterThan(0)
    })

    it('detects Stripe live key pattern', () => {
      const content = 'STRIPE_SECRET_KEY=sk_live_abcdefghijklmnopqrstuvwx'
      expect(detector.countSecrets(content)).toBeGreaterThan(0)
    })

    it('detects private key block', () => {
      const content = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...'
      expect(detector.countSecrets(content)).toBeGreaterThan(0)
    })

    it('detects Slack bot token', () => {
      const content = 'SLACK_TOKEN=xoxb-1234567890-abcdefghijklmno'
      expect(detector.countSecrets(content)).toBeGreaterThan(0)
    })

    it('detects Google API key pattern', () => {
      const content = 'GOOGLE_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567'
      expect(detector.countSecrets(content)).toBeGreaterThan(0)
    })

    it('detects generic PASSWORD= assignment', () => {
      const content = 'DB_PASSWORD=supersecretpassword123'
      expect(detector.countSecrets(content)).toBeGreaterThan(0)
    })

    it('returns 0 for clean code with no secrets', () => {
      const content = `
        const x = 1
        function hello() { return 'world' }
        // This is a comment
      `
      expect(detector.countSecrets(content)).toBe(0)
    })

    it('returns 0 for empty string', () => {
      expect(detector.countSecrets('')).toBe(0)
    })

    it('counts multiple secrets in one file', () => {
      const content = [
        'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
        'GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz012345678',
      ].join('\n')
      expect(detector.countSecrets(content)).toBeGreaterThanOrEqual(2)
    })
  })

  describe('scan — types reported, values never included', () => {
    it('reports the type of secret found, not the value', () => {
      const content = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE'
      const result = detector.scan(content)
      expect(result.types).toContain('aws_access_key')
      // Verify the actual key value is NOT in the result types
      expect(JSON.stringify(result.types)).not.toContain('AKIAIOSFODNN7EXAMPLE')
    })

    it('reports count correctly', () => {
      const content = 'AKIAIOSFODNN7EXAMPLE AKIAIOSFODNN7EXAMPLE2A'
      const result = detector.scan(content)
      expect(result.count).toBeGreaterThanOrEqual(1)
    })

    it('returns empty result for clean content', () => {
      const result = detector.scan('const x = 42')
      expect(result.count).toBe(0)
      expect(result.types).toHaveLength(0)
    })
  })
})
