/**
 * Failure Similarity Index — RuVector-inspired hybrid search
 *
 * In-process vector index for finding similar test failures.
 * Uses sparse (TF-IDF) + dense (hash embedding) retrieval fusion.
 * No external DB — fits in memory, persists to disk on demand.
 *
 * Reference: https://github.com/ruvnet/RuVector
 */

export interface FailureRecord {
  id: string;
  testId: string;
  errorMessage: string;
  stackTrace?: string;
  selector?: string;
  resolution?: string;        // How it was fixed (if known)
  resolutionType?: 'selector-update' | 'timing-fix' | 'assertion-fix' | 'env-fix' | 'unknown';
  success?: boolean;          // Did the resolution work?
  timestamp: number;
}

export interface SimilarityMatch {
  record: FailureRecord;
  score: number;              // 0-1, higher = more similar
  reason: 'exact' | 'token-match' | 'stack-similar' | 'semantic';
}

/**
 * Simple hash-based dense embedding
 * Not as good as a real model, but zero dependencies + deterministic
 */
function hashEmbed(text: string, dim = 64): Float32Array {
  const vec = new Float32Array(dim);
  const tokens = tokenize(text);

  for (const token of tokens) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h = (h ^ token.charCodeAt(i)) * 16777619;
    }
    const idx = Math.abs(h) % dim;
    vec[idx] += 1;
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;

  return vec;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && t.length < 30);
}

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

function jaccardSim(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / (union.size || 1);
}

export class FailureIndex {
  private records: FailureRecord[] = [];
  private embeddings: Float32Array[] = [];
  private tokenSets: Set<string>[] = [];
  private maxRecords: number;

  constructor(maxRecords = 10_000) {
    this.maxRecords = maxRecords;
  }

  /**
   * Add a failure record to the index
   */
  add(record: FailureRecord): void {
    const text = `${record.errorMessage} ${record.stackTrace || ''} ${record.selector || ''}`;

    this.records.push(record);
    this.embeddings.push(hashEmbed(text));
    this.tokenSets.push(new Set(tokenize(text)));

    // Evict oldest if over limit
    if (this.records.length > this.maxRecords) {
      this.records.shift();
      this.embeddings.shift();
      this.tokenSets.shift();
    }
  }

  /**
   * Find similar failures to a given error
   * Uses hybrid retrieval: dense (cosine) + sparse (Jaccard) fusion
   */
  search(
    errorMessage: string,
    stackTrace?: string,
    options: { limit?: number; minScore?: number } = {},
  ): SimilarityMatch[] {
    const limit = options.limit ?? 5;
    const minScore = options.minScore ?? 0.3;

    if (this.records.length === 0) return [];

    const queryText = `${errorMessage} ${stackTrace || ''}`;
    const queryEmbed = hashEmbed(queryText);
    const queryTokens = new Set(tokenize(queryText));

    const matches: SimilarityMatch[] = [];

    for (let i = 0; i < this.records.length; i++) {
      const denseScore = cosineSim(queryEmbed, this.embeddings[i]);
      const sparseScore = jaccardSim(queryTokens, this.tokenSets[i]);

      // Hybrid fusion: 60% sparse (exact token match) + 40% dense (semantic)
      const score = sparseScore * 0.6 + denseScore * 0.4;

      if (score >= minScore) {
        let reason: SimilarityMatch['reason'] = 'semantic';
        if (sparseScore > 0.9) reason = 'exact';
        else if (sparseScore > 0.5) reason = 'token-match';
        else if (denseScore > 0.7) reason = 'stack-similar';

        matches.push({ record: this.records[i], score, reason });
      }
    }

    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Find past resolutions that worked for similar failures
   */
  findResolutions(
    errorMessage: string,
    stackTrace?: string,
  ): Array<{ resolution: string; type: string; confidence: number }> {
    const similar = this.search(errorMessage, stackTrace, { limit: 20, minScore: 0.4 });

    const resolutionCounts = new Map<
      string,
      { count: number; type: string; totalScore: number }
    >();

    for (const match of similar) {
      if (match.record.resolution && match.record.success) {
        const existing = resolutionCounts.get(match.record.resolution);
        if (existing) {
          existing.count++;
          existing.totalScore += match.score;
        } else {
          resolutionCounts.set(match.record.resolution, {
            count: 1,
            type: match.record.resolutionType || 'unknown',
            totalScore: match.score,
          });
        }
      }
    }

    return Array.from(resolutionCounts.entries())
      .map(([resolution, info]) => ({
        resolution,
        type: info.type,
        confidence: info.totalScore / info.count,
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  size(): number {
    return this.records.length;
  }

  clear(): void {
    this.records = [];
    this.embeddings = [];
    this.tokenSets = [];
  }
}

// Singleton instance for the self-healing engine
export const failureIndex = new FailureIndex();
