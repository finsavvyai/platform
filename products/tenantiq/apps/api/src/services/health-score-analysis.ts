import type { Metrics } from './health-score-types';

export function getHealthTrend(scores: number[]): { direction: string; rate: number } {
  if (scores.length < 2) {
    return { direction: 'stable', rate: 0 };
  }
  const recent = scores.slice(-5);
  const rate = (recent[recent.length - 1] - recent[0]) / recent.length;

  if (rate > 5) return { direction: 'improving', rate };
  if (rate < -5) return { direction: 'degrading', rate };
  return { direction: 'stable', rate };
}

export function identifyRisks(
  metrics: Metrics
): Array<{ component: string; severity: string; message: string }> {
  const risks: Array<{ component: string; severity: string; message: string }> = [];

  if ((metrics.cpu || 0) > 90) {
    risks.push({ component: 'cpu', severity: 'critical', message: 'CPU usage critically high' });
  } else if ((metrics.cpu || 0) > 75) {
    risks.push({ component: 'cpu', severity: 'high', message: 'CPU usage elevated' });
  }

  if ((metrics.memory || 0) > 90) {
    risks.push({ component: 'memory', severity: 'critical', message: 'Memory usage critically high' });
  } else if ((metrics.memory || 0) > 75) {
    risks.push({ component: 'memory', severity: 'high', message: 'Memory usage elevated' });
  }

  if ((metrics.disk || 0) > 90) {
    risks.push({ component: 'disk', severity: 'critical', message: 'Disk space critically low' });
  } else if ((metrics.disk || 0) > 75) {
    risks.push({ component: 'disk', severity: 'high', message: 'Disk space low' });
  }

  if ((metrics.errorRate || 0) > 0.1) {
    risks.push({ component: 'errorRate', severity: 'high', message: 'Error rate elevated' });
  }

  if ((metrics.uptime || 100) < 95) {
    risks.push({ component: 'uptime', severity: 'critical', message: 'Uptime below target' });
  }

  return risks.sort((a, b) => {
    const severity = { critical: 3, high: 2, medium: 1, low: 0 };
    return (severity[b.severity as keyof typeof severity] || 0) -
           (severity[a.severity as keyof typeof severity] || 0);
  });
}

export function getHealthHistory(
  tenantId: string,
  options?: { days?: number; from?: Date; to?: Date }
): Array<{ timestamp: Date; score: number; components: Record<string, number> }> {
  const days = options?.days || 7;
  const result: Array<{ timestamp: Date; score: number; components: Record<string, number> }> = [];

  for (let i = days; i >= 0; i--) {
    const timestamp = new Date();
    timestamp.setDate(timestamp.getDate() - i);

    result.push({
      timestamp,
      score: 75 + Math.floor(Math.random() * 20),
      components: {
        availability: 80 + Math.floor(Math.random() * 20),
        performance: 70 + Math.floor(Math.random() * 30),
        reliability: 75 + Math.floor(Math.random() * 25),
        capacity: 70 + Math.floor(Math.random() * 30)
      }
    });
  }

  return result;
}

export function detectAnomalies(historical: number[], current: number): Array<{ severity: string }> {
  if (historical.length < 2) return [];

  const mean = historical.reduce((a, v) => a + v, 0) / historical.length;
  const stdDev = Math.sqrt(
    historical.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / historical.length
  );

  const zScore = Math.abs((current - mean) / (stdDev || 1));

  if (zScore > 3) {
    return [{ severity: 'critical' }];
  } else if (zScore > 2) {
    return [{ severity: 'high' }];
  }

  return [];
}

export function predictHealthDegradation(history: number[]): {
  score: number;
  confidence: number;
  lower: number;
  upper: number;
  risk: string;
} {
  if (history.length < 2) {
    return { score: history[0] || 75, confidence: 0.3, lower: 0, upper: 100, risk: 'unknown' };
  }

  const recent = history.slice(-6);
  const slope = (recent[recent.length - 1] - recent[0]) / recent.length;
  const predicted = recent[recent.length - 1] + slope;

  const stdDev = Math.sqrt(
    recent.reduce((sum, v) => sum + Math.pow(v - (recent.reduce((a, x) => a + x) / recent.length), 2), 0) / recent.length
  );

  let risk = 'low';
  if (predicted < 40) risk = 'critical';
  else if (predicted < 60) risk = 'high';
  else if (predicted < 75) risk = 'medium';

  return {
    score: Math.round(predicted),
    confidence: Math.min(0.95, 0.5 + history.length * 0.08),
    lower: Math.max(0, Math.round(predicted - 2 * stdDev)),
    upper: Math.min(100, Math.round(predicted + 2 * stdDev)),
    risk
  };
}
