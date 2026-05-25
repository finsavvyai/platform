# Sprint 31: Credential Lifecycle + Agent Secret Access — Implementation Plan

## Phase 1: Schema
- [x] 1.1 Vault rotation policy schema
- [x] 1.2 JIT access request schema
- [x] 1.3 Agent secret access schema

## Phase 2: Services
- [x] 2.1 Rotation policy evaluator
- [x] 2.2 JIT access manager
- [x] 2.3 Service tests

## Phase 3: API Routes
- [x] 3.1 Secret rotation policy routes (CRUD + evaluate)
- [x] 3.2 JIT access request routes (create, approve, deny, expire)
- [x] 3.3 Agent secret access report route (list, filter by agent, log)
- [x] 3.4 Register routes (split register.ts into register + register-admin)
- [x] 3.5 Route tests

## Phase 4: Validation
- [x] 4.1 Typecheck clean
- [x] 4.2 All Sprint 31 tests pass (18 tests)
