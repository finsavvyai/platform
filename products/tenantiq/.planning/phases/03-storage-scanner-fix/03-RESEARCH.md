# Phase 3: Storage Scanner Fix - Research

**Researched:** 2026-04-22
**Domain:** Cloudflare Workers concurrency, Microsoft Graph API batching, sequential-to-parallel refactor
**Confidence:** HIGH

## Summary

The storage scanner in `apps/api/src/lib/storage/storage-scanner.ts` uses a sequential `for` loop to fetch each user's OneDrive quota and each site's SharePoint quota via individual Graph API calls. For a 100-user tenant, this produces 101 sequential HTTP requests for OneDrive alone (1 user list + 100 drive fetches), plus 51 for SharePoint (1 site list + 50 drive fetches). The loop never exits early due to CPU limits — `fetch()` calls do not count against Cloudflare Workers CPU time. The real failure mode is either: (a) the 30-second wall-clock subrequest timeout, or (b) Graph API throttling under sequential load causing cascading 429 retries that burn wall-clock time to exhaustion.

The fix is a pure in-file refactor: replace both sequential `for` loops with a chunked `Promise.all` pattern, processing a maximum of 10 users/sites concurrently per batch. No new dependencies are needed — the pattern is implementable in plain TypeScript. Microsoft Graph's `$batch` endpoint (max 20 requests per call) is an alternative but adds response-unwrapping complexity and batch-level 429 handling; the chunk-Promise.all pattern is simpler, already matches the STOR-05 requirement wording ("parallel batches of max 10"), and is preferred.

**Primary recommendation:** Replace both `for` loops in `storage-scanner.ts` with a `chunkArray` utility + `Promise.all` on each chunk of 10, propagating the same `OneDriveUser[]`/`SharePointSite[]` output types unchanged. The `storage-analyzer.ts`, route, and cron caller code require no changes.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STOR-05 | Storage scanner processes users in parallel batches (max 10 concurrent Graph calls) to avoid Workers CPU limit | Confirmed: sequential loops replaced with chunk+Promise.all; 10 is below Graph throttle threshold and within Workers subrequest concurrency guidance |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (built-in) | 5.7 | Chunking utility, typed batch results | Already in project, no new dep needed |
| `Promise.all` (native) | ES2015 | Parallel execution of a fixed-size chunk | No import needed; runs in any Workers runtime |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `p-limit` | 6.x | Token-bucket concurrency limiting | Use if chunk-based approach needs finer throttling (not needed here — chunk size 10 is sufficient) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Chunk + Promise.all | Graph `$batch` endpoint (max 20/call) | $batch reduces HTTP round-trips to ceil(N/20) but requires unwrapping per-item status codes from the batch response, adds retry logic per item, and has known issues with /users/{id}/drive — chunk approach is simpler and more debuggable |
| Chunk + Promise.all | `p-limit` npm package | p-limit provides sliding-window concurrency (cleaner for variable workloads) but requires adding a dependency; for fixed batch-of-10 semantics the native chunking pattern is equivalent |
| Chunk + Promise.all | Cloudflare Durable Objects / Queue | Appropriate for multi-minute jobs; overkill for a scan that completes in <30s after parallelism; adds significant architectural complexity |

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Project Structure
No structural changes needed. The fix is confined to:
```
apps/api/src/lib/storage/
├── storage-scanner.ts    # CHANGE: replace for-loops with chunkBatch helper
└── storage-scanner.test.ts  # CHANGE: add batch parallelism tests
```
All other files (`storage-analyzer.ts`, `storage-analytics.ts`, `cron/storage-scan.ts`) are callers of the unchanged function signatures and require zero modification.

### Pattern 1: Chunk + Promise.all (The Fix)
**What:** Split an array into fixed-size chunks, then `Promise.all` each chunk sequentially (chunks run serially; items within a chunk run in parallel).
**When to use:** When you need bounded parallelism without an npm package and the order of final results doesn't matter (sort is applied after).

