# QueryLens — Sprint Plan

> **Read first:** `portfolio/QUALITY_STANDARDS.md`
> **Wave:** 5 · **Readiness:** 35% · **Stack:** TypeScript (NLP, REST API)
> **Timeline:** 7 days · **Ship by:** Week 12

---

## Pre-Sprint: Migrate to @finsavvyai Shared Libraries

### Agent A: NLP→SQL accuracy improvement with @finsavvyai/llm [PARALLEL]
**Prompt:**
Improve QueryLens natural language to SQL accuracy using `@finsavvyai/llm`. Build NLP pipeline: parse user query, extract intent, entities, constraints. Use multi-provider LLM chain for SQL generation (Anthropic → OpenAI → fallback). Implement few-shot prompting with examples of natural language → SQL mappings. Add query validation: check generated SQL syntax, ensure tables/columns exist. Implement confidence scoring (if confidence <80%, suggest alternatives). Cache identical queries. Test accuracy on diverse query types: simple selects, JOINs, aggregations, subqueries. Target 95%+ accuracy for common patterns. Log query/SQL pairs for continuous improvement. Ensure ≤200 lines per module. Run `npm audit` for zero high/critical vulnerabilities.

### Agent B: REST API for query submission [PARALLEL]
**Prompt:**
Build REST API for QueryLens natural language query service. Create endpoints: POST /api/v1/query/parse (convert natural language to SQL), GET /api/v1/databases/{id}/schema (return database schema for query context), POST /api/v1/query/execute (execute generated SQL and return results). Implement request validation using Zod. Add authentication (API key). Implement rate limiting (100 requests/min per user). Add request logging (query text, generated SQL, execution time). Implement error handling (invalid SQL, database connection errors). Support transaction mode (wrap execution in transaction). Add response pagination. Ensure all handler code ≤200 lines. Test with multiple database types (PostgreSQL, MySQL, SQLite).

---

## Sprint Tasks

### Agent C: Bundle with QueryFlux + testing [SEQUENTIAL]
**Prompt:**
Bundle QueryLens with QueryFlux desktop application. Integrate QueryLens NLP service as QueryFlux query input method (alternative to manual SQL editor). Add UI: natural language input box with autocomplete suggestions. Display generated SQL before execution (user can review/edit). Show query confidence score. Implement feedback loop: users can flag incorrect translations for model improvement. Create comprehensive test suite: @unit tests for NLP pipeline (mocked LLM), @integration tests with real database and QueryFlux backend, @e2e tests for full workflow (type query → see SQL → execute → results). Test QueryFlux + QueryLens together (both accessing same database). Target 95%+ coverage. Run `npm run test:coverage --fail_under=95`. Validate query accuracy on real databases.

---

## Quality Verification

### Agent QA: Full Quality Gate [SEQUENTIAL]
**Prompt:**
Execute comprehensive quality verification:

1. Coverage: `npm run test -- --coverage --fail_under=95` — must show ≥95%
2. Security: `npm audit` + `eslint-plugin-security` — zero high/critical findings
3. File size: All `.ts`/`.tsx` files ≤200 lines
4. NLP accuracy: ≥95% accuracy on common query patterns
5. SQL generation: Generated SQL syntactically valid and executable
6. LLM integration: Multi-provider fallback working (mocked providers)
7. Query validation: Invalid SQL detected and reported
8. Confidence scoring: Confidence scores accurate (calibrated with accuracy)
9. Caching: Identical queries cached and retrieved correctly
10. API endpoints: All tested with contract tests
11. Rate limiting: 100 req/min enforced per user
12. Authentication: API key validation working
13. QueryFlux integration: NLP input working in desktop app
14. User feedback: Incorrect translations logged for model improvement
15. Database compatibility: Works with PostgreSQL, MySQL, SQLite
16. Performance: Query generation <2s, execution variable

Report any blockers. All checks must pass.

---

## Quality Gate Checklist
□ 95%+ test coverage (vitest/jest)
□ ≤200 lines per source file (.ts, .tsx)
□ Security scan clean (npm audit, eslint-plugin-security — zero high/critical)
□ No secrets in code (env vars only, no API keys)
□ NLP→SQL accuracy ≥95% on common patterns
□ Generated SQL valid and executable
□ @finsavvyai/llm integrated with multi-provider fallback
□ Few-shot prompting with examples working
□ Query validation checking SQL syntax and schema
□ Confidence scoring calibrated
□ Query caching working
□ REST API endpoints implemented and tested
□ Authentication (API key) working
□ Rate limiting enforced (100 req/min)
□ Request/response validation (Zod)
□ QueryFlux desktop integration working
□ NLP input UI in QueryFlux
□ Generated SQL visible for review
□ User feedback mechanism for model improvement
□ Database compatibility verified (PostgreSQL, MySQL, SQLite)
□ Performance targets met (<2s for generation)
