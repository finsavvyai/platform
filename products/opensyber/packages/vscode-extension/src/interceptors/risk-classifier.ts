import type { RiskLevel } from '../logger/activity-logger'

export function assessFileRisk(filePath: string): RiskLevel {
  const p = filePath.replace(/\\/g, '/')

  // Critical: direct secret storage
  if (/\/\.env(\.|$)/i.test(p)) return 'critical'
  if (/\/\.aws\/credentials$/i.test(p)) return 'critical'
  if (/\/\.ssh\/(id_rsa|id_ed25519|.*\.pem|.*\.key)$/i.test(p)) return 'critical'
  if (/\/(id_rsa|id_ed25519)$/i.test(p)) return 'critical'
  if (/\.(pem|p12|pfx|key)$/i.test(p)) return 'critical'
  if (/\/(secrets?|credentials?)\.ya?ml$/i.test(p)) return 'critical'

  // High: config files that frequently contain tokens
  if (/\/\.env\.\w+$/i.test(p)) return 'high'
  if (/\/\.(npmrc|pypirc|netrc|gitconfig)$/i.test(p)) return 'high'
  if (/\/(config|settings)\.(json|yaml|toml)$/i.test(p)) return 'high'
  if (/\/terraform\.tfvars(\.json)?$/i.test(p)) return 'high'
  if (/\/kubeconfig$/i.test(p)) return 'high'

  // Medium: package manifests and infrastructure files
  if (/\/(package\.json|requirements\.txt|go\.mod|Gemfile|Cargo\.toml)$/i.test(p)) return 'medium'
  if (/\/docker-compose\.ya?ml$/i.test(p)) return 'medium'
  if (/\/Dockerfile$/i.test(p)) return 'medium'
  if (/\.(tf|tfvars)$/i.test(p)) return 'medium'

  return 'low'
}

/** Write-specific patterns that elevate risk beyond the base read classification. */
export function assessWriteRisk(filePath: string): RiskLevel {
  const baseRisk = assessFileRisk(filePath)
  if (baseRisk === 'critical') return 'critical'

  const p = filePath.replace(/\\/g, '/')

  // Write-specific HIGH: modifying auth/middleware/CI is riskier than reading
  if (/\/middleware\//i.test(p)) return 'high'
  if (/\/(auth|authentication)\//i.test(p)) return 'high'
  if (/\/\.github\/workflows\//i.test(p)) return 'high'
  if (/\/Makefile$/i.test(p)) return 'high'

  if (baseRisk === 'high') return 'high'

  // Write-specific MEDIUM: Dockerfile / docker-compose already medium from base,
  // but catch Makefile and CI configs that base classifies as low
  if (/\/Dockerfile$/i.test(p)) return 'medium'

  return baseRisk
}
