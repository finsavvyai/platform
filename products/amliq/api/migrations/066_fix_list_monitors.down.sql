-- Reverts 066_fix_list_monitors. Note: narrowing column types back
-- to VARCHAR(20) will fail if any existing row exceeds 20 chars.
-- Included for symmetry; not expected to be run in practice.

DELETE FROM tenants WHERE id = '__global__';

ALTER TABLE list_monitors ALTER COLUMN list_source TYPE VARCHAR(50);
ALTER TABLE list_monitors ALTER COLUMN tenant_id TYPE VARCHAR(20);
ALTER TABLE list_monitors ALTER COLUMN id TYPE VARCHAR(20);
