// Response validation and sanitization for AI outputs.

// Check if text looks like valid YAML (basic structural check).
export function validateYaml(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Must have at least one key: value pair
  if (!/^[\w-]+\s*:/m.test(trimmed)) return false;
  // Reject if it looks like JSON instead
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return false;
  // Check for common YAML structure indicators
  const hasStructure =
    /^(name|steps|on|jobs|stages|pipeline):/m.test(trimmed);
  return hasStructure;
}

// Extract YAML from markdown code blocks.
export function extractYamlBlock(text: string): string | null {
  const match = text.match(/```(?:ya?ml)?\s*\n([\s\S]*?)```/);
  if (match?.[1]) return match[1].trim();
  // If no code block, check if entire response is YAML
  if (validateYaml(text)) return text.trim();
  return null;
}

const SECRET_PATTERNS = [
  /(?:api[_-]?key|token|secret|password|passwd|credential)[\s]*[=:]\s*["']?[\w\-./+=]{8,}/gi,
  /ghp_[A-Za-z0-9_]{36}/g,
  /sk-[A-Za-z0-9]{32,}/g,
  /xox[bpras]-[A-Za-z0-9\-]+/g,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
];

// Redact API keys, tokens, and passwords from text.
export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

interface SanitizedLog {
  prompt: string;
  response: string;
  timestamp: string;
}

// Sanitize prompt and response for audit logging.
export function sanitizeForLog(
  prompt: string,
  response: string
): SanitizedLog {
  return {
    prompt: redactSecrets(prompt).slice(0, 2000),
    response: redactSecrets(response).slice(0, 5000),
    timestamp: new Date().toISOString(),
  };
}

// Truncate logs to fit within Claude's context window.
export function truncateLogs(logs: string, maxChars = 4000): string {
  if (logs.length <= maxChars) return logs;
  const half = Math.floor(maxChars / 2);
  const head = logs.slice(0, half);
  const tail = logs.slice(-half);
  return `${head}\n\n... [${logs.length - maxChars} chars truncated] ...\n\n${tail}`;
}
