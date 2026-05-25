-- Entity change history for audit trail and compliance
-- Tracks: added, updated, removed from sanctions lists
CREATE TABLE IF NOT EXISTS entity_history (
    id BIGSERIAL,
    entity_id VARCHAR(20) NOT NULL,
    tenant_id VARCHAR(20) NOT NULL,
    list_id VARCHAR(100),
    full_name VARCHAR(500),
    change_type VARCHAR(20) NOT NULL, -- 'added', 'updated', 'removed'
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    snapshot JSONB, -- full entity state at time of change
    PRIMARY KEY (id, changed_at)
) PARTITION BY RANGE (changed_at);

-- Monthly partitions (auto-create for next 24 months)
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..23 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'entity_history_' || TO_CHAR(start_date, 'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF entity_history
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        start_date := end_date;
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_entity_history_entity
    ON entity_history (entity_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_history_list
    ON entity_history (list_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_history_tenant
    ON entity_history (tenant_id, changed_at DESC);

-- Partition screenings table by month for scalability
-- (only if not already partitioned)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_partitioned_table
        WHERE partrelid = 'screenings'::regclass
    ) THEN
        RAISE NOTICE 'screenings not partitioned — partition on next major migration';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'screenings partition check skipped';
END $$;

-- Retention policy: add archive flag to screenings
ALTER TABLE screenings ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_screenings_archived
    ON screenings (archived, created_at) WHERE NOT archived;

-- Add soft-delete tracking to entities
ALTER TABLE entities ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_entities_removed
    ON entities (removed_at) WHERE removed_at IS NOT NULL;
