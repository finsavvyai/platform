/**
 * Triage Scorer
 *
 * Scores security events for auto-triage based on severity weight,
 * frequency, asset sensitivity, and time-of-day anomaly detection.
 */

export interface TriageEventInput {
  eventId: string;
  eventType: string;
  severity: string;
  filePath?: string;
  timestamp: string;
  agentName?: string;
  occurrenceCount?: number;
}

export type AutoAction = 'alert' | 'investigate' | 'dismiss';

export interface TriageScoreResult {
  eventId: string;
  triageScore: number;
  autoAction: AutoAction;
  breakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  severityScore: number;
  frequencyScore: number;
  assetScore: number;
  timeAnomalyScore: number;
}

/** Severity weight mapping (0-40 scale) */
const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 40,
  high: 30,
  medium: 18,
  low: 8,
  info: 2,
};

/** Sensitive asset path patterns with their sensitivity multipliers */
const SENSITIVE_ASSETS: { pattern: RegExp; score: number; label: string }[] = [
  { pattern: /\.env(\.\w+)?$/, score: 25, label: 'environment file' },
  { pattern: /\.(pem|key|crt|pfx)$/, score: 25, label: 'certificate/key' },
  { pattern: /id_rsa|id_ed25519/, score: 25, label: 'SSH key' },
  { pattern: /\.aws\/credentials/, score: 25, label: 'AWS credentials' },
  { pattern: /secrets?\.(ya?ml|json|toml)$/, score: 22, label: 'secrets file' },
  { pattern: /password|passwd|shadow/, score: 20, label: 'password file' },
  { pattern: /\.kube\/config/, score: 20, label: 'kubeconfig' },
  { pattern: /\/etc\/(passwd|shadow|sudoers)/, score: 18, label: 'system auth file' },
  { pattern: /docker-compose.*\.ya?ml$/, score: 10, label: 'docker config' },
  { pattern: /Dockerfile/, score: 8, label: 'container definition' },
];

/** Normal business hours (UTC) — 7:00 to 22:00 */
const BUSINESS_HOURS_START = 7;
const BUSINESS_HOURS_END = 22;

/**
 * Calculate severity-based score component (0-40)
 */
function calcSeverityScore(severity: string): number {
  return SEVERITY_WEIGHTS[severity.toLowerCase()] ?? 5;
}

/**
 * Calculate frequency-based score component (0-20)
 * Higher frequency = more suspicious
 */
function calcFrequencyScore(occurrenceCount: number): number {
  if (occurrenceCount <= 1) return 0;
  if (occurrenceCount <= 3) return 5;
  if (occurrenceCount <= 10) return 12;
  if (occurrenceCount <= 50) return 17;
  return 20;
}

/**
 * Calculate asset sensitivity score component (0-25)
 */
function calcAssetScore(filePath?: string): number {
  if (!filePath) return 0;
  for (const asset of SENSITIVE_ASSETS) {
    if (asset.pattern.test(filePath)) return asset.score;
  }
  return 0;
}

/**
 * Calculate time-of-day anomaly score component (0-15)
 * Events outside business hours get higher scores
 */
function calcTimeAnomalyScore(timestamp: string): number {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 0;

  const hour = date.getUTCHours();
  const dayOfWeek = date.getUTCDay();
  let score = 0;

  // Weekend activity is unusual
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    score += 8;
  }

  // Outside business hours
  if (hour < BUSINESS_HOURS_START || hour >= BUSINESS_HOURS_END) {
    score += 7;
  }

  return Math.min(score, 15);
}

/**
 * Determine the auto-action based on the triage score
 */
function determineAction(score: number): AutoAction {
  if (score >= 65) return 'alert';
  if (score >= 35) return 'investigate';
  return 'dismiss';
}

/**
 * Clamp a value between 0 and 100
 */
function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * Score a single event for auto-triage
 */
export function scoreTriageEvent(event: TriageEventInput): TriageScoreResult {
  const severityScore = calcSeverityScore(event.severity);
  const frequencyScore = calcFrequencyScore(event.occurrenceCount ?? 1);
  const assetScore = calcAssetScore(event.filePath);
  const timeAnomalyScore = calcTimeAnomalyScore(event.timestamp);

  const triageScore = clamp(severityScore + frequencyScore + assetScore + timeAnomalyScore);

  return {
    eventId: event.eventId,
    triageScore,
    autoAction: determineAction(triageScore),
    breakdown: { severityScore, frequencyScore, assetScore, timeAnomalyScore },
  };
}

/**
 * Score multiple events and return sorted by triage score (highest first)
 */
export function batchScoreTriageEvents(events: TriageEventInput[]): TriageScoreResult[] {
  return events
    .map(scoreTriageEvent)
    .sort((a, b) => b.triageScore - a.triageScore);
}
