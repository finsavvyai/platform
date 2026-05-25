-- Reverse the audit immutability triggers + helper.
DROP TRIGGER IF EXISTS audit_events_immutable ON audit_events;
DROP TRIGGER IF EXISTS audit_entries_immutable ON audit_entries;
DROP FUNCTION IF EXISTS aegis_block_audit_mutation();
