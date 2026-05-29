# Entity Relationship Diagram - SDLC.ai Database

## Overview

This document describes the entity relationships in the SDLC.ai multi-tenant database system. The database follows a tenant-centric design with proper data isolation and comprehensive security features.

## Core Entity Relationships

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     tenants     │◄──────┤      users      │◄──────┤  user_sessions  │
│                 │ 1:N   │                 │ 1:N   │                 │
│ • id (PK)       │       │ • id (PK)       │       │ • id (PK)       │
│ • name          │       │ • tenant_id (FK)│       │ • user_id (FK)  │
│ • domain        │       │ • email         │       │ • tenant_id (FK)│
│ • status        │       │ • role          │       │ • session_token │
│ • subscription  │       │ • is_active     │       │ • expires_at    │
│ • resource_limits│      │ • profile       │       │ • is_active     │
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │                         │
         │                         │
         │ 1:N                     │ 1:N
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│   tenant_quotas │       │     api_keys    │
│                 │       │                 │
│ • tenant_id (FK)│       │ • tenant_id (FK)│
│ • quota_type    │       │ • user_id (FK)  │
│ • current_limit │       │ • key_hash      │
│ • current_usage │       │ • permissions   │
│ • reset_frequency│      │ • rate_limit    │
└─────────────────┘       └─────────────────┘
```

## Document Management Relationships

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     users       │◄──────┤    documents    │◄──────┤ document_chunks │
│                 │ 1:N   │                 │ 1:N   │                 │
│ • id (PK)       │       │ • id (PK)       │       │ • id (PK)       │
│ • tenant_id (FK)│       │ • tenant_id (FK)│       │ • document_id(FK)│
│ • email         │       │ • created_by(FK)│       │ • tenant_id (FK)│
│ • role          │       │ • filename      │       │ • chunk_index   │
└─────────────────┘       │ • content_type  │       │ • content       │
         │                │ • file_size     │       │ • embedding     │
         │                │ • classification│       └─────────────────┘
         │ 1:N            │ • processing    │                 │
         ▼                │ • status        │                 │ 1:N
┌─────────────────┐       └─────────────────┘                 ▼
│ api_keys        │                       │ 1:N       ┌─────────────────┐
│                 │                       ▼           │ embedding_jobs  │
│ • tenant_id (FK)│       ┌─────────────────┐           │                 │
│ • user_id (FK)  │       │document_processing│         │ • chunk_id (FK) │
│ • key_hash      │       │     _jobs       │           │ • tenant_id (FK)│
└─────────────────┘       │                 │           │ • status        │
                          │ • document_id(FK)│         │ • model_name    │
                          │ • tenant_id (FK)│         │ • provider      │
                          │ • job_type      │           └─────────────────┘
                          │ • status        │
                          │ • priority      │
                          └─────────────────┘
```

## Policy and Security Relationships

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     users       │◄──────┤     policies    │◄──────┤policy_evaluations│
│                 │ 1:N   │                 │ 1:N   │                 │
│ • id (PK)       │       │ • id (PK)       │       │ • id (PK)       │
│ • tenant_id (FK)│       │ • tenant_id (FK)│       │ • tenant_id (FK)│
│ • email         │       │ • created_by(FK)│       │ • policy_id (FK)│
│ • role          │       │ • name          │       │ • user_id (FK)  │
└─────────────────┘       │ • type          │       │ • decision      │
         │                │ • rego_policy   │       │ • execution_time│
         │                │ • version       │       └─────────────────┘
         │ 1:N            │ • is_active     │                 │
         ▼                └─────────────────┘                 │ 1:N
┌─────────────────┐                       │                 ▼
│     dlp_scans   │       ┌─────────────────┐       ┌─────────────────┐
│                 │       │    audit_logs   │       │document_access_ │
│ • tenant_id (FK)│       │                 │       │      log        │
│ • content_id    │       │ • tenant_id (FK)│       │                 │
│ • content_type  │       │ • user_id (FK)  │       │ • document_id(FK)│
│ • risk_score    │       │ • action        │       │ • tenant_id (FK)│
│ • action_taken  │       │ • resource_type │       │ • user_id (FK)  │
│ • scan_results  │       │ • resource_id   │       │ • action        │
└─────────────────┘       │ • ip_address    │       │ • access_granted│
                          │ • risk_level    │       └─────────────────┘
                          │ • correlation_id│
                          └─────────────────┘
