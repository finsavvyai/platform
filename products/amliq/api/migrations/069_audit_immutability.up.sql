-- Audit-table immutability — make the "append-only" claim true.
--
-- soc2_readiness.md §1.3 and israel.md §2 both claim that audit
-- entries cannot be modified once written. Until this migration the
-- claim was enforced only by application convention; nothing stopped
-- a privileged DB session from running UPDATE or DELETE. This
-- migration installs a row-level trigger that raises an exception on
-- any UPDATE or DELETE attempt against audit_entries and audit_events,
-- which is what an auditor will look for when verifying the control.
--
-- Retention purges still need to remove rows past the 7-year horizon.
-- We deliberately do NOT carve out an exception for the retention
-- worker here — anything older than 7 years is purged via a
-- table-rotation script the operator runs out-of-band, with the
-- session-level setting `aegis.allow_audit_purge=on` so the trigger
-- can detect a sanctioned purge and let it through. The retention
-- worker in cmd/worker/retention_loop.go does NOT touch audit tables.

CREATE OR REPLACE FUNCTION aegis_block_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF current_setting('aegis.allow_audit_purge', true) = 'on' THEN
        RETURN COALESCE(OLD, NEW);
    END IF;
    RAISE EXCEPTION 'audit table is append-only; UPDATE/DELETE is blocked'
        USING ERRCODE = 'feature_not_supported',
              HINT = 'set aegis.allow_audit_purge=on for the retention session only';
END;
$$;

DROP TRIGGER IF EXISTS audit_entries_immutable ON audit_entries;
CREATE TRIGGER audit_entries_immutable
    BEFORE UPDATE OR DELETE ON audit_entries
    FOR EACH ROW EXECUTE FUNCTION aegis_block_audit_mutation();

DROP TRIGGER IF EXISTS audit_events_immutable ON audit_events;
CREATE TRIGGER audit_events_immutable
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION aegis_block_audit_mutation();
