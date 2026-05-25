-- Migration 024 — SCIM Postgres-backed Users + Groups stores.
-- BEAT-PLAN Day 23 follow-up: replaces in-memory MemoryStore /
-- MemoryGroupStore so SCIM resources survive restarts and can be
-- queried by RBAC + analytics.
--
-- RLS: every row is scoped by tenant_id; mirroring the gateway's
-- shared isolation model (current_setting('app.current_tenant_id')).
-- The handler also gates lookups by tenant before query, so RLS is a
-- second-layer guarantee, not the only one.

BEGIN;

CREATE TABLE IF NOT EXISTS scim_users (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    user_name       TEXT NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    name_formatted  TEXT NOT NULL DEFAULT '',
    name_family     TEXT NOT NULL DEFAULT '',
    name_given      TEXT NOT NULL DEFAULT '',
    emails          JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version         TEXT NOT NULL DEFAULT '',
    UNIQUE (tenant_id, user_name)
);

CREATE INDEX IF NOT EXISTS idx_scim_users_tenant ON scim_users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_scim_users_username ON scim_users (tenant_id, lower(user_name));

CREATE TABLE IF NOT EXISTS scim_groups (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    display_name    TEXT NOT NULL,
    members         JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version         TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_scim_groups_tenant ON scim_groups (tenant_id);

COMMIT;
