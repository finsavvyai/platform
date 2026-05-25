# Production game day checklist

Run after staging promotion and before customer-facing production cutover. Record pass/fail in the change ticket.

1. **Deploy rollback**: Deploy known-good previous artifact; confirm health endpoints return 200.
2. **Auth**: Rotate `JWT_SECRET` in staging; confirm forced logout / invalid token behavior; rotate back.
3. **Database**: Run migration up on staging clone; run down or restore-from-backup drill.
4. **Query path**: Execute read-only query, dry-run, and schema fetch against a non-default saved connection.
5. **NL→SQL**: Call QueryLens health + one NLP request with rate limit headers observed.
6. **Vectorize worker**: `GET /health` on worker URL; optional `X-Vectorize-Ingress-Secret` rejected when wrong.
7. **Alerts**: Trigger a synthetic failing health check in staging and confirm notification channel receives it.

Artifacts (logs, curl outputs, dashboard screenshots) must be attached to the release record — not narrative alone.
