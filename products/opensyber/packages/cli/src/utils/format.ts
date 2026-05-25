import type { ActivityEvent, ActivitySummary } from './activity-reader.js'

const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'
const DIM    = '\x1b[2m'
const RED    = '\x1b[31m'
const ORANGE = '\x1b[33m'  // closest to orange in 4-bit ANSI
const YELLOW = '\x1b[33m'
const GRAY   = '\x1b[90m'
const BLUE   = '\x1b[34m'
const GREEN  = '\x1b[32m'

const RISK_COLOR: Record<string, string> = {
  critical: RED,
  high:     ORANGE,
  medium:   YELLOW,
  low:      GRAY,
}

export function colorRisk(risk: string): string {
  const color = RISK_COLOR[risk] ?? GRAY
  return `${BOLD}${color}${risk.toUpperCase().padEnd(8)}${RESET}`
}

export function printHeader(): void {
  console.log()
  console.log(`${BOLD}${BLUE}⬡ OpenAgent CLI${RESET}  ${DIM}AI Agent Activity Scanner${RESET}`)
  console.log(`${DIM}${'─'.repeat(60)}${RESET}`)
}

export function printSummary(s: ActivitySummary): void {
  console.log()
  console.log(`${BOLD}Session Summary${RESET}`)
  console.log(`  ${RED}${BOLD}${s.critical}${RESET} critical   ${ORANGE}${BOLD}${s.high}${RESET} high   ${YELLOW}${BOLD}${s.medium}${RESET} medium   ${GRAY}${s.low}${RESET} low`)
  if (s.secretsDetected > 0) {
    console.log(`  ${RED}${BOLD}${s.secretsDetected} secret pattern${s.secretsDetected > 1 ? 's' : ''}${RESET} detected in files read`)
  }
  console.log(`  ${BOLD}${s.total}${RESET} total events`)
  console.log()
}

export function printScore(s: ActivitySummary): void {
  const raw   = 100 - s.critical * 20 - s.high * 8 - s.medium * 2 - s.secretsDetected * 5
  const score = Math.max(0, Math.min(100, raw))
  const color = score >= 80 ? GREEN : score >= 60 ? YELLOW : score >= 40 ? ORANGE : RED
  const label = score >= 80 ? 'Good' : score >= 60 ? 'Moderate Risk' : score >= 40 ? 'High Risk' : 'Critical Risk'
  console.log(`${BOLD}Risk Score:${RESET} ${color}${BOLD}${score}/100${RESET} — ${color}${label}${RESET}`)
  console.log()
}

export function printEvent(e: ActivityEvent): void {
  const time = new Date(e.timestamp).toLocaleTimeString()
  const type = e.type.replace('_', ' ').padEnd(12)
  console.log(`  ${colorRisk(e.risk)}  ${DIM}${time}${RESET}  ${type}  ${e.summary}`)
}

export function printDivider(label: string): void {
  console.log()
  console.log(`${BOLD}${label}${RESET}`)
  console.log(`${DIM}${'─'.repeat(60)}${RESET}`)
}
