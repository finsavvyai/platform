/**
 * Natural Language Query Translator
 *
 * Translates natural language questions about agent activity into
 * structured filter objects that can be used to query the database.
 * Uses pattern matching for common queries; falls back to LLM for complex ones.
 */

export interface ActivityFilter {
  eventType?: string;
  riskLevel?: string;
  agentName?: string;
  filePath?: string;
  dateRange?: { from: string; to: string };
  command?: string;
  secretName?: string;
}

const RISK_KEYWORDS: Record<string, string> = {
  critical: 'critical', dangerous: 'critical', severe: 'critical',
  high: 'high', risky: 'high', suspicious: 'high',
  medium: 'medium', moderate: 'medium',
  low: 'low', minor: 'low', safe: 'low',
};

const EVENT_KEYWORDS: Record<string, string> = {
  'file read': 'file_read', 'read file': 'file_read', 'accessed file': 'file_read',
  'file write': 'file_write', 'wrote file': 'file_write', 'modified file': 'file_write',
  'bash': 'bash_command', 'terminal': 'bash_command', 'command': 'bash_command',
  'secret': 'secret_access', 'credential': 'secret_access', 'env': 'secret_access',
  'network': 'network_call', 'api call': 'network_call', 'http': 'network_call',
};

const TIME_PATTERNS: Record<string, number> = {
  'today': 0, 'yesterday': 1, 'last week': 7, 'last month': 30,
  'last 24 hours': 1, 'last 7 days': 7, 'last 30 days': 30, 'last 90 days': 90,
};

export function translateNaturalLanguageQuery(query: string): ActivityFilter {
  const lower = query.toLowerCase();
  const filter: ActivityFilter = {};

  for (const [keyword, level] of Object.entries(RISK_KEYWORDS)) {
    if (lower.includes(keyword)) { filter.riskLevel = level; break; }
  }

  for (const [keyword, type] of Object.entries(EVENT_KEYWORDS)) {
    if (lower.includes(keyword)) { filter.eventType = type; break; }
  }

  for (const [keyword, days] of Object.entries(TIME_PATTERNS)) {
    if (lower.includes(keyword)) {
      const from = new Date(Date.now() - days * 86400000).toISOString();
      filter.dateRange = { from, to: new Date().toISOString() };
      break;
    }
  }

  const envMatch = lower.match(/\.env|\.pem|\.key|\.secret|\.credentials/);
  if (envMatch) filter.filePath = envMatch[0];

  const agentMatch = lower.match(/\b(cursor|cline|copilot|devin|claude|windsurf)\b/);
  if (agentMatch) filter.agentName = agentMatch[1];

  return filter;
}

function isFilterEmpty(filter: ActivityFilter): boolean {
  return !filter.eventType && !filter.riskLevel && !filter.agentName
    && !filter.filePath && !filter.dateRange && !filter.command && !filter.secretName;
}

const AI_SYSTEM_PROMPT = `You translate natural language queries about AI agent activity into JSON filters.
Return ONLY valid JSON matching this shape (omit fields that don't apply):
{
  "eventType": "file_read"|"file_write"|"bash_command"|"secret_access"|"network_call",
  "riskLevel": "critical"|"high"|"medium"|"low",
  "agentName": string,
  "filePath": string,
  "command": string,
  "secretName": string
}
No explanation, no markdown — only the JSON object.`;

export async function translateWithAI(
  query: string,
  ai: { run: (model: string, input: unknown) => Promise<{ response?: string }> },
): Promise<ActivityFilter> {
  try {
    const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
      max_tokens: 256,
    });
    const text = result.response ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    const parsed = JSON.parse(jsonMatch[0]) as ActivityFilter;
    const clean: ActivityFilter = {};
    if (parsed.eventType) clean.eventType = String(parsed.eventType);
    if (parsed.riskLevel) clean.riskLevel = String(parsed.riskLevel);
    if (parsed.agentName) clean.agentName = String(parsed.agentName);
    if (parsed.filePath) clean.filePath = String(parsed.filePath);
    if (parsed.command) clean.command = String(parsed.command);
    if (parsed.secretName) clean.secretName = String(parsed.secretName);
    return clean;
  } catch {
    return {};
  }
}

export { isFilterEmpty };

export function describeFilter(filter: ActivityFilter): string {
  const parts: string[] = [];
  if (filter.eventType) parts.push(`event type: ${filter.eventType}`);
  if (filter.riskLevel) parts.push(`risk level: ${filter.riskLevel}`);
  if (filter.agentName) parts.push(`agent: ${filter.agentName}`);
  if (filter.filePath) parts.push(`file: ${filter.filePath}`);
  if (filter.dateRange) parts.push(`from ${filter.dateRange.from.split('T')[0]}`);
  return parts.length > 0 ? `Filtering by ${parts.join(', ')}` : 'No specific filters applied';
}