```

## Usage Analytics and Billing Relationships

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     users       │◄──────┤   token_usage   │◄──────┤vector_search_   │
│                 │ 1:N   │                 │ 1:N   │     logs        │
│ • id (PK)       │       │ • id (PK)       │       │                 │
│ • tenant_id (FK)│       │ • tenant_id (FK)│       │ • tenant_id (FK)│
│ • email         │       │ • user_id (FK)  │       │ • user_id (FK)  │
│ • role          │       │ • api_key_id(FK)│       │ • query_text    │
└─────────────────┘       │ • provider      │       │ • search_type   │
         │                │ • model         │       │ • results_count │
         │ 1:N            │ • tokens_used   │       │ • search_duration│
         ▼                │ • cost_usd      │       └─────────────────┘
┌─────────────────┐       │ • request_id    │                 │
│   api_keys      │       └─────────────────┘                 │ 1:N
│                 │                       │                 ▼
│ • tenant_id (FK)│       ┌─────────────────┐       ┌─────────────────┐
│ • user_id (FK)  │       │compliance_reports│     │tenant_statistics│
│ • key_hash      │       │                 │       │ (Materialized   │
└─────────────────┘       │ • tenant_id (FK)│       │    View)        │
                          │ • report_type   │       │                 │
                          │ • status        │       │ • tenant_id     │
                          │ • report_period │       │ • total_users   │
                          │ • findings      │       │ • total_docs    │
                          │ • recommendations│      │ • storage_bytes │
                          └─────────────────┘       │ • total_cost    │
                                                   └─────────────────┘
```

## Complete Entity Relationship Summary

### Primary Entity Categories

1. **Tenant Management**
   - `tenants` - Central tenant entity
   - `tenant_quotas` - Resource quota management
   - `compliance_reports` - Compliance tracking

2. **User Management**
   - `users` - User accounts and roles
   - `user_sessions` - Active session tracking
   - `api_keys` - Service authentication

3. **Document Management**
   - `documents` - Document metadata and storage
   - `document_chunks` - Text chunks for RAG
   - `document_processing_jobs` - Async processing
   - `embedding_jobs` - Vector embedding generation

4. **Security & Policy**
   - `policies` - OPA policies storage
   - `policy_evaluations` - Policy decision audit
   - `dlp_scans` - Data loss prevention results
   - `audit_logs` - Comprehensive audit trail
   - `document_access_log` - Document access tracking

5. **Analytics & Usage**
   - `token_usage` - LLM token consumption
   - `vector_search_logs` - Search query analytics
   - `tenant_statistics` - Aggregated metrics

### Key Relationships

1. **Tenant Hierarchy** (1:N relationships)
   - `tenants` → `users`
   - `tenants` → `documents`
   - `tenants` → `policies`
   - `tenants` → `api_keys`
   - `tenants` → `audit_logs`
   - `tenants` → `token_usage`

2. **User Hierarchy** (1:N relationships)
   - `users` → `documents` (created_by)
   - `users` → `policies` (created_by)
   - `users` → `user_sessions`
   - `users` → `api_keys`

3. **Document Hierarchy** (1:N relationships)
   - `documents` → `document_chunks`
   - `documents` → `document_processing_jobs`
   - `document_chunks` → `embedding_jobs`

4. **Policy Hierarchy** (1:N relationships)
   - `policies` → `policy_evaluations`

5. **Cross-Entity Relationships**
   - `users` → `token_usage` (usage tracking)
   - `api_keys` → `token_usage` (API usage)
   - `users` → `vector_search_logs` (search analytics)
   - `documents` → `document_access_log` (access tracking)

### Foreign Key Constraints

```sql
-- Tenant constraints
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE

-- User constraints
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE/SET NULL

-- Document constraints
FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE

-- Policy constraints
FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE SET NULL
```

### Index Strategy

**Primary Indexes:**
- All UUID primary keys
- Unique constraints on natural keys

**Foreign Key Indexes:**
- All tenant_id columns for multi-tenant queries
- All user_id columns for user-scoped queries
- All document_id columns for document relationships

**Functional Indexes:**
- Vector similarity search indexes (HNSW)
- Time-based indexes for analytics queries
- Composite indexes for common query patterns

### Data Flow Patterns

1. **Document Upload Flow:**
   ```
   User → API Key → Document → Processing Jobs → Chunks → Embeddings
   ```

2. **Policy Evaluation Flow:**
   ```
   User Request → Policy Evaluation → Decision → Audit Log
   ```

3. **Vector Search Flow:**
   ```
   User Query → Vector Embedding → Similarity Search → Results → Audit Log
   ```

4. **Usage Tracking Flow:**
   ```
   API Request → Token Usage → Cost Calculation → Quota Check → Billing
   ```

This entity relationship design ensures proper data isolation, comprehensive audit trails, and optimal query performance for the SDLC.ai platform's multi-tenant architecture.