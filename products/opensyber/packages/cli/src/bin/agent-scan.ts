#!/usr/bin/env node
import { readEvents, summarise, logPath } from '../utils/activity-reader.js'
import { printHeader, printSummary, printScore, printEvent, printDivider } from '../utils/format.js'

const args    = process.argv.slice(2)
const limit   = parseInt(args.find((a) => a.startsWith('--last='))?.split('=')[1] ?? '100', 10)
const minRisk = args.find((a) => a.startsWith('--risk='))?.split('=')[1] ?? 'medium'
const jsonOut = args.includes('--json')
const help    = args.includes('--help') || args.includes('-h')

const RISK_ORDER = ['low', 'medium', 'high', 'critical'] as const
type RiskLevel   = typeof RISK_ORDER[number]

if (help) {
  console.log(`
opensyber-scan — AI Agent Activity Scanner

Usage:
  npx opensyber-scan [options]
  agent-scan [options]

Options:
  --last=N      Show last N events (default: 100)
  --risk=LEVEL  Minimum risk level to display: low|medium|high|critical (default: medium)
  --json        Output raw JSON instead of pretty-print
  --help, -h    Show this help

Examples:
  npx opensyber-scan                       # Show medium+ events from last 100
  npx opensyber-scan --last=500 --risk=high  # Show only high/critical from last 500
  npx opensyber-scan --json | jq .summary  # Pipe JSON summary to jq
`)
  process.exit(0)
}

const events  = readEvents(limit)
const summary = summarise(events)

if (jsonOut) {
  const minIdx     = RISK_ORDER.indexOf(minRisk as RiskLevel)
  const filtered   = events.filter((e) => RISK_ORDER.indexOf(e.risk) >= minIdx)
  console.log(JSON.stringify({ summary, events: filtered, logPath: logPath() }, null, 2))
  process.exit(summary.critical > 0 ? 1 : 0)
}

printHeader()
console.log(`Log file: ${logPath()}`)

printScore(summary)
printSummary(summary)

const minIdx  = RISK_ORDER.indexOf(minRisk as RiskLevel)
const visible = events.filter((e) => RISK_ORDER.indexOf(e.risk) >= minIdx)

if (visible.length === 0) {
  console.log('  No events at this risk level. Use --risk=low to see all activity.')
} else {
  printDivider(`Activity (${visible.length} events, ${minRisk}+)`)
  visible.forEach(printEvent)
}

console.log()
if (summary.critical > 0) {
  console.log(`\x1b[31m\x1b[1m⚠ CRITICAL events detected. Run 'npx opensyber-scan --risk=critical' to focus.\x1b[0m`)
  process.exit(1)
}
