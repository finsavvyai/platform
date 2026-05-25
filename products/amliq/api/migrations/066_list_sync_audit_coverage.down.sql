-- 066: drop field coverage stats.

ALTER TABLE list_sync_audit
    DROP COLUMN IF EXISTS entities_parsed,
    DROP COLUMN IF EXISTS entities_with_dob,
    DROP COLUMN IF EXISTS entities_with_nat,
    DROP COLUMN IF EXISTS entities_with_addr,
    DROP COLUMN IF EXISTS entities_with_ids,
    DROP COLUMN IF EXISTS entities_with_aliases;
