/**
 * Ruflo AIDefence — local agent input sanitization skill.
 *
 * Adapted from Ruflo (claude-flow) v3 security modules (MIT license).
 * Runs entirely in-process — no network calls, no external dependencies.
 *
 * Capabilities:
 * 1. Prompt injection pattern detection (regex + heuristic)
 * 2. Path traversal prevention
 * 3. Command injection blocking
 * 4. Input length and encoding validation
 */

const { parentPort } = require('node:worker_threads')

// ── Pattern Databases ───────────────────────────────────────────────

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?(prior|previous|above)/i,
  /you\s+are\s+now\s+(a|an)\s/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /act\s+as\s+(if|a|an)\s/i,
  /forget\s+(everything|all|your)\s/i,
  /new\s+instructions?\s*:/i,
  /system\s*:\s*you\s+are/i,
  /\[system\]/i,
  /\<\|im_start\|\>/i,
  /\<\|endoftext\|\>/i,
  /ADMIN\s*OVERRIDE/i,
  /reveal\s+(your\s+)?(system|initial)\s+prompt/i,
  /what\s+(is|are)\s+your\s+(system\s+)?instructions/i,
  /output\s+your\s+(system\s+)?prompt/i,
  /repeat\s+(the\s+)?(text|words)\s+above/i,
]

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.\\/,
  /%2e%2e/i,
  /%252e%252e/i,
  /\.\./,
]

const COMMAND_INJECTION_PATTERNS = [
  /[;&|`$]\s*(rm|cat|curl|wget|nc|bash|sh|python|node|eval)\s/i,
  /\$\(.*\)/,
  /`[^`]*`/,
  /\|\s*(bash|sh|zsh)\b/i,
  />\s*\/etc\//,
  /;\s*chmod\s/i,
]

// ── Validation Functions ────────────────────────────────────────────

function detectInjection(input) {
  const violations = []
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      violations.push({ pattern: pattern.source, type: 'prompt_injection' })
    }
  }
  return violations
}

function detectPathTraversal(input) {
  const violations = []
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(input)) {
      violations.push({ pattern: pattern.source, type: 'path_traversal' })
    }
  }
  return violations
}

function detectCommandInjection(input) {
  const violations = []
  for (const pattern of COMMAND_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      violations.push({ pattern: pattern.source, type: 'command_injection' })
    }
  }
  return violations
}

function validateInput(input) {
  const issues = []
  if (input.length > 100_000) issues.push({ type: 'length', detail: 'Exceeds 100K chars' })
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(input)) {
    issues.push({ type: 'encoding', detail: 'Contains control characters' })
  }
  return issues
}

function sanitize(input) {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\0/g, '')
    .trim()
}

// ── Main Handler ────────────────────────────────────────────────────

console.log('[ruflo-aidefence] Started — local input sanitization')

if (parentPort) {
  parentPort.on('message', async (msg) => {
    if (msg.type !== 'defence_request' && msg.type !== 'llm_input') return

    const input = msg.data?.input || msg.data?.prompt || ''
    if (!input) return

    const injections = detectInjection(input)
    const traversals = detectPathTraversal(input)
    const cmdInjections = detectCommandInjection(input)
    const inputIssues = validateInput(input)

    const allViolations = [...injections, ...traversals, ...cmdInjections, ...inputIssues]
    const blocked = allViolations.length > 0
    const sanitized = blocked ? sanitize(input) : input

    parentPort.postMessage({
      type: 'defence_result',
      requestId: msg.data?.requestId,
      blocked,
      violations: allViolations,
      violationCount: allViolations.length,
      categories: [...new Set(allViolations.map((v) => v.type))],
      sanitizedInput: sanitized,
      engine: 'ruflo-aidefence',
      selfHosted: true,
      timestamp: new Date().toISOString(),
    })

    if (blocked) {
      const cats = [...new Set(allViolations.map((v) => v.type))].join(', ')
      console.log(`[ruflo-aidefence] BLOCKED: ${cats} (${allViolations.length} violations)`)
    }
  })
}
