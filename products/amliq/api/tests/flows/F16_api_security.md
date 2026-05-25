# F16: API Security Testing

**Objective:** Verify authentication, authorization, rate limiting, and security headers.
**Prerequisites:** API testing tool, multiple API keys, test environment

## Test Steps

1. **Unauthenticated:** `GET /api/v1/screen` (no Authorization header). Verify 401 Unauthorized with error "missing_api_key", no sensitive data leaked
2. **Invalid Format:** `Authorization: Bearer not_a_valid_key`. Verify 401 Unauthorized. Verify error doesn't indicate key format validity
3. **Expired Key:** Use revoked/expired key. Verify 401 Unauthorized with "API key expired"
4. **Wrong Product Key:** Use API key from SDK product on Dashboard endpoint. Verify 403 Forbidden with "Insufficient permissions". Verify no data returned
5. **Rate Limit Exceeded:** Make 50 rapid requests to `/api/v1/screen`. Verify 429 Too Many Requests after ~30 requests. Verify headers: X-RateLimit-Limit: 30, X-RateLimit-Remaining: 0, X-RateLimit-Reset: [timestamp], Retry-After: 60
6. **Rate Limit Reset:** Make request at limit. Verify succeeds (200). Make next request immediately. Verify 429. Wait specified time. Make request—verify succeeds
7. **CORS Headers:** Request from browser on different origin. Verify response includes: Access-Control-Allow-Origin (or *), Access-Control-Allow-Methods (GET, POST, OPTIONS), Access-Control-Allow-Headers (Content-Type, Authorization), Access-Control-Max-Age: 86400. Verify OPTIONS preflight succeeds with 200
8. **CORS Unauthorized Domain:** Embed widget on unauthorized domain. Attempt screening. Verify CORS error in console. Verify no Access-Control-Allow-Origin header. Verify 403 or CORS error
9. **Webhook Signature:** Create test webhook. Receive POST request. Verify X-AMLIQ-Signature header. Calculate: HMAC-SHA256(webhook_secret, request_body). Verify signature matches header. Replay with modified body—verify validation fails
10. **Webhook Replay Protection:** Receive webhook with ID `evt_12345`. Verify processed once. Replay same webhook. Verify detected/ignored as duplicate. Verify only one event in audit log. Verify timestamp in webhook—test old timestamp (>5 min), verify rejected
11. **Request Body Validation:** Send >10MB payload. Verify 413 Payload Too Large. Send invalid JSON. Verify 400 Bad Request with "Invalid JSON". Send missing required fields. Verify 400 with indication of missing field
12. **SQL/NoSQL Injection:** Send entity_name: "'; DROP TABLE alerts; --". Verify treated as literal text. Verify no database modification. Check audit: screening recorded. Send NoSQL: entity_name: {"$ne": ""}. Verify treated as literal string, no bypass
13. **XSS Payload:** Screen entity named "<script>alert('xss')</script>". Verify results returned. Check response: name is HTML-escaped or in JSON string. Verify script not executable
14. **PII Redaction:** Screen "SSN: 123-45-6789". Verify response contains full search. Verify audit log shows redacted: "SSN: 123-45-****". Verify logs not publicly accessible
15. **HTTPS Enforcement:** Attempt HTTP request. Verify 301/403 or connection refused. Verify redirect to HTTPS. Verify `Strict-Transport-Security: max-age=31536000` header
16. **Security Headers:** Any API request. Verify headers: X-Content-Type-Options: nosniff, X-Frame-Options: DENY (or SAMEORIGIN), X-XSS-Protection: 1; mode=block, Content-Security-Policy: [policy], Referrer-Policy: no-referrer
17. **API Key Rotation:** Create new key in dashboard. Verify old key works. Revoke old key. Verify new requests with old key fail (401). Verify new key works. Verify rotation logged in audit
18. **URL Parameter Auth:** Test if API key accepted in query: `?apiKey=sk_test_xxx`. Verify API key NOT accepted in query (only in headers). Verify error/rejection. Verify best practice enforced

## Validation

- Unauthenticated requests rejected (401)
- Invalid/expired keys rejected (401)
- Wrong product keys rejected (403)
- Rate limiting enforces limits with correct headers
- CORS headers present and correct
- Webhooks have valid signatures
- Webhook replay attacks prevented
- Input validation rejects invalid data
- Injection attacks prevented
- PII not logged
- HTTPS enforced
- Security headers present
- API keys only in Authorization header

## Expected Result

API implements comprehensive security controls: authentication, authorization, rate limiting, CORS validation, webhook signature verification, input validation, PII redaction, HTTPS enforcement, and security headers.

---

*F16 | API Security | 2026-03-26*
