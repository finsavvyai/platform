import type { Metrics } from './health-score-types';

export function calculateHealthScore(metrics: Metrics): number {
  const normalized = normalizeMetrics(metrics);
  const components = {
    availability: calculateComponentScore('availability', metrics) || 0,
    performance: calculateComponentScore('performance', metrics) || 0,
    reliability: calculateComponentScore('reliability', metrics) || 0,
    capacity: calculateComponentScore('capacity', metrics) || 0
  };
  return applyWeights(components);
}

export function calculateComponentScore(component: string, metrics: Metrics): number {
  switch (component) {
    case 'availability':
      return (metrics.uptime || 100) * 0.6 + 40;
    case 'performance':
      return (
        ((100 - (metrics.cpu || 0)) * 0.4 +
          (100 - (metrics.memory || 0)) * 0.4 +
          Math.max(0, 100 - ((metrics.latency || 0) / 100))) *
        0.2
      );
    case 'reliability':
      return (100 - ((metrics.errorRate || 0) * 10000)) * 0.8 + 20;
    case 'capacity':
      return 100 - ((metrics.cpu || 0) + (metrics.memory || 0) + (metrics.disk || 0)) / 3;
    default:
      return 75;
  }
}

export function normalizeMetrics(metrics: Metrics): Metrics {
  return {
    uptime: Math.max(0, Math.min(100, metrics.uptime || 100)),
    cpu: 100 - Math.max(0, Math.min(100, metrics.cpu || 0)),
    memory: 100 - Math.max(0, Math.min(100, metrics.memory || 0)),
    disk: 100 - Math.max(0, Math.min(100, metrics.disk || 0)),
    latency: Math.max(0, 100 - ((metrics.latency || 0) / 100)),
    errorRate: Math.max(0, 100 - ((metrics.errorRate || 0) * 10000)),
    throughput: Math.min(100, (metrics.throughput || 0) / 100),
    responseTime: Math.max(0, 100 - ((metrics.responseTime || 0) / 100))
  };
}

export function applyWeights(
  components: Record<string, number>,
  weights?: Record<string, number>
): number {
  const defaultWeights = {
    availability: 0.4,
    performance: 0.3,
    reliability: 0.2,
    capacity: 0.1
  };

  const w = weights || defaultWeights;
  let total = 0;
  let sum = 0;

  for (const [key, value] of Object.entries(components)) {
    const weight = w[key] || 0;
    sum += (value || 0) * weight;
    total += weight;
  }

  return total > 0 ? Math.round(sum / total) : 0;
}

export function aggregateScores(scores: number[], weights?: number[]): number {
  if (!scores || scores.length === 0) return 0;

  if (weights && weights.length === scores.length) {
    const sum = scores.reduce((acc, score, i) => acc + score * (weights[i] || 0), 0);
    const totalWeight = weights.reduce((a, w) => a + w, 0);
    return totalWeight > 0 ? sum / totalWeight : 0;
  }

  return scores.reduce((a, s) => a + s, 0) / scores.length;
}
