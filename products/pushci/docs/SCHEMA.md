# PushCI Core Database Schema (PostgreSQL)

All PKs are `UUID DEFAULT gen_random_uuid()`. All timestamps are `TIMESTAMPTZ DEFAULT now()`.

## users
`id` PK, `email` VARCHAR(255) NOT NULL UNIQUE, `name` VARCHAR(100) NOT NULL,
`avatar_url` TEXT, `provider` VARCHAR(20) NOT NULL, `provider_id` VARCHAR(100) NOT NULL,
`created_at` ts. UNIQUE(provider, provider_id).

## organizations
`id` PK, `name` VARCHAR(100) NOT NULL, `slug` VARCHAR(100) NOT NULL UNIQUE,
`plan` VARCHAR(20) NOT NULL DEFAULT 'free', `created_at` ts.

## org_members
`org_id` UUID FK organizations ON DELETE CASCADE, `user_id` UUID FK users ON DELETE CASCADE,
`role` VARCHAR(20) NOT NULL DEFAULT 'member', `joined_at` ts. PK(org_id, user_id).

## project_memberships
`project_id` UUID FK repositories ON DELETE CASCADE,
`user_id` UUID FK users ON DELETE CASCADE,
`role` VARCHAR(30) NOT NULL,
`environments` TEXT[] DEFAULT '{}',
`created_at` ts, `updated_at` ts. PK(project_id, user_id).

## repositories
`id` PK, `org_id` UUID NOT NULL FK organizations CASCADE, `name` VARCHAR(255) NOT NULL,
`full_name` VARCHAR(512) NOT NULL, `platform` VARCHAR(20) NOT NULL,
`clone_url` TEXT NOT NULL, `webhook_secret` VARCHAR(255) NOT NULL,
`created_at` ts. UNIQUE(org_id, full_name).

## runners
`id` PK, `org_id` UUID NOT NULL FK organizations CASCADE, `name` VARCHAR(100) NOT NULL,
`token_hash` VARCHAR(128) NOT NULL, `status` VARCHAR(20) NOT NULL DEFAULT 'offline',
`labels` TEXT[] DEFAULT '{}', `last_heartbeat` TIMESTAMPTZ, `ip` INET,
`os` VARCHAR(20), `arch` VARCHAR(20), `created_at` ts.

## pipelines
`id` PK, `repo_id` UUID NOT NULL FK repositories CASCADE, `name` VARCHAR(100) NOT NULL,
`yaml_content` TEXT NOT NULL, `created_at` ts, `updated_at` ts.

## pipeline_runs
`id` PK, `pipeline_id` UUID NOT NULL FK pipelines CASCADE,
`repo_id` UUID NOT NULL FK repositories, `trigger` VARCHAR(20) NOT NULL,
`branch` VARCHAR(255) NOT NULL, `sha` VARCHAR(40) NOT NULL,
`status` VARCHAR(20) NOT NULL DEFAULT 'queued', `started_at` TIMESTAMPTZ,
`finished_at` TIMESTAMPTZ, `duration_ms` INT.

## jobs
`id` PK, `run_id` UUID NOT NULL FK pipeline_runs CASCADE, `name` VARCHAR(100) NOT NULL,
`status` VARCHAR(20) NOT NULL DEFAULT 'queued', `runner_id` UUID FK runners SET NULL,
`started_at` TIMESTAMPTZ, `finished_at` TIMESTAMPTZ, `depends_on` UUID[] DEFAULT '{}'.

## steps
`id` PK, `job_id` UUID NOT NULL FK jobs CASCADE, `name` VARCHAR(100) NOT NULL,
`command` TEXT NOT NULL, `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
`exit_code` SMALLINT, `started_at` TIMESTAMPTZ, `finished_at` TIMESTAMPTZ.

## secrets
`id` PK, `org_id` UUID NOT NULL FK organizations CASCADE,
`repo_id` UUID FK repositories CASCADE (NULL = org-level),
`key` VARCHAR(100) NOT NULL, `encrypted_value` TEXT NOT NULL,
`created_at` ts. UNIQUE(org_id, repo_id, key).

## artifacts
`id` PK, `run_id` UUID NOT NULL FK pipeline_runs CASCADE,
`name` VARCHAR(255) NOT NULL, `path` TEXT NOT NULL,
`size_bytes` BIGINT NOT NULL, `uploaded_at` ts.

## audit_logs
`id` PK, `org_id` UUID NOT NULL FK organizations CASCADE,
`user_id` UUID FK users SET NULL, `action` VARCHAR(50) NOT NULL,
`resource` VARCHAR(100) NOT NULL, `details` JSONB DEFAULT '{}',
`created_at` ts. INDEX(org_id, created_at DESC).

## deployment_policies
`project_id` UUID FK repositories ON DELETE CASCADE,
`environment` VARCHAR(50) NOT NULL,
`required_review_approvals` INT NOT NULL DEFAULT 0,
`required_manual_approvals` INT NOT NULL DEFAULT 0,
`require_protected_branch` BOOL NOT NULL DEFAULT false,
`require_separation_of_duties` BOOL NOT NULL DEFAULT false,
`created_at` ts, `updated_at` ts. PK(project_id, environment).

## deployment_requests
`id` PK, `project_id` UUID FK repositories ON DELETE CASCADE,
`environment` VARCHAR(50) NOT NULL, `branch` VARCHAR(255) NOT NULL,
`sha` VARCHAR(40), `run_id` UUID FK pipeline_runs SET NULL,
`requested_by` UUID FK users, `executed_by` UUID FK users SET NULL,
`status` VARCHAR(30) NOT NULL DEFAULT 'blocked',
`review_count` INT NOT NULL DEFAULT 0,
`protected_branch` BOOL NOT NULL DEFAULT false,
`actor_is_author` BOOL NOT NULL DEFAULT false,
`tests_passed` BOOL NOT NULL DEFAULT false,
`secret_leak` BOOL NOT NULL DEFAULT false,
`has_sbom` BOOL NOT NULL DEFAULT false,
`policy_reason` TEXT, `created_at` ts, `updated_at` ts.

## deployment_approvals
`request_id` UUID FK deployment_requests ON DELETE CASCADE,
`approver_id` UUID FK users ON DELETE CASCADE,
`created_at` ts. PK(request_id, approver_id).

## Enum Values
- **provider/platform**: github, gitlab, bitbucket
- **plan**: free, pro, team, enterprise
- **org role**: owner, admin, member
- **project role**: admin, maintainer, release_manager, deploy_approver, developer, viewer, auditor
- **runner status**: online, offline, busy
- **run trigger**: push, pr, manual, schedule, api
- **run/job status**: queued, running, passed, failed, cancelled
- **step status**: pending, running, passed, failed, skipped
- **deployment request status**: blocked, awaiting_approval, approved, queued, executed
