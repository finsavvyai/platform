# SDLC Platform — FinsavvyAI Boost Plan

> Generated: 2026-04-08

## Executive Summary

SDLC Platform is **connected to Claw Gateway** but uses **0 of 12 @finsavvyai shared packages** and **0 of 8 intelligence features**. The platform has built parallel implementations for auth, billing, and monitoring that should be consolidated. Estimated savings: 3,000+ lines of custom code replaced with shared libs, 30-60% LLM token savings via intelligence features.

---

## Phase 1: Quick Wins (1-2 days each)

### 1.1 Adopt @finsavvyai/test-config
- **Effort**: 2 hours
- **Impact**: Consistent test setup across all packages
- **Action**: Replace custom vitest.config.ts and playwright.config.ts with shared presets
- **Files**: All `vitest.config.*` and `playwright.config.*` across 8+ packages

### 1.2 Adopt @finsavvyai/monitor
- **Effort**: 1 day
- **Impact**: Replace fragmented Winston + Pino + custom Sentry setup with unified logger
- **Action**: 
  - Replace `services/document-processor/app/utils/logger.ts` (191 lines) with @finsavvyai/monitor
  - Replace `services/realtime` Winston setup
  - Unify structured logging format across all services
- **Files**: 6-8 logger files across services

### 1.3 Enable ReasoningBank for RAG queries
- **Effort**: 4 hours
- **Impact**: 30% token savings on repeated queries
- **Action**: Add KV caching layer before Claw Gateway calls in RAG service
- **Files**: `services/rag/main.py`, gateway LLM routing

---

## Phase 2: Core Consolidation (3-5 days each)

### 2.1 Migrate billing to @finsavvyai/pay
- **Effort**: 3 days
- **Impact**: Remove ~800 lines of custom billing code, unified Stripe+LS handling
- **Action**:
  - Replace `packages/shared-billing/src/worker.ts` internals with @finsavvyai/pay
  - Keep SDLC-specific usage metering and tenant billing logic
  - Migrate webhook handlers to shared format
- **Dependencies**: Test with existing Stripe/LS accounts

### 2.2 Wrap auth with @finsavvyai/auth
- **Effort**: 3 days
- **Impact**: Shared JWT/RBAC patterns, but SDLC needs 2FA extension
- **Action**:
  - Use @finsavvyai/auth as base for JWT + RBAC
  - Keep speakeasy 2FA as SDLC-specific extension
  - Migrate `packages/shared-dashboard/src/worker/auth.ts` (469 lines) to use shared verifiers
  - Migrate `packages/shared-dashboard/src/worker/crypto-utils.ts` (274 lines)
- **Risk**: Auth is critical path — needs 100% test coverage before and after

### 2.3 Enable Smart Router for LLM calls
- **Effort**: 2 days
- **Impact**: Auto-select cheapest viable model per query complexity
- **Action**: Add Smart Router client between SDLC gateway and Claw Gateway
- **Files**: LLM gateway service configuration

---

## Phase 3: Intelligence Features (1-2 days each)

### 3.1 Enable Context Packing for document chunks
- **Effort**: 1 day
- **Impact**: 40-60% token savings on large document processing
- **Action**: Add context trimming before embedding and LLM calls
- **Files**: `services/document-processor/`, `services/rag/`

### 3.2 Enable Agent Booster for DLP transforms
- **Effort**: 1 day
- **Impact**: Skip LLM calls for deterministic DLP pattern matching (<1ms vs 500ms+)
- **Action**: Route simple PII detection/masking through WASM instead of LLM
- **Files**: `services/dlp/`, DLP engine modules

### 3.3 Enable Hybrid Search (RRF) for RAG
- **Effort**: 2 days
- **Impact**: Better retrieval quality with sparse+dense fusion
- **Action**: Add BM25 sparse search alongside pgvector dense search, fuse with RRF
- **Files**: `services/rag/`, vector search modules

### 3.4 Add Self-Learning SDK to sdk-ts
- **Effort**: 2 days
- **Impact**: Client-side caching + outcome tracking for SDK consumers
- **Action**: Wrap `packages/sdk-ts/` with self-learning layer
- **Files**: SDK client modules

---

## Phase 4: UI Unification (3-5 days)

### 4.1 Adopt @finsavvyai/ui design tokens
- **Effort**: 2 days
- **Impact**: Consistent design language across landing, admin, dashboard
- **Action**: Replace divergent tailwind configs with shared tokens
- **Files**: All `tailwind.config.*`, `globals.css` files

### 4.2 HeyGen-style dark UI transformation
- **Effort**: 5 days
- **Impact**: Professional dark mode across all surfaces
- **Action**: See separate HeyGen transformation plan
- **Surfaces**: Landing page, Admin UI, Developer Portal, Shared Dashboard

---

## Phase 5: Cross-Project Integration (5-10 days)

### 5.1 Export DLP engine for PipeWarden
- **Effort**: 5 days
- **Action**: Package DLP rules and engine as shared module

### 5.2 Export RAG pipeline for Coderail
- **Effort**: 5 days
- **Action**: Create RAG-as-a-service API for other portfolio products

### 5.3 Security Suite bundle packaging
- **Effort**: 3 days
- **Action**: Create combined pricing page, shared onboarding flow

---

## Priority Matrix

| Action | Effort | Impact | Priority |
|--------|--------|--------|----------|
| @finsavvyai/test-config | 2h | Medium | **P0** |
| @finsavvyai/monitor | 1d | High | **P0** |
| ReasoningBank | 4h | High | **P0** |
| @finsavvyai/pay migration | 3d | High | **P1** |
| Smart Router | 2d | High | **P1** |
| @finsavvyai/auth wrap | 3d | Medium | **P1** |
| Context Packing | 1d | High | **P2** |
| Agent Booster for DLP | 1d | Medium | **P2** |
| Hybrid Search | 2d | High | **P2** |
| Self-Learning SDK | 2d | Medium | **P3** |
| UI unification | 5d | Medium | **P3** |
| Cross-project exports | 10d | High | **P4** |

## Estimated Total Impact

- **Code reduction**: ~3,000 lines replaced with shared libs
- **Token savings**: 30-60% via ReasoningBank + Context Packing + Smart Router
- **DLP latency**: 500x improvement on simple patterns (LLM -> WASM)
- **Maintenance**: Single update point for auth/billing/monitoring across portfolio
- **Revenue**: Security Suite bundle pricing at $25K-50K/mo enterprise tier
