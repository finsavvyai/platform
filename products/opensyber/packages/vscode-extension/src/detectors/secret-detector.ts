// Pattern-match ONLY — count occurrences, NEVER log actual values
// All patterns are tested against mock secrets in secret-detector.test.ts

interface SecretPattern {
  name: string
  regex: RegExp
}

const PATTERNS: SecretPattern[] = [
  { name: 'aws_access_key',    regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'github_token',      regex: /ghp_[a-zA-Z0-9]{36}/g },
  { name: 'github_oauth',      regex: /gho_[a-zA-Z0-9]{36}/g },
  { name: 'stripe_live',       regex: /sk_live_[a-zA-Z0-9]{24,}/g },
  { name: 'openai_key',        regex: /sk-[a-zA-Z0-9]{48}/g },
  { name: 'slack_token',       regex: /xox[baprs]-[0-9a-zA-Z\-]{10,}/g },
  { name: 'google_api_key',    regex: /AIza[0-9A-Za-z\-_]{35}/g },
  { name: 'private_key_block', regex: /-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----/g },
  { name: 'generic_secret',    regex: /[A-Z_]*(SECRET|KEY|TOKEN|PASSWORD|PWD)[A-Z_0-9]*\s*[=:]\s*["']?[^\s"']{12,}/gi },
]

export interface SecretScanResult {
  count: number
  types: string[]  // which pattern categories matched — no values
}

export class SecretDetector {
  scan(content: string): SecretScanResult {
    const types: string[] = []
    let count = 0

    for (const { name, regex } of PATTERNS) {
      // Reset lastIndex for global regexes between calls
      regex.lastIndex = 0
      const matches = content.match(regex)
      if (matches && matches.length > 0) {
        count += matches.length
        types.push(name)
      }
    }

    return { count, types }
  }

  countSecrets(content: string): number {
    return this.scan(content).count
  }
}