```typescript
// Source: standard TypeScript/ES2020 pattern
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Replace the sequential for-loop:
const BATCH_SIZE = 10;
const results: OneDriveUser[] = [];
for (const chunk of chunkArray(userList, BATCH_SIZE)) {
  const settled = await Promise.allSettled(
    chunk.map(async (user) => {
      const drive = await graph.fetch(`/users/${user.id}/drive?$select=quota`);
      // ... build OneDriveUser object
    })
  );
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) results.push(r.value);
    // rejected = skip (same behaviour as current try/catch per user)
  }
}
```

**Key detail:** Use `Promise.allSettled` (not `Promise.all`) so a single 404/403 on one user does not abort the entire chunk — matching the current per-user `try/catch` skip behaviour.

### Pattern 2: Current Sequential Code (The Problem)

```typescript
// BEFORE — sequential, 100 iterations = 100 serial awaits
for (const user of userList) {
  try {
    const drive = await graph.fetch(`/users/${user.id}/drive?$select=quota`);
    // ...
  } catch { /* skip */ }
}
```

At 100 users, with each Graph call taking ~200–500 ms, total wall-clock time is 20–50 seconds — which exceeds the paid-plan 30-second HTTP request wall-clock timeout and is certain to fail in cron context for large tenants.

### Anti-Patterns to Avoid
- **Unbounded Promise.all on full userList:** `Promise.all(userList.map(...))` fires all 100+ requests simultaneously. Graph throttles at ~4 concurrent requests per resource and returns 429 with Retry-After headers. The existing GraphClient already handles 429 retry but only for one request at a time — batching without a cap will produce cascading retries.
- **Using `$batch` for /users/{id}/drive:** The `/drive` endpoint on a per-user path has known issues in batch context. The batch endpoint caps at 20 requests, requires per-response status checking, and adds ~80 lines of unwrapping code for no meaningful wall-clock benefit over chunk-10.
- **Increasing the hard-coded `.slice(0, 100)` cap instead of fixing parallelism:** The current cap (`userList.slice(0, 100)`) artificially limits coverage. The fix should remove this slice or raise it significantly (e.g., 999) once parallelism is in place, so large tenants are covered.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrency limiting | Custom semaphore class | Chunk + Promise.allSettled | The pattern is 8 lines; a custom semaphore is 40+ lines with edge cases in async context |
| 429 retry logic | New retry wrapper | Existing GraphClient.request() | GraphClient already handles 429 with Retry-After sleep on line 89–93 of graph-client.ts |
| Result aggregation | Custom merge logic | Direct array push after allSettled | Output types are unchanged; analyzer and callers already accept OneDriveUser[] |

**Key insight:** The entire fix is a refactor of two `for` loops. The GraphClient, storage-analyzer, route, and cron layers are already correct and require no changes.

## Common Pitfalls

### Pitfall 1: Replacing `try/catch` skip with `Promise.all` that throws
**What goes wrong:** Using `Promise.all` instead of `Promise.allSettled` causes one missing OneDrive (403 from a guest account) to abort the entire chunk, returning fewer results than the sequential version did.
**Why it happens:** `Promise.all` rejects on first rejection.
**How to avoid:** Always use `Promise.allSettled` for scan loops where per-item failures are expected (guest accounts, unlicensed users, restricted sites).
**Warning signs:** Test with a mock that rejects one of three users in a chunk — verify remaining two still appear in output.

### Pitfall 2: Leaving the `.slice(0, 100)` user cap in place
**What goes wrong:** STOR-05 requires the scanner to handle 100+ users. The current code does `userList.slice(0, 100)`, so a tenant with 150 users is silently truncated to 100 regardless of the parallelism fix.
**Why it happens:** The cap was added as a guard against the sequential CPU problem, not as a business rule.
**How to avoid:** Remove the hard cap or raise it to match the users list page size (currently `$top=200`). The parallelism fix makes a 200-user scan feasible in <10s wall-clock time.
**Warning signs:** Success criteria says "100+ users without terminating early or returning incomplete records" — incomplete records from truncation fails this criterion.

