-- ============================================================================
-- Migration 0008: Organizations, RBAC, and Multi-Tenancy
-- ============================================================================

-- Organizations
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  plan TEXT NOT NULL DEFAULT 'free',
  max_instances INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_organizations_owner ON organizations(owner_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- Organization Members
CREATE TABLE org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'viewer',
  invited_by TEXT REFERENCES users(id),
  invited_at TEXT NOT NULL,
  accepted_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_org ON org_members(org_id);
CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_org_members_org_user_status ON org_members(org_id, user_id, status);

-- Organization Invitations
CREATE TABLE org_invitations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  invited_by TEXT NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX idx_org_invitations_token ON org_invitations(token);
CREATE INDEX idx_org_invitations_org ON org_invitations(org_id);
CREATE INDEX idx_org_invitations_email ON org_invitations(email);

-- Add orgId to existing tables (nullable for backward compatibility)
ALTER TABLE instances ADD COLUMN org_id TEXT REFERENCES organizations(id);
CREATE INDEX idx_instances_org ON instances(org_id);

ALTER TABLE security_policies ADD COLUMN org_id TEXT REFERENCES organizations(id);
ALTER TABLE incidents ADD COLUMN org_id TEXT REFERENCES organizations(id);
