# Sprint 29: Full CSPM — Implementation Plan

**Status**: Complete
**Tests**: 1,156 passing (107 test files)
**Typecheck**: Clean

## Phase 1: Additional AWS Check Modules
- [x] 1.1 Lambda security checks (public functions, runtime EOL, VPC config)
- [x] 1.2 KMS key checks (key rotation, public access)
- [x] 1.3 VPC flow log checks (flow logs enabled)
- [x] 1.4 Lambda/KMS request helpers
- [x] 1.5 Update orchestrator to include new checks (Lambda, KMS, VPC)
- [x] 1.6 Tests for all new check modules (Lambda 4, KMS 3, VPC 2)

## Phase 2: Drift Detection
- [x] 2.1 Finding comparison between scans (`cspm-drift.ts`)
- [x] 2.2 New/resolved/unchanged finding tracking
- [x] 2.3 Drift detection tests (2 tests)

## Phase 3: Risk Scoring
- [x] 3.1 Per-resource risk score calculation (weighted by severity)
- [x] 3.2 Per-account + per-org risk score aggregation
- [x] 3.3 Risk score API endpoints (3 routes)
- [x] 3.4 Risk score tests (5 tests)

## Phase 4: Registration
- [x] 4.1 Register CSPM risk routes in `register.ts`
- [x] 4.2 Update AWSService type to include lambda/kms/vpc
- [x] 4.3 Typecheck + test validation
