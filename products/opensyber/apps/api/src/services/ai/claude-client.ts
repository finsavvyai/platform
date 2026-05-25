/**
 * Claude AI Client
 *
 * Integrates with the Anthropic Messages API for threat explanation,
 * compliance narrative generation, and risk classification.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

export interface ThreatEvent {
  eventId: string;
  eventType: string;
  details: string;
  severity?: string;
  source?: string;
}

export interface RiskClassification {
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: number;
  reasoning: string;
}

export interface ControlEvidence {
  controlId: string;
  status: 'pass' | 'fail' | 'partial';
  evidence: string;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
}

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  messages: AnthropicMessage[],
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown');
    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  return data.content?.[0]?.text ?? '';
}

/** Generate a human-readable explanation of a security threat event. */
export async function explainThreat(apiKey: string, event: ThreatEvent): Promise<string> {
  const system = [
    'You are a security analyst for an AI agent hosting platform.',
    'Explain the security event in clear, non-technical language.',
    'Include: what happened, potential impact, and recommended next steps.',
    'Keep the explanation under 200 words.',
  ].join(' ');

  const userMsg = [
    `Event ID: ${event.eventId}`,
    `Type: ${event.eventType}`,
    `Severity: ${event.severity ?? 'unknown'}`,
    `Details: ${event.details}`,
  ].join('\n');

  return callClaude(apiKey, system, [{ role: 'user', content: userMsg }]);
}

/** Generate an auditor-friendly compliance narrative from control results. */
export async function generateComplianceNarrative(
  apiKey: string,
  controls: ControlEvidence[],
): Promise<string> {
  const system = [
    'You are a compliance auditor writing SOC2 Type 2 audit narratives.',
    'Given a list of controls with their status and evidence, produce a',
    'professional narrative suitable for an external auditor. Use formal',
    'language. Reference specific control IDs. Keep under 500 words.',
  ].join(' ');

  const controlSummary = controls
    .map((c) => `${c.controlId}: ${c.status.toUpperCase()} — ${c.evidence}`)
    .join('\n');

  return callClaude(apiKey, system, [{ role: 'user', content: controlSummary }]);
}

/** Classify the risk level of an event description using Claude. */
export async function classifyRisk(
  apiKey: string,
  eventDescription: string,
): Promise<RiskClassification> {
  const system = [
    'You are a security risk classifier. Given an event description,',
    'classify the risk. Respond ONLY with valid JSON matching this schema:',
    '{"riskLevel":"critical|high|medium|low|info",',
    '"confidence":0.0-1.0,"reasoning":"brief explanation"}',
  ].join(' ');

  const raw = await callClaude(apiKey, system, [
    { role: 'user', content: eventDescription },
  ]);

  try {
    const parsed = JSON.parse(raw) as RiskClassification;
    const validLevels = ['critical', 'high', 'medium', 'low', 'info'];
    if (!validLevels.includes(parsed.riskLevel)) {
      parsed.riskLevel = 'medium';
    }
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));
    return parsed;
  } catch {
    return { riskLevel: 'medium', confidence: 0.3, reasoning: raw || 'Classification unavailable' };
  }
}
