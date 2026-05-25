export type TimeRange = '24h' | '7d' | '30d';

export function sinceFromRange(range: TimeRange): string {
    const now = Date.now();
    const ms =
        range === '24h'
            ? 86400000
            : range === '7d'
              ? 604800000
              : 2592000000;
    return new Date(now - ms).toISOString();
}

export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

export function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
}
