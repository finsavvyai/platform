-- Project-level monthly budget cap + alert threshold tracking.
-- monthly_budget_usd NULL = no cap. threshold_alerts_fired holds JSON like
-- {"2026-04": [50, 80]} so we only alert once per month per threshold.

ALTER TABLE projects ADD COLUMN monthly_budget_usd REAL;
ALTER TABLE projects ADD COLUMN threshold_alerts_fired TEXT;
