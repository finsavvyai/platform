# ADR-001: Backend Architecture Choice

**Status:** ACCEPTED
**Date:** 2025-12-14
**Deciders:** Engineering Team, Product Lead

## Context

The Qestro platform had TWO complete backend implementations:

1. **Cloudflare Workers** (in `/src/`)
   - Serverless edge computing
   - Global distribution
   - Auto-scaling
   - Lower operational costs

2. **Node.js/Express** (in `/backend/`)
   - Traditional server architecture
   - Mature ecosystem
   - Team familiarity
   - More library options

This duplication created maintenance burden and confusion.

## Decision

**We chose Node.js/Express.**

## Rationale

- **Completeness:** The Node.js implementation was 60-75% complete vs Cloudflare's 40-50%.
- **Time to Market:** Faster path to MVP (estimated 1-2 weeks vs 3-4 weeks).
- **API Surface:** More complete API surface (43 endpoints vs 2).
- **Productivity:** Team familiarity with Node.js allows for higher productivity immediately.

## Consequences

### Positive
- Accelerated MVP timeline.
- Leveraging existing team expertise.
- Access to vast NPM ecosystem without worker constraints.

### Negative
- Higher potential operational costs compared to serverless.
- Necessity to manage infrastructure scaling eventually.

### Neutral
- Database schema migration required (consolidating to PostgreSQL/Supabase likely, or using D1 via proxy if needed, but likely PostgreSQL for Node.js).

## Alternatives Considered

### Alternative 1: Cloudflare Workers
- **Pros:** Cheaper, global scale.
- **Cons:** Learning curve, implementation was less mature, some constraints on libraries.
- **Why not chosen:** Time to market was critical.

## References
- [PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md)
- [STATUS.md](../../../STATUS.md)
