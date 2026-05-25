-- Anomaly alert dedup: JSON array of ISO dates that have already fired today.
-- e.g. ["2026-04-23","2026-04-24"].

ALTER TABLE projects ADD COLUMN anomaly_alerts_fired TEXT;