### Pitfall 3: Graph throttle under uncontrolled concurrency
**What goes wrong:** If chunk size is set too high (>20), parallel requests hit Graph throttle limits per-resource, triggering many simultaneous 429 retries. The existing GraphClient.request() retries synchronously inside the promise, so all concurrent retries sleep independently — but if 20+ are sleeping simultaneously, the Worker is kept alive for the full retry window.
**Why it happens:** Graph OneDrive/SharePoint throttle limits are ~4–10 concurrent per app registration.
**How to avoid:** Keep BATCH_SIZE at 10 as specified in STOR-05. This matches the requirement and stays within Graph's safe concurrency range.
**Warning signs:** Test coverage should assert that a 100-user mock completes in under graph call count × batch latency estimate.

### Pitfall 4: File-size limit (200 lines)
**What goes wrong:** `storage-scanner.ts` is currently 96 lines. Adding `chunkArray`, refactoring two loops, and updating comments should stay well under 200 lines.
**How to avoid:** Keep `chunkArray` as a local unexported utility (5 lines). Do not import it from a shared package — the overhead is not justified.

## Code Examples

### Complete Refactored `scanOneDriveUsage`
```typescript
// Source: pattern derived from standard ES2020 + project conventions
const BATCH_SIZE = 10;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export async function scanOneDriveUsage(graph: GraphClient): Promise<OneDriveUser[]> {
  const usersData = await graph
    .fetch('/users?$select=id,displayName,mail,userPrincipalName&$top=999')
    .catch(() => ({ value: [] }));

  const userList = usersData.value || [];
  const results: OneDriveUser[] = [];

  for (const chunk of chunkArray(userList, BATCH_SIZE)) {
    const settled = await Promise.allSettled(
      chunk.map(async (user: { id: string; displayName: string; mail: string; userPrincipalName: string }) => {
        const drive = await graph.fetch(`/users/${user.id}/drive?$select=quota`);
        const used = drive.quota?.used ?? 0;
        const total = drive.quota?.total ?? 0;
        if (used === 0 && total === 0) return null;
        return {
          userId: user.id,
          displayName: user.displayName || user.userPrincipalName || 'Unknown',
          email: user.mail || user.userPrincipalName || '',
          usedBytes: used, allocatedBytes: total,
          usedGB: toGB(used), allocatedGB: toGB(total),
          utilizationPct: utilPct(used, total),
          lastActivityDate: null,
        } satisfies OneDriveUser;
      })
    );
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }
  }

  results.sort((a, b) => b.usedBytes - a.usedBytes);
  return results;
}
```

