-- Per-team daily rate limit: sum of requests across every project linked
-- to the team. NULL = unlimited. Enforced pre-call alongside the per-project
-- limit. Admin of the team can change via PUT /v1/teams/:id/rate-limit.

ALTER TABLE teams ADD COLUMN rate_limit_per_day INTEGER;
