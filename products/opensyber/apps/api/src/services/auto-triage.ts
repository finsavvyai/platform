/**
 * Auto-Triage Classifier
 *
 * Classifies agent activity events as real threats vs. normal development activity.
 * Uses heuristic rules with configurable thresholds.
 */

export interface TriageInput {
  eventType: string;
  filePath?: string;
  command?: string;
  riskLevel: string;
  agentName?: string;
  timestamp: string;
}

export interface TriageResult {
  classification: 'real_threat' | 'suspicious' | 'normal_activity' | 'false_positive';
  confidence: number; // 0-100
  reason: string;
}

const SAFE_FILE_PATTERNS = [
  /node_modules\//,
  /\.test\.(ts|js|tsx|jsx)$/,
  /\.spec\.(ts|js|tsx|jsx)$/,
  /package\.json$/,
  /tsconfig.*\.json$/,
  /\.eslintrc/,
  /\.prettierrc/,
  /dist\//,
  /build\//,
];

const DANGEROUS_FILE_PATTERNS = [
  /\.env$/,
  /\.env\.\w+$/,
  /\.pem$/,
  /\.key$/,
  /id_rsa/,
  /credentials/,
  /\/\.ssh\//,
  /\/\.aws\//,
  /secrets?\.(ya?ml|json)$/,
];

const SAFE_COMMANDS = [
  /^(ls|pwd|echo|cat|head|tail|wc|grep|find|tree|which|node|npm|pnpm|yarn|git|tsc|vitest)/,
  /^cd\b/,
];

const DANGEROUS_COMMANDS = [
  /curl.*\|\s*(bash|sh)/,
  /wget.*\|\s*(bash|sh)/,
  /rm\s+-rf\s+\//,
  /chmod\s+777/,
  /base64\s+-d/,
  /nc\s+-/,
  /\/dev\/tcp/,
  /eval\s/,
];

export function triageEvent(input: TriageInput): TriageResult {
  if (input.filePath) {
    for (const pattern of DANGEROUS_FILE_PATTERNS) {
      if (pattern.test(input.filePath)) {
        return {
          classification: 'real_threat',
          confidence: 85,
          reason: `Agent accessed sensitive file: ${input.filePath}`,
        };
      }
    }
    for (const pattern of SAFE_FILE_PATTERNS) {
      if (pattern.test(input.filePath)) {
        return {
          classification: 'normal_activity',
          confidence: 90,
          reason: `Standard development file: ${input.filePath}`,
        };
      }
    }
  }

  if (input.command) {
    for (const pattern of DANGEROUS_COMMANDS) {
      if (pattern.test(input.command)) {
        return {
          classification: 'real_threat',
          confidence: 95,
          reason: `Dangerous command pattern: ${input.command.substring(0, 50)}`,
        };
      }
    }
    for (const pattern of SAFE_COMMANDS) {
      if (pattern.test(input.command)) {
        return {
          classification: 'normal_activity',
          confidence: 85,
          reason: `Common development command`,
        };
      }
    }
  }

  if (input.riskLevel === 'critical') {
    return { classification: 'suspicious', confidence: 70, reason: 'Critical risk level requires review' };
  }
  if (input.riskLevel === 'high') {
    return { classification: 'suspicious', confidence: 60, reason: 'High risk level flagged' };
  }

  return { classification: 'normal_activity', confidence: 75, reason: 'No threat indicators detected' };
}

export async function triageEventWithAI(
  input: TriageInput,
  ai: unknown,
): Promise<TriageResult & { source: 'heuristic' | 'ai' }> {
  const heuristic = triageEvent(input);
  const shouldUseAI = ai && heuristic.confidence < 80
    && input.eventType === 'bash_command' && input.command;

  if (!shouldUseAI) return { ...heuristic, source: 'heuristic' };

  try {
    return await classifyWithAI(input, heuristic, ai);
  } catch {
    return { ...heuristic, source: 'heuristic' };
  }
}

async function classifyWithAI(
  input: TriageInput,
  heuristic: TriageResult,
  ai: unknown,
): Promise<TriageResult & { source: 'ai' }> {
  const prompt = [
    'You are a security analyst classifying agent bash commands.',
    `Command: ${input.command}`,
    `Risk level: ${input.riskLevel}`,
    `Agent: ${input.agentName ?? 'unknown'}`,
    'Classify as: real_threat, suspicious, normal_activity, or false_positive.',
    'Respond with JSON: {"classification":"...","reason":"..."}',
  ].join('\n');

  const response = await (ai as any).run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 150,
  });

  const text = response?.response?.trim();
  if (!text) throw new Error('Empty AI response');

  const parsed = parseAIClassification(text);
  if (!parsed) return { ...heuristic, source: 'ai' };
  return { ...parsed, source: 'ai' };
}

function parseAIClassification(text: string): TriageResult | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    const valid = ['real_threat', 'suspicious', 'normal_activity', 'false_positive'];
    if (!valid.includes(parsed.classification)) return null;
    return {
      classification: parsed.classification,
      confidence: 80,
      reason: parsed.reason ?? 'AI-classified',
    };
  } catch {
    return null;
  }
}

export function batchTriage(events: TriageInput[]): TriageResult[] {
  return events.map(triageEvent);
}