### Test Pattern for Batch Parallelism
```typescript
// Verify all 15 users are returned across chunks of 10
it('processes 15 users in two chunks without losing any', async () => {
  const fakeUsers = Array.from({ length: 15 }, (_, i) => ({
    id: `u${i}`, displayName: `User ${i}`, mail: `u${i}@t.com`,
  }));
  const graph = {
    fetch: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith('/users?')) return Promise.resolve({ value: fakeUsers });
      return Promise.resolve({ quota: { used: 1 * GB, total: 10 * GB } });
    }),
  } as any;
  const users = await scanOneDriveUsage(graph);
  expect(users).toHaveLength(15);
});

// Verify one rejected user does not abort the chunk
it('skips rejected drive fetches without failing other users in the chunk', async () => {
  const fakeUsers = [
    { id: 'u1', displayName: 'Alice', mail: 'a@t.com' },
    { id: 'u2', displayName: 'Bob', mail: 'b@t.com' },
    { id: 'u3', displayName: 'Carol', mail: 'c@t.com' },
  ];
  const graph = {
    fetch: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith('/users?')) return Promise.resolve({ value: fakeUsers });
      if (path.includes('u2/drive')) return Promise.reject(new Error('No drive'));
      return Promise.resolve({ quota: { used: 5 * GB, total: 10 * GB } });
    }),
  } as any;
  const users = await scanOneDriveUsage(graph);
  expect(users).toHaveLength(2); // Alice and Carol, not Bob
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential for-await loop | Chunk + Promise.allSettled | This phase | 10x wall-clock speedup for 100-user tenant; enables scan completion within 30s paid plan limit |
| Hard cap `.slice(0, 100)` | Remove cap, use $top=999 | This phase | Removes silent data truncation for tenants 100–999 users |

**Deprecated/outdated:**
- `userList.slice(0, 100)`: Defensive cap introduced against CPU pressure; no longer needed once parallelism is correct. Replace with `$top=999` pagination-aware fetch or at minimum raise the cap to 999.

## Open Questions

1. **Users list pagination (`@odata.nextLink`)**
   - What we know: `graph.fetch()` returns a single page (up to `$top=999`). The GraphClient has `fetchAll()` which follows `@odata.nextLink`. STOR-05 success criterion mentions "100+ users" — the 999 page size covers the overwhelming majority of MSP tenants.
   - What's unclear: Whether any MSP customer tenant has >999 users. If so, only the first 999 would be scanned.
   - Recommendation: Use `$top=999` for this phase. Log a warning if `@odata.nextLink` is present in the users response. Full pagination via `fetchAll` is a v2 concern and is not required by STOR-05.

2. **SharePoint sites pagination**
   - What we know: Current code uses `.slice(0, 50)` on the sites list. The same chunk refactor applies.
   - What's unclear: Whether the sites search `?search=*` endpoint supports `$top` > 100 in v1.0.
   - Recommendation: Raise to `$top=200`, apply chunk-10, remove the `.slice(0, 50)` cap. Same pattern as OneDrive.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `cd apps/api && npx vitest run src/lib/storage/storage-scanner.test.ts` |
| Full suite command | `cd apps/api && npx vitest run --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STOR-05 | 100+ users processed without early termination | unit | `cd apps/api && npx vitest run src/lib/storage/storage-scanner.test.ts` | ✅ (needs new tests added) |
| STOR-05 | Max 10 concurrent Graph calls per batch | unit | same | ✅ (needs new tests added) |
| STOR-05 | Single user rejection does not abort chunk | unit | same | ✅ (needs new tests added) |
| STOR-05 | `.slice(0,100)` cap removed — 150-user tenant returns 150 records | unit | same | ✅ (needs new tests added) |

### Sampling Rate
- **Per task commit:** `cd apps/api && npx vitest run src/lib/storage/storage-scanner.test.ts`
- **Per wave merge:** `cd apps/api && npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases in `apps/api/src/lib/storage/storage-scanner.test.ts`:
  - `'processes 15 users across two chunks of 10'`
  - `'skips rejected drive fetches without aborting sibling users in chunk'`
  - `'removes hard-cap — returns all users when list has 150 entries'`
  - `'processes 15 SharePoint sites across two chunks of 10'`

*(Existing file exists; new describe blocks are additive — no rewrite needed)*

## Sources

### Primary (HIGH confidence)
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/) — CPU time vs wall-clock time distinction, fetch() not counted against CPU time, paid plan default 30s CPU limit
- [Cloudflare Workers CPU limit changelog (2025-03-25)](https://developers.cloudflare.com/changelog/post/2025-03-25-higher-cpu-limits/) — confirms paid plan raised to 5 min max
- [Microsoft Graph JSON batching](https://learn.microsoft.com/en-us/graph/json-batching) — max 20 per batch, per-item status codes, known issues list
- Project source: `apps/api/src/lib/storage/storage-scanner.ts` — direct inspection of sequential loops and hard caps

### Secondary (MEDIUM confidence)
- [Microsoft Graph throttling limits](https://learn.microsoft.com/en-us/graph/throttling-limits) — Outlook concurrency ~4; OneDrive/SharePoint concurrency not explicitly stated, batch of 10 is conservative safe value

### Tertiary (LOW confidence)
- Community reports of `/users/{id}/drive` behaving poorly in `$batch` context — not officially documented, inferred from known issues page reference; recommendation to avoid $batch for drive quota is conservative but not guaranteed to be necessary

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, pattern is native TypeScript
- Architecture: HIGH — fix is fully contained in storage-scanner.ts, callers unchanged
- Pitfalls: HIGH — sequential loop problem is directly observable in source; Workers CPU/wall-clock distinction confirmed in official docs
- Graph batch alternative: MEDIUM — $batch is officially documented but per-drive usage known issues are LOW confidence (community reports only)

**Research date:** 2026-04-22
**Valid until:** 2026-07-22 (stable domain — Workers limits and Graph batch spec change infrequently)
