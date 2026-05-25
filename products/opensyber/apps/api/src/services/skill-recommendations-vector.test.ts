/**
 * Vector-based Skill Recommendation Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import {
  getVectorRecommendations,
  buildContextQuery,
} from './skill-recommendations-vector.js';
import type { UserSignals } from './skill-recommendations-signals.js';

// Mock the signal collection and vector search modules so we can test
// getVectorRecommendations in isolation without touching a real DB/AI.
vi.mock('./skill-recommendations-signals.js', () => ({
  collectUserSignals: vi.fn(),
  loadSlugsByIds: vi.fn(),
}));

vi.mock('./vector-search.js', () => ({
  semanticSearch: vi.fn(),
}));

import {
  collectUserSignals,
  loadSlugsByIds,
} from './skill-recommendations-signals.js';
import { semanticSearch } from './vector-search.js';

const mockedCollect = vi.mocked(collectUserSignals);
const mockedLoadSlugs = vi.mocked(loadSlugsByIds);
const mockedSearch = vi.mocked(semanticSearch);

const fakeDb = {} as DrizzleD1Database<Record<string, unknown>>;
const fakeAi = { run: vi.fn() } as unknown as Ai;
const fakeVectorize = {
  query: vi.fn(),
  upsert: vi.fn(),
  deleteByIds: vi.fn(),
} as unknown as VectorizeIndex;

const baseCtx = { userId: 'u1', orgId: 'o1', instanceIds: ['i1'] };

function signals(overrides: Partial<UserSignals> = {}): UserSignals {
  return {
    installedSkillIds: new Set<string>(),
    integrationSlugs: [],
    hasCloudAccounts: false,
    alertChannelTypes: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildContextQuery', () => {
  it('returns empty string when no signals are present', () => {
    expect(buildContextQuery(signals())).toBe('');
  });

  it('includes integrations, clouds, channels, and installed count', () => {
    const query = buildContextQuery(
      signals({
        integrationSlugs: ['github', 'slack'],
        hasCloudAccounts: true,
        alertChannelTypes: ['pagerduty'],
        installedSkillIds: new Set(['a', 'b', 'c']),
      }),
    );
    expect(query).toContain('github, slack');
    expect(query).toContain('cloud accounts connected');
    expect(query).toContain('pagerduty');
    expect(query).toContain('3 skills installed');
    expect(query).toContain('complementary security tools');
  });

  it('only mentions installed count when skills are present', () => {
    const withNone = buildContextQuery(signals({ integrationSlugs: ['github'] }));
    expect(withNone).not.toContain('skills installed');

    const withSome = buildContextQuery(
      signals({ integrationSlugs: ['github'], installedSkillIds: new Set(['a']) }),
    );
    expect(withSome).toContain('1 skills installed');
  });

  it('caps query length at 512 characters', () => {
    const manyIntegrations = Array.from({ length: 100 }, (_, i) => `svc${i}`);
    const query = buildContextQuery(signals({ integrationSlugs: manyIntegrations }));
    expect(query.length).toBeLessThanOrEqual(512);
  });
});

describe('getVectorRecommendations', () => {
  it('returns empty array when AI binding is missing', async () => {
    const result = await getVectorRecommendations(undefined, fakeVectorize, fakeDb, baseCtx);
    expect(result).toEqual([]);
    expect(mockedCollect).not.toHaveBeenCalled();
  });

  it('returns empty array when Vectorize binding is missing', async () => {
    const result = await getVectorRecommendations(fakeAi, undefined, fakeDb, baseCtx);
    expect(result).toEqual([]);
    expect(mockedCollect).not.toHaveBeenCalled();
  });

  it('returns empty array when context query is empty', async () => {
    mockedCollect.mockResolvedValue(signals());
    const result = await getVectorRecommendations(fakeAi, fakeVectorize, fakeDb, baseCtx);
    expect(result).toEqual([]);
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it('calls semanticSearch with the skills namespace and a built query', async () => {
    mockedCollect.mockResolvedValue(signals({ integrationSlugs: ['github'] }));
    mockedSearch.mockResolvedValue([]);
    await getVectorRecommendations(fakeAi, fakeVectorize, fakeDb, baseCtx);
    expect(mockedSearch).toHaveBeenCalledWith(
      fakeAi,
      fakeVectorize,
      expect.stringContaining('github'),
      expect.objectContaining({ namespace: 'skills', topK: 20 }),
    );
  });

  it('excludes already-installed skills from results', async () => {
    mockedCollect.mockResolvedValue(
      signals({
        integrationSlugs: ['github'],
        installedSkillIds: new Set(['skill-1']),
      }),
    );
    mockedSearch.mockResolvedValue([
      { id: 'skill-1', score: 0.95, namespace: 'skills', metadata: { name: 'Installed' } },
      { id: 'skill-2', score: 0.85, namespace: 'skills', metadata: { name: 'New' } },
    ]);
    mockedLoadSlugs.mockResolvedValue(new Map([['skill-2', 'new-slug']]));

    const result = await getVectorRecommendations(fakeAi, fakeVectorize, fakeDb, baseCtx);

    expect(result).toHaveLength(1);
    expect(result[0]!.skillSlug).toBe('new-slug');
  });

  it('returns at most 5 recommendations', async () => {
    mockedCollect.mockResolvedValue(signals({ integrationSlugs: ['github'] }));
    const matches = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
      score: 0.9,
      namespace: 'skills',
      metadata: { name: `Skill ${i}` },
    }));
    mockedSearch.mockResolvedValue(matches);
    mockedLoadSlugs.mockResolvedValue(
      new Map(Array.from({ length: 10 }, (_, i) => [`s${i}`, `slug-${i}`])),
    );

    const result = await getVectorRecommendations(fakeAi, fakeVectorize, fakeDb, baseCtx);
    expect(result).toHaveLength(5);
  });

  it('maps scores to priority tiers', async () => {
    mockedCollect.mockResolvedValue(signals({ integrationSlugs: ['github'] }));
    mockedSearch.mockResolvedValue([
      { id: 'hi', score: 0.9, namespace: 'skills', metadata: { name: 'Hi' } },
      { id: 'md', score: 0.7, namespace: 'skills', metadata: { name: 'Md' } },
      { id: 'lo', score: 0.4, namespace: 'skills', metadata: { name: 'Lo' } },
    ]);
    mockedLoadSlugs.mockResolvedValue(
      new Map([['hi', 'hi-s'], ['md', 'md-s'], ['lo', 'lo-s']]),
    );

    const result = await getVectorRecommendations(fakeAi, fakeVectorize, fakeDb, baseCtx);
    const byId = new Map(result.map((r) => [r.skillSlug, r.priority]));
    expect(byId.get('hi-s')).toBe('high');
    expect(byId.get('md-s')).toBe('medium');
    expect(byId.get('lo-s')).toBe('low');
  });

  it('drops matches whose slug cannot be resolved, and encodes score in signal', async () => {
    mockedCollect.mockResolvedValue(signals({ integrationSlugs: ['github'] }));
    mockedSearch.mockResolvedValue([
      { id: 'known', score: 0.87, namespace: 'skills', metadata: { name: 'Known' } },
      { id: 'orphan', score: 0.82, namespace: 'skills', metadata: { name: 'Orphan' } },
    ]);
    mockedLoadSlugs.mockResolvedValue(new Map([['known', 'known-slug']]));

    const result = await getVectorRecommendations(fakeAi, fakeVectorize, fakeDb, baseCtx);
    expect(result).toHaveLength(1);
    expect(result[0]!.skillSlug).toBe('known-slug');
    expect(result[0]!.signal).toBe('vector_match_0.87');
  });
});
