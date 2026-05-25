import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeywordSearchService } from './keyword-search';
import { D1MetadataStore } from './metadata-store';

function createMockStore() {
  return {
    searchByKeyword: vi.fn().mockResolvedValue([
      { id: 'chunk-1', documentId: 'doc-1', content: 'authentication login flow', score: 1.0, metadata: {} },
      { id: 'chunk-2', documentId: 'doc-2', content: 'login page design', score: 0.5, metadata: {} },
    ]),
  } as unknown as D1MetadataStore;
}

describe('KeywordSearchService', () => {
  let service: KeywordSearchService;
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    mockStore = createMockStore();
    service = new KeywordSearchService(mockStore as any);
  });

  it('searches by extracted keywords', async () => {
    const results = await service.search('authentication login');
    expect(mockStore.searchByKeyword).toHaveBeenCalledWith(
      ['authentication', 'login'],
      10
    );
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('chunk-1');
  });

  it('converts results to SearchResult format', async () => {
    const results = await service.search('login flow');
    expect(results[0]).toHaveProperty('document');
    expect(results[0]).toHaveProperty('score');
    expect(results[0]).toHaveProperty('rank');
    expect(results[0].document.id).toBe('chunk-1');
  });

  it('returns empty for short query words', async () => {
    const results = await service.search('a I');
    expect(results).toEqual([]);
    expect(mockStore.searchByKeyword).not.toHaveBeenCalled();
  });

  it('respects limit parameter', async () => {
    await service.search('auth login', 5);
    expect(mockStore.searchByKeyword).toHaveBeenCalledWith(
      ['auth', 'login'],
      5
    );
  });
});
