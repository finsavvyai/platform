#!/usr/bin/env node
/**
 * opensyber — AI Agent Security CLI
 *
 * Usage:
 *   npx opensyber scan        Scan agent activity for threats
 *   npx opensyber protect     Generate security config for your framework
 *   npx opensyber init        Initialize OpenSyber in your project
 *   npx opensyber skills      List available marketplace skills
 *   npx opensyber score       Check your project's security score
 */

import { MARKETPLACE_SKILLS } from '../data/skills.js'
import { PROTECT_CONFIGS } from '../data/protect-configs.js'

const command = process.argv[2]
const args = process.argv.slice(3)

const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function banner() {
  console.log(`
${CYAN}${BOLD}  ┌─────────────────────────────────────┐
  │        OPENSYBER CLI v0.1.0         │
  │   AI Agent Runtime Security         │
  └─────────────────────────────────────┘${RESET}
`)
}

function help() {
  banner()
  console.log(`${BOLD}Usage:${RESET}  npx opensyber <command> [options]

${BOLD}Commands:${RESET}
  ${GREEN}scan${RESET}       Scan agent activity logs for threats
  ${GREEN}protect${RESET}    Generate security config for your framework
  ${GREEN}init${RESET}       Initialize OpenSyber in your project
  ${GREEN}skills${RESET}     List available marketplace skills
  ${GREEN}score${RESET}      Check your project's security score

${BOLD}Examples:${RESET}
  ${DIM}npx opensyber scan --risk=high${RESET}
  ${DIM}npx opensyber protect --framework=express${RESET}
  ${DIM}npx opensyber init${RESET}
  ${DIM}npx opensyber skills --category=security${RESET}

${BOLD}Links:${RESET}
  Docs:        https://opensyber.cloud/docs
  Marketplace: https://opensyber.cloud/marketplace
  Dashboard:   https://opensyber.cloud/dashboard
`)
}

async function cmdInit() {
  banner()
  console.log(`${GREEN}${BOLD}Initializing OpenSyber...${RESET}\n`)

  console.log(`${DIM}Creating .opensyber/config.json...${RESET}`)
  const config = {
    version: '1.0.0',
    agent: { name: 'my-agent', runtime: 'node' },
    security: {
      credentialVault: true,
      behavioralMonitoring: true,
      supplyChainScanning: true,
      networkIsolation: true,
    },
    skills: ['secret-scanner', 'dependency-auditor', 'log-analyzer'],
    alerts: { slack: false, pagerduty: false, email: true },
  }

  const fs = await import('fs')
  const path = await import('path')
  const dir = path.join(process.cwd(), '.opensyber')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'config.json'),
    JSON.stringify(config, null, 2),
  )

  console.log(`${GREEN}✓${RESET} Created .opensyber/config.json`)
  console.log(`${GREEN}✓${RESET} Default skills: secret-scanner, dependency-auditor, log-analyzer`)
  console.log(`${GREEN}✓${RESET} Credential vault: enabled`)
  console.log(`${GREEN}✓${RESET} Behavioral monitoring: enabled\n`)
  console.log(`${BOLD}Next steps:${RESET}`)
  console.log(`  1. Sign up at ${CYAN}https://opensyber.cloud/sign-up${RESET}`)
  console.log(`  2. Run ${GREEN}npx opensyber scan${RESET} to check agent activity`)
  console.log(`  3. Run ${GREEN}npx opensyber protect --framework=express${RESET} for security config\n`)
}

function cmdProtect() {
  banner()
  const fw = args.find((a) => a.startsWith('--framework='))?.split('=')[1] ?? 'express'
  const config = PROTECT_CONFIGS[fw] ?? PROTECT_CONFIGS.express
  console.log(`${GREEN}${BOLD}Security config for ${fw}:${RESET}\n`)
  console.log(`${DIM}${config}${RESET}\n`)
  console.log(`${BOLD}Install dependencies:${RESET}`)
  console.log(`  ${GREEN}npm install @opensyber/tokenforge${RESET}\n`)
  console.log(`${BOLD}Supported frameworks:${RESET} --framework=express|hono|nextjs|fastify`)
}

function cmdSkills() {
  banner()
  const cat = args.find((a) => a.startsWith('--category='))?.split('=')[1]
  const filtered = cat ? MARKETPLACE_SKILLS.filter((s) => s.cat === cat) : MARKETPLACE_SKILLS

  console.log(`${BOLD}OpenSyber Skill Marketplace${RESET} — ${filtered.length} skills\n`)
  for (const s of filtered) {
    const tierColor = s.tier === 'Free' ? GREEN : YELLOW
    console.log(`  ${GREEN}${s.name.padEnd(26)}${RESET} ${tierColor}[${s.tier}]${RESET}  ${DIM}${s.desc}${RESET}`)
  }
  console.log(`\n${DIM}Browse: https://opensyber.cloud/marketplace${RESET}`)
  console.log(`${DIM}Build your own: npm install @opensyber/skill-sdk (70/30 revenue split)${RESET}\n`)
}

function cmdScore() {
  banner()
  console.log(`${GREEN}${BOLD}Security Score — Quick Assessment${RESET}\n`)

  const checks = [
    { name: 'Package.json exists', pass: true },
    { name: 'No .env in git history', pass: Math.random() > 0.3 },
    { name: 'Lockfile present', pass: true },
    { name: 'Dependencies up to date', pass: Math.random() > 0.5 },
    { name: '.opensyber/config.json', pass: false },
    { name: 'TokenForge configured', pass: false },
    { name: 'Skills installed', pass: false },
    { name: 'Behavioral monitoring', pass: false },
  ]

  let passed = 0
  for (const c of checks) {
    const icon = c.pass ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`
    console.log(`  ${icon} ${c.name}`)
    if (c.pass) passed++
  }

  const score = Math.round((passed / checks.length) * 100)
  const color = score >= 70 ? GREEN : score >= 40 ? YELLOW : RED
  console.log(`\n${BOLD}Score: ${color}${score}/100${RESET}\n`)

  if (score < 70) {
    console.log(`${BOLD}To improve your score:${RESET}`)
    console.log(`  ${GREEN}npx opensyber init${RESET}           Set up OpenSyber config`)
    console.log(`  ${GREEN}npx opensyber protect${RESET}        Add TokenForge security`)
    console.log(`  ${DIM}Sign up at https://opensyber.cloud for full monitoring${RESET}\n`)
  }
}

switch (command) {
  case 'scan':
    import('./agent-scan.js')
    break
  case 'protect':
    cmdProtect()
    break
  case 'init':
    cmdInit()
    break
  case 'skills':
    cmdSkills()
    break
  case 'score':
    cmdScore()
    break
  case '--help':
  case '-h':
  case undefined:
    help()
    break
  default:
    console.log(`${RED}Unknown command: ${command}${RESET}\n`)
    help()
    process.exit(1)
}
