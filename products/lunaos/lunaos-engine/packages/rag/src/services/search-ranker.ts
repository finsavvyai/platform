import { SearchResult, SearchRankingAlgorithm, SearchQuery } from '../interfaces';

export class SearchRanker {
  rankResults(
    results: SearchResult[],
    query: SearchQuery,
    algorithm: SearchRankingAlgorithm | string
  ): SearchResult[] {
    switch (algorithm) {
      case SearchRankingAlgorithm.BM25:
        return this.rankByBM25(results, query);
      case SearchRankingAlgorithm.TF_IDF:
        return this.rankByTFIDF(results, query);
      case SearchRankingAlgorithm.LEARNING_TO_RANK:
        return this.rankByLearningToRank(results, query);
      case SearchRankingAlgorithm.SEMANTIC:
      default:
        return this.rankBySemanticSimilarity(results);
    }
  }

  rankBySemanticSimilarity(results: SearchResult[]): SearchResult[] {
    return [...results].sort((a, b) => b.score - a.score);
  }

  rankByBM25(results: SearchResult[], query: SearchQuery, k1 = 1.2, b = 0.75): SearchResult[] {
    const avgDocLength = 100;
    return results
      .map(result => {
        const score = this.calculateBM25(query.text, result.content ?? '', k1, b, avgDocLength);
        return { ...result, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  rankByTFIDF(results: SearchResult[], query: SearchQuery): SearchResult[] {
    const totalDocs = Math.max(results.length, 1);
    return results
      .map(result => {
        const score = this.calculateTFIDF(query.text, result.content ?? '', totalDocs);
        return { ...result, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  rankByLearningToRank(results: SearchResult[], query: SearchQuery): SearchResult[] {
    return results
      .map(result => {
        const content = result.content ?? '';
        const semanticSim = result.score;
        const keywordOverlap = this.calculateKeywordOverlap(query.text, content);
        const positionScore = 1 / (result.metadata?.chunkIndex || 1);
        const freshnessScore = this.calculateFreshness(result.metadata);
        const lengthBonus = content.length > 100 && content.length < 1000 ? 0.1 : 0;

        const finalScore =
          semanticSim * 0.4 +
          keywordOverlap * 0.2 +
          positionScore * 0.2 +
          freshnessScore * 0.1 +
          lengthBonus;

        return { ...result, score: finalScore };
      })
      .sort((a, b) => b.score - a.score);
  }

  reciprocalRankFusion(resultSets: SearchResult[][], k = 60): SearchResult[] {
    const scores = new Map<string, number>();
    const items = new Map<string, SearchResult>();

    for (const results of resultSets) {
      for (let rank = 0; rank < results.length; rank++) {
        const r = results[rank];
        if (!r) continue;
        
        const rrf = 1 / (k + rank + 1);
        scores.set(r.id, (scores.get(r.id) ?? 0) + rrf);
        if (!items.has(r.id)) items.set(r.id, r);
      }
    }

    return Array.from(items.entries())
      .map(([id, result]) => ({ ...result, score: scores.get(id)! }))
      .sort((a, b) => b.score - a.score);
  }

  combineHybridResults(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[],
    semanticWeight: number,
    keywordWeight: number
  ): SearchResult[] {
    const merged = new Map<string, SearchResult>();

    for (const r of semanticResults) {
      merged.set(r.id, { ...r, score: r.score * semanticWeight });
    }

    for (const r of keywordResults) {
      const existing = merged.get(r.id);
      if (existing) {
        existing.score += r.score * keywordWeight;
      } else {
        merged.set(r.id, { ...r, score: r.score * keywordWeight });
      }
    }

    return Array.from(merged.values()).sort((a, b) => b.score - a.score);
  }

  extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  calculateKeywordOverlap(query: string, document: string): number {
    const qk = this.extractKeywords(query);
    const dk = this.extractKeywords(document);
    if (qk.length === 0) return 0;
    const overlap = qk.filter(k => dk.includes(k));
    return overlap.length / qk.length;
  }

  private calculateBM25(
    query: string, doc: string, k1: number, b: number, avgLen: number
  ): number {
    const queryTerms = this.extractKeywords(query);
    const docTerms = this.extractKeywords(doc);
    const docLen = docTerms.length;
    let score = 0;

    for (const term of queryTerms) {
      const tf = this.countTermFrequency(term, docTerms);
      const idf = Math.log(1 + 1000 / (1 + 1));
      const num = tf * (k1 + 1);
      const den = tf + k1 * (1 - b + b * (docLen / avgLen));
      score += idf * (num / den);
    }
    return score;
  }

  private calculateTFIDF(query: string, doc: string, totalDocs: number): number {
    const queryTerms = this.extractKeywords(query);
    const docTerms = this.extractKeywords(doc);

    return queryTerms.reduce((score, term) => {
      const tf = this.countTermFrequency(term, docTerms);
      const idf = Math.log(1 + totalDocs / (1 + 1));
      return score + tf * idf;
    }, 0);
  }

  private countTermFrequency(term: string, terms: string[]): number {
    return terms.filter(t => t === term).length;
  }

  private calculateFreshness(metadata: Record<string, any> | undefined): number {
    if (!metadata?.createdAt) return 0.5;
    const days = (Date.now() - new Date(metadata.createdAt).getTime()) / 86400000;
    return Math.max(0, 1 - days / 30);
  }
}
