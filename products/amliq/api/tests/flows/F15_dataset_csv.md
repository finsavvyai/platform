# F15: Dataset CSV Download & API

**Objective:** Verify Dataset API for bulk list downloads and delta updates.
**Prerequisites:** Dataset product subscription, test API key `aegis_csv_sk_test_xxx`, API testing tool

## Test Steps

1. **List API:** Execute `GET /api/v1/dataset/lists` with header `Authorization: Bearer aegis_csv_sk_test_xxx`. Verify status 200. Verify response returns JSON array with lists: listId, name, version, rowCount, lastUpdated, downloadUrl. Verify all expected lists present (OFAC, OpenSanctions, EU, UN, etc.)
2. **Full CSV Download:** Execute `GET /api/v1/dataset/latest?format=csv`. Verify status 200, Content-Type: text/csv, Content-Disposition: attachment. Verify CSV downloads, file size reasonable (MB range)
3. **CSV Structure:** Open CSV file. Verify header row: entity_id, names, type, list_source, list_id, date_added, nationality, citizenship, addresses, additional_data. Verify ≥1,000 rows of data. Verify no missing required fields. Verify proper CSV escaping
4. **Data Quality:** Spot-check known entities. Search "Vladimir Putin"—verify present in names column. Verify record includes: type (Individual), list source (OFAC), nationality. Check company "Gazprom"—verify type "Company", addresses included. Check row count (10,000+)
5. **Delta Endpoint:** Execute `GET /api/v1/dataset/delta?since=2026-03-20T00:00:00Z`. Verify returns only entities added/changed since that date. Verify response includes change_type (added/updated/removed) and date_modified. Verify result much smaller than full download
6. **Delta from Old Date:** Execute delta with very old date (2020-01-01). Verify response includes all entities (all "new" from old date). Verify same size as `/latest` download
7. **Incremental Fetches:** Fetch delta from 2026-03-25. Fetch again with last response timestamp. Verify zero results (no new changes). Trigger/wait for entity update. Fetch delta again. Verify new/updated entities appear
8. **Format Variants:** Test `?format=json`—verify JSON array returned (same data, different format). Test `?format=tsv` (if available)—verify tab-separated values format
9. **Pagination (if supported):** Test `?limit=5000&offset=0`—verify first 5,000 rows. Request offset=5000—verify next 5,000. Continue until all data retrieved. Verify pagination headers/metadata
10. **Usage Tracking:** Check usage before fetch. Execute `GET /api/v1/dataset/latest`. Navigate to `/billing`. Verify usage incremented (fetch count: 1, rows fetched counted). Perform multiple fetches. Verify count increments
11. **Hit Fetch Limit:** Via admin/test mode, set fetch count to limit (e.g., 12). Attempt one more fetch. Verify response 402 Payment Required with error: "fetch_limit_exceeded", limit value, retry_after timestamp. Verify upgrade prompt in dashboard
12. **Upgrade to Increase Limit:** Navigate to `/billing`, upgrade Dataset tier. Verify new limit higher (24 fetches). Verify "Fetches available: 11". Attempt fetch—verify succeeds, limit reset with upgrade
13. **Rate Limiting:** Make 5 rapid requests (within 1 second). Verify rate-limited after N requests. Verify response 429 Too Many Requests. Verify `Retry-After` header. Wait, retry—verify succeeds after rate limit window
14. **Auth Errors:** Test without API key (no Authorization header)—verify 401 Unauthorized. Test with invalid key—verify 401. Test with expired key—verify 401. Verify error messages consistent (no info leakage)
15. **Concurrent Requests:** Attempt 5 simultaneous downloads. Verify all complete successfully. Verify usage counted for each. Verify no race conditions
16. **Mobile Testing (375px):** Not applicable for API, but if accessing via dashboard: verify usage meter displays correctly on mobile, download links accessible

## Validation

- Available lists endpoint returns all expected lists
- Full CSV download includes all entities and correct columns
- CSV format valid (openable in Excel, parseable by scripts)
- Delta endpoint returns only changed entities
- Incremental fetches work correctly
- Usage tracked per fetch
- Fetch limit enforced with 402 response
- Upgrade increases limit
- Rate limiting in place
- Authentication required and validated

## Expected Result

Dataset API successfully provides bulk entity lists in CSV format, supports incremental delta updates, tracks usage per fetch, enforces fetch limits, and requires proper authentication.

---

*F15 | Dataset CSV | 2026-03-26*
