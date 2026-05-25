-- Migration 031 — seed projects RBAC permissions.
-- Wires the Day-53 /v1/projects surface into the RBAC system
-- (Day 21 / migration 010). Without these rows the RequirePermission
-- gates added in A3 always deny, so the seed is mandatory before
-- any project operations can succeed for gated tenants.
--
-- admin + owner roles receive read + write + delete.
-- member role receives read only.

INSERT INTO rbac_permissions (name, description)
VALUES
  ('projects:read',   'List and view shared projects'),
  ('projects:write',  'Create and update shared projects and membership'),
  ('projects:delete', 'Delete shared projects')
ON CONFLICT (name) DO NOTHING;

INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r
CROSS JOIN rbac_permissions p
WHERE r.name IN ('admin', 'owner')
  AND p.name IN ('projects:read', 'projects:write', 'projects:delete')
ON CONFLICT DO NOTHING;

INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r
CROSS JOIN rbac_permissions p
WHERE r.name = 'member'
  AND p.name = 'projects:read'
ON CONFLICT DO NOTHING;
