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

## Enum Values
- **provider/platform**: github, gitlab, bitbucket
- **plan**: free, pro, team, enterprise
- **org role**: owner, admin, member
- **runner status**: online, offline, busy
- **run trigger**: push, pr, manual, schedule, api
- **run/job status**: queued, running, passed, failed, cancelled
- **step status**: pending, running, passed, failed, skipped
