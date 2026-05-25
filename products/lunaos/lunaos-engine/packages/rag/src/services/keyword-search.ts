import { SearchResult, KeywordSearchResult, DocumentType } from '../interfaces';
import { D1MetadataStore } from './metadata-store';

export class KeywordSearchService {
  private metadataStore: D1MetadataStore;

  constructor(metadataStore: D1MetadataStore) {
    this.metadataStore = metadataStore;
  }

  async search(queryText: string, limit = 10): Promise<SearchResult[]> {
    const keywords = this.extractKeywords(queryText);
    if (keywords.length === 0) return [];

    const raw = await this.metadataStore.searchByKeyword(keywords, limit);
    return raw.map((r, index) => this.toSearchResult(r, index));
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  private toSearchResult(raw: KeywordSearchResult, index: number): SearchResult {
    return {
      id: raw.id,
      documentId: raw.documentId,
      content: raw.content,
      score: raw.score,
      rank: index + 1,
      metadata: raw.metadata,
      document: {
        id: raw.id,
        content: raw.content,
        metadata: { type: DocumentType.TEXT, ...(raw.metadata ?? {}) },
        source: 'local' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }
}
