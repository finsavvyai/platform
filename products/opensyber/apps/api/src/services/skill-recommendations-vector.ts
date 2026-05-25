/**
 * Vector-based Skill Recommendation Engine
 *
 * Uses semantic similarity (Cloudflare Vectorize + bge-base-en-v1.5)
 * to match a user's context to skills in the marketplace. Returns an
 * empty array when AI/Vectorize bindings are unavailable so that callers
 * can fall back to the rule-based engine.
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { semanticSearch } from './vector-search.js';
import type { SkillRecommendation } from './skill-recommendations.js';
import {
  collectUserSignals,
  loadSlugsByIds,
} from './skill-recommendations-signals.js';
import type {
  SignalContext,
  UserSignals,
} from './skill-recommendations-signals.js';

const MAX_RECOMMENDATIONS = 5;
const SEARCH_TOP_K = 20;
const CONTEXT_MAX_LENGTH = 512;

type Db = DrizzleD1Database<Record<string, unknown>>;

export type VectorRecommendationContext = SignalContext;

interface VectorMatch {
  id: string;
  score: number;
  metadata: Record<string, string>;
}

/**
 * Generate skill recommendations using semantic vector search.
 *
 * @param ai         Cloudflare Workers AI binding (optional).
 * @param vectorize  Cloudflare Vectorize index binding (optional).
 * @param db         Drizzle D1 database.
 * @param ctx        User context — userId, orgId, instanceIds.
 * @returns          Up to 5 recommendations; empty if bindings missing.
 */
export async function getVectorRecommendations(
  ai: Ai | undefined,
  vectorize: VectorizeIndex | undefined,
  db: Db,
  ctx: VectorRecommendationContext,
): Promise<SkillRecommendation[]> {
  if (!ai || !vectorize) return [];

  const signals = await collectUserSignals(db, ctx);
  const query = buildContextQuery(signals);
  if (!query) return [];

  const matches = await semanticSearch(ai, vectorize, query, {
    namespace: 'skills',
    topK: SEARCH_TOP_K,
  });

  const filtered = matches
    .filter((m) => !signals.installedSkillIds.has(m.id))
    .slice(0, MAX_RECOMMENDATIONS);

  if (filtered.length === 0) return [];

  const slugById = await loadSlugsByIds(
    db,
    filtered.map((m) => m.id),
  );

  return filtered
    .map((match) => toRecommendation(match, slugById, query))
    .filter((rec): rec is SkillRecommendation => rec !== null);
}

function toRecommendation(
  match: VectorMatch,
  slugById: Map<string, string>,
  query: string,
): SkillRecommendation | null {
  const slug = slugById.get(match.id);
  if (!slug) return null;

  const name = match.metadata['name'] ?? slug;
  const contextHint = query.slice(0, 60);
  return {
    skillSlug: slug,
    reason: `Matches your stack (${contextHint}…): ${name}`,
    priority: priorityFromScore(match.score),
    signal: `vector_match_${match.score.toFixed(2)}`,
  };
}

function priorityFromScore(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

/**
 * Build a natural-language query from a user's stack signals.
 *
 * Example: "User has github, slack integrations, has cloud accounts
 * connected, uses slack, pagerduty for alerts, already has 3 skills
 * installed — needs complementary security tools and monitoring skills"
 */
export function buildContextQuery(signals: UserSignals): string {
  const parts: string[] = [];

  if (signals.integrationSlugs.length > 0) {
    parts.push(`has ${signals.integrationSlugs.join(', ')} integrations`);
  }
  if (signals.hasCloudAccounts) {
    parts.push('has cloud accounts connected');
  }
  if (signals.alertChannelTypes.length > 0) {
    parts.push(`uses ${signals.alertChannelTypes.join(', ')} for alerts`);
  }
  if (signals.installedSkillIds.size > 0) {
    parts.push(`already has ${signals.installedSkillIds.size} skills installed`);
  }

  // Require at least one positive signal before issuing a vector query —
  // new users with no context fall through to the rule-based engine.
  if (parts.length === 0) return '';

  const query = `User ${parts.join(', ')} — needs complementary security tools and monitoring skills`;
  return query.slice(0, CONTEXT_MAX_LENGTH);
}
