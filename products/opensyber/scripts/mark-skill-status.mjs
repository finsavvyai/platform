#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SKILLS_DIR = join(__dirname, '..', 'skills')

const STATUS = {
  'log-analyzer': 'live',
  'ruflo-aidefence': 'live',
  'ai-triage': 'ready',
  'ai-reasoning-engine': 'ready',
  'ai-remediation': 'ready',
  'ai-threat-intel': 'ready',
  'ai-compliance-writer': 'ready',
  'ai-incident-responder': 'ready',
  'github-integration': 'ready',
  'slack-notifier': 'ready',
  'credential-rotator': 'ready',
  'prompt-guard': 'ready',
  'voice-synthesis': 'ready',
  'pipeline-security-scanner': 'ready',
  'agent-behavior-profiler': 'coming-soon',
  'dependency-auditor': 'coming-soon',
  'mcp-auditor': 'coming-soon',
  'supply-chain-guard': 'coming-soon',
}

const NOTES = {
  live: 'Self-contained, runs immediately with no config.',
  ready: 'Implementation complete; requires environment configuration to activate.',
  'coming-soon': 'Manifest defined; handler not yet implemented. Marketplace listing hidden.',
}

const summary = { generatedAt: new Date().toISOString(), skills: [] }

for (const [slug, status] of Object.entries(STATUS)) {
  const manifestPath = join(SKILLS_DIR, slug, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  manifest.status = status
  manifest.statusNote = NOTES[status]
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  summary.skills.push({
    slug,
    name: manifest.name,
    status,
    requiredEnv: manifest.permissions?.env || [],
    note: NOTES[status],
  })
  console.log(`[${status.padEnd(11)}] ${slug}`)
}

summary.counts = {
  live: summary.skills.filter((s) => s.status === 'live').length,
  ready: summary.skills.filter((s) => s.status === 'ready').length,
  comingSoon: summary.skills.filter((s) => s.status === 'coming-soon').length,
}

writeFileSync(join(SKILLS_DIR, 'MARKETPLACE_STATUS.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(`\nWrote skills/MARKETPLACE_STATUS.json`)
console.log(JSON.stringify(summary.counts, null, 2))
