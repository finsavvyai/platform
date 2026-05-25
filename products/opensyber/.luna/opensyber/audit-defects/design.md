# Technical Design: Audit Defect Remediation

**Date**: 2026-03-09
**Status**: Implementation-ready
**Scope**: R1 (auth middleware), R2 (solo mode audit logging), R3 (file splitting)

---

## Executive Summary

Three categories of audit defects remain open from the 2026-03-07 code review. This document provides exact, line-level implementation guidance for each fix. All changes are backward-compatible, require no new dependencies, and maintain existing test patterns.

**Key decisions:**
1. Each route file adds its own `.use('*', ...)` middleware chain (Hono sub-routers do not inherit parent middleware)
2. Solo mode audit logging uses `console.log` with structured JSON (zero DB/KV cost)
3. Frontend files are split by extracting named section components into colocated files

---

## R1: Add Authentication Middleware to API Routes

### Problem

Three route files access `c.get('orgId')` and `c.env.DB` but have no middleware to set these values. They are mounted in `register-admin.ts` via `app.route(...)`, but Hono sub-routers do **not** inherit middleware from the parent app. The routes are currently accessible without any authentication.

### Reference Pattern

The correct pattern is established in `apps/api/src/routes/alert-channels/index.ts` at line 31:

```typescript
alertChannelRoutes.use('*', dbMiddleware, authMiddleware);
```

### R1.1: `data-room.ts` — Admin-Only Access

**File**: `apps/api/src/routes/data-room.ts`
**Current line count**: 69 lines
**Mount path**: `/api/admin/data-room` (register-admin.ts:33)

This route exposes investor metrics (org counts, revenue, monthly signups). It must be restricted to platform admins only.

**Required middleware chain**: `dbMiddleware -> authMiddleware -> adminMiddleware`

**Exact changes:**

Add imports after line 2 (after `import type { Env, Variables } from '../types.js';`):

```typescript
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
```

Add middleware registration after line 11 (after the `new Hono` declaration):

```typescript
dataRoomRoutes.use('*', dbMiddleware, authMiddleware, adminMiddleware);
```

**Why adminMiddleware, not resolveOrgContext**: Data room is a platform-level admin feature showing cross-org aggregate data. It does not operate within a single org context. The `adminMiddleware` checks `users.isAdmin === 1` in the DB (see `apps/api/src/middleware/admin.ts:17-21`).

**No other changes needed**: The route handlers use `c.env.DB.prepare()` directly (raw SQL), not `c.get('db')`, so `dbMiddleware` is needed only because `authMiddleware` and `adminMiddleware` depend on `c.get('db')` being set. Wait -- checking this: `adminMiddleware` uses `c.get('db')` at line 16, and `authMiddleware` does NOT use `c.get('db')` (it calls Clerk API directly). So `dbMiddleware` is required for `adminMiddleware`.

**Correction**: Looking at `admin.ts:15-16`, `adminMiddleware` does `const db = c.get('db')` -- so yes, `dbMiddleware` must come first.

**Final file after changes** (73 lines, well under 200):

```typescript
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';

const dataRoomRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
dataRoomRoutes.use('*', dbMiddleware, authMiddleware, adminMiddleware);

// ... rest unchanged
```

### R1.2: `soc2-readiness.ts` — Org-Scoped Access

**File**: `apps/api/src/routes/soc2-readiness.ts`
**Current line count**: 93 lines
**Mount path**: `/api/soc2` (register-admin.ts:57)

This route serves SOC2 readiness data scoped to an organization. It already checks `c.get('orgId')` at lines 17 and 67, returning 400 if absent. With `resolveOrgContext`, the middleware will set `orgId` from the `X-Org-Id` header and validate membership.

**Required middleware chain**: `dbMiddleware -> authMiddleware -> resolveOrgContext`

**Exact changes:**

Add imports after line 2:

```typescript
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext } from '../middleware/rbac.js';
```

Add middleware registration after line 13 (after the `new Hono` declaration):

```typescript
soc2Routes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);
```

**Why resolveOrgContext, not requirePermission**: The requirements specify org-scoped access. `resolveOrgContext` validates org membership and sets `orgId`, `role`, and `orgMember` without checking a specific permission. This allows any org member to view SOC2 readiness. If we later need permission gating, individual route handlers can add `requirePermission('soc2.read')`.

**Interaction with existing orgId checks**: The existing `if (!orgId)` checks at lines 17 and 67 remain valid as safety nets. In solo mode (no `X-Org-Id` header), `resolveOrgContext` sets `orgId` to `null`, and these guards return 400. This is correct -- SOC2 data is meaningless without an org context.

**Final file after changes** (97 lines, under 200):

```typescript
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { SOC2_MAPPINGS, SOC2_TSC_CATEGORIES } from '@opensyber/shared';
import type { Soc2ControlMapping } from '@opensyber/shared';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext } from '../middleware/rbac.js';

const soc2Routes = new Hono<{ Bindings: Env; Variables: Variables }>();
soc2Routes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// ... rest unchanged
```

### R1.3: `sla-monitoring.ts` — Org-Scoped Access

**File**: `apps/api/src/routes/sla-monitoring.ts`
**Current line count**: 117 lines (note: already uses `c.get('orgId')` at lines 14, 58)
**Mount path**: `/api/sla` (register-admin.ts:60)

Same pattern as SOC2. SLA data is scoped to an organization.

**Required middleware chain**: `dbMiddleware -> authMiddleware -> resolveOrgContext`

**Exact changes:**

Add imports after line 2:

```typescript
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext } from '../middleware/rbac.js';
```

Add middleware registration after line 10 (after the `new Hono` declaration):

```typescript
slaMonitoringRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);
```

**Final file after changes** (121 lines, under 200).

### R1 Auth Flow Summary

```
Request arrives at /api/admin/data-room/*
  -> dbMiddleware: creates Drizzle DB instance, sets c.var.db
  -> authMiddleware: validates Bearer JWT via Clerk API, sets c.var.userId
  -> adminMiddleware: checks users.isAdmin === 1, returns 403 if not admin
  -> route handler

Request arrives at /api/soc2/* or /api/sla/*
  -> dbMiddleware: creates Drizzle DB instance, sets c.var.db
  -> authMiddleware: validates Bearer JWT via Clerk API, sets c.var.userId
  -> resolveOrgContext: reads X-Org-Id header
     - missing: sets orgId=null, role=null (solo mode)
     - present: validates membership in org_members table, sets orgId/role/orgMember
     - not a member: returns 403
  -> route handler (still checks orgId for null as safety net)
```

### R1 Test Plan

For each of the three route files, add a test file colocated:

- `data-room.test.ts`
- `soc2-readiness.test.ts`
- `sla-monitoring.test.ts`

**Test cases per file:**

| Test | Expected | Notes |
|---|---|---|
| No Authorization header | 401 Unauthorized | authMiddleware rejects |
| Invalid Bearer token | 401 Unauthorized | Clerk API returns non-200 |
| Valid token, non-admin user (data-room only) | 403 Forbidden | adminMiddleware rejects |
| Valid token, admin user (data-room) | 200 + data | Happy path |
| Valid token, no X-Org-Id (soc2/sla) | 400 (orgId required) | resolveOrgContext sets null, handler guard fires |
| Valid token, X-Org-Id for non-member (soc2/sla) | 403 Forbidden | resolveOrgContext rejects |
| Valid token, X-Org-Id for active member (soc2/sla) | 200 + data | Happy path |

**Test setup pattern** (follows existing `apps/api/src/test/helpers.ts`):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dataRoomRoutes } from '../data-room.js';

// Mock Clerk token verification
vi.stubGlobal('fetch', mockAuthFetch());

describe('data-room routes', () => {
  it('returns 401 without auth header', async () => {
    const res = await dataRoomRoutes.request('/');
    expect(res.status).toBe(401);
  });
});
```

---

## R2: Add Audit Logging for Solo Mode RBAC Bypass

### Problem

In `apps/api/src/middleware/rbac.ts`, the `requirePermission` function at lines 24-29 silently bypasses all permission checks when the `X-Org-Id` header is absent (solo mode). This is intentional for backward compatibility, but creates a blind spot in audit trails.

### Current Code (lines 20-29)

```typescript
export function requirePermission(permission: Permission) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const orgId = c.req.header('X-Org-Id') ?? null;

    // Solo mode — no org context, full access (backward compatible)
    if (!orgId) {
      c.set('orgId', null);
      c.set('role', null);
      c.set('orgMember', null);
      return next();
    }
    // ...
```

### Design

Insert a single `console.log` call inside the solo-mode branch, after setting the variables but before calling `next()`. The log emits a structured JSON object that Cloudflare Workers Logs captures automatically.

### Exact Change

Replace lines 24-29 in `apps/api/src/middleware/rbac.ts`:

```typescript
    // Solo mode — no org context, full access (backward compatible)
    if (!orgId) {
      c.set('orgId', null);
      c.set('role', null);
      c.set('orgMember', null);
      return next();
    }
```

With:

```typescript
    // Solo mode — no org context, full access (backward compatible)
    if (!orgId) {
      c.set('orgId', null);
      c.set('role', null);
      c.set('orgMember', null);
      console.log(JSON.stringify({
        event: 'rbac.solo_bypass',
        userId: c.get('userId'),
        permission,
        path: c.req.path,
        method: c.req.method,
        timestamp: new Date().toISOString(),
      }));
      return next();
    }
```

### Log Format

```json
{
  "event": "rbac.solo_bypass",
  "userId": "user_2abc123",
  "permission": "instance.create",
  "path": "/api/v1/instances",
  "method": "POST",
  "timestamp": "2026-03-09T14:22:33.456Z"
}
```

### Performance Analysis

| Concern | Impact | Rationale |
|---|---|---|
| `console.log` cost | Negligible | Cloudflare Workers `console.log` is buffered and async; does not block the request |
| `JSON.stringify` cost | ~0.01ms | 6 small string fields, no nested objects |
| `new Date().toISOString()` | ~0.001ms | Single Date allocation |
| `c.req.path` / `c.req.method` | Already parsed | Hono parses these during request init |
| No DB writes | Zero | Requirement explicitly forbids DB/KV in hot path |
| No KV operations | Zero | Log goes to Workers Logs only |

**Total overhead**: Under 0.05ms per solo-mode request. No measurable regression.

### `resolveOrgContext` Consideration

The requirements reference `requirePermission` specifically. However, `resolveOrgContext` (lines 87-95) also has a solo-mode bypass. We should add the same logging there for completeness, but with a different event name:

Replace lines 90-95:

```typescript
  if (!orgId) {
    c.set('orgId', null);
    c.set('role', null);
    c.set('orgMember', null);
    return next();
  }
```

With:

```typescript
  if (!orgId) {
    c.set('orgId', null);
    c.set('role', null);
    c.set('orgMember', null);
    console.log(JSON.stringify({
      event: 'rbac.solo_bypass',
      userId: c.get('userId'),
      permission: null,
      path: c.req.path,
      method: c.req.method,
      timestamp: new Date().toISOString(),
    }));
    return next();
  }
```

The `permission: null` distinguishes this from `requirePermission` bypasses, where `permission` is a specific string like `"instance.create"`.

### R2 Test Plan

Add tests to the existing RBAC test file (or create `rbac.test.ts` if absent).

```typescript
import { describe, it, expect, vi } from 'vitest';
import { requirePermission } from '../middleware/rbac.js';

describe('requirePermission - solo mode audit logging', () => {
  it('logs structured JSON when solo mode bypasses permission check', async () => {
    const logSpy = vi.spyOn(console, 'log');

    // Set up a Hono app with requirePermission('instance.create')
    // Send request WITHOUT X-Org-Id header
    // Assert route succeeds (200)

    expect(logSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logged).toMatchObject({
      event: 'rbac.solo_bypass',
      permission: 'instance.create',
      method: 'GET',
    });
    expect(logged.userId).toBeDefined();
    expect(logged.timestamp).toBeDefined();
    expect(logged.path).toBeDefined();

    logSpy.mockRestore();
  });

  it('does not log when org context is present', async () => {
    const logSpy = vi.spyOn(console, 'log');

    // Send request WITH X-Org-Id header + valid member

    // Filter for rbac.solo_bypass events
    const bypassLogs = logSpy.mock.calls.filter((call) => {
      try { return JSON.parse(call[0]).event === 'rbac.solo_bypass'; }
      catch { return false; }
    });
    expect(bypassLogs).toHaveLength(0);

    logSpy.mockRestore();
  });
});
```

### Full `rbac.ts` After Changes

The file grows from 133 lines to approximately 147 lines (well under 200).

---

## R3: Split Oversized Frontend Files

### R3.1: `HomeClient.tsx` (328 lines -> 5 files)

**File**: `apps/web/src/app/HomeClient.tsx`
**Current size**: 328 lines, 10 component functions

The file already follows a clean section-per-function pattern. Each section function is self-contained with no shared state. The split is straightforward: extract groups of section functions into colocated files.

#### Split Plan

| New File | Components | Lines (approx) | Rationale |
|---|---|---|---|
| `HomeClient.tsx` | `HomeClient` (orchestrator), imports | ~45 | Composition root only |
| `HeroSection.tsx` | `HeroSection` | ~45 | Above-the-fold hero, separate animation concerns |
| `HomeSections.tsx` | `ProblemSection`, `SolutionSection`, `TokenForgeSection` | ~110 | Core value proposition sections |
| `HomeFeatures.tsx` | `HowItWorksSection`, `ComparisonSection`, `StatsSection`, `WhySection` | ~105 | Social proof and comparison sections |
| `HomeFooter.tsx` | `FinalCTASection`, `Footer` | ~30 | Bottom-of-page CTA and footer |

#### Directory Structure

All files stay in `apps/web/src/app/` (same directory as `HomeClient.tsx`), colocated with the existing `home-data.ts` and `TypedTerminal.tsx`.

```
apps/web/src/app/
  HomeClient.tsx       (orchestrator, ~45 lines)
  HeroSection.tsx      (hero, ~45 lines)
  HomeSections.tsx     (problem + solution + tokenforge, ~110 lines)
  HomeFeatures.tsx     (how-it-works + comparison + stats + why, ~105 lines)
  HomeFooter.tsx       (final CTA + footer, ~30 lines)
  home-data.ts         (existing, unchanged)
  TypedTerminal.tsx    (existing, unchanged)
```

#### New `HomeClient.tsx` (orchestrator)

```typescript
'use client';

import { SiteHeader } from '@/components/SiteHeader';
import { HeroSection } from './HeroSection';
import { ProblemSection, SolutionSection, TokenForgeSection } from './HomeSections';
import { HowItWorksSection, ComparisonSection, StatsSection, WhySection } from './HomeFeatures';
import { FinalCTASection, Footer } from './HomeFooter';

export default function HomeClient() {
  return (
    <div className="min-h-screen bg-neutral-950">
      <SiteHeader />
      <main>
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <TokenForgeSection />
        <HowItWorksSection />
        <ComparisonSection />
        <StatsSection />
        <WhySection />
        <FinalCTASection />
      </main>
      <Footer />
    </div>
  );
}
```

#### New `HeroSection.tsx`

```typescript
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { AuthCTA } from '@/components/AuthNav';

export function HeroSection() {
  // ... exact content from lines 35-71 of current HomeClient.tsx
}
```

#### New `HomeSections.tsx`

```typescript
'use client';

import { motion } from 'framer-motion';
import { CheckCircle, Fingerprint, ShieldCheck, Lock } from 'lucide-react';
import { FadeIn } from '@/components/motion/FadeIn';
import { StaggerChildren, StaggerItem } from '@/components/motion/StaggerChildren';
import { TypedTerminal } from './TypedTerminal';
import { threats, solutionLayers } from './home-data';

export function ProblemSection() { /* lines 73-101 */ }
export function SolutionSection() { /* lines 103-141 */ }
export function TokenForgeSection() { /* lines 143-172 */ }
```

#### New `HomeFeatures.tsx`

```typescript
'use client';

import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { FadeIn } from '@/components/motion/FadeIn';
import { StaggerChildren, StaggerItem } from '@/components/motion/StaggerChildren';
import { CountUp } from '@/components/motion/CountUp';
import { steps, comparisonRows, earlyAccessFeatures } from './home-data';

export function HowItWorksSection() { /* lines 174-202 */ }
export function ComparisonSection() { /* lines 204-238 */ }
export function StatsSection() { /* lines 240-263 */ }
export function WhySection() { /* lines 265-290 */ }
```

#### New `HomeFooter.tsx`

```typescript
'use client';

import Link from 'next/link';
import { ArrowRight, Shield } from 'lucide-react';
import { AuthCTA } from '@/components/AuthNav';
import { FadeIn } from '@/components/motion/FadeIn';

export function FinalCTASection() { /* lines 292-308 */ }
export function Footer() { /* lines 310-328 */ }
```

#### Export Strategy

- All extracted components use **named exports** (not default)
- `HomeClient.tsx` retains its **default export** (consumed by the page)
- No barrel `index.ts` needed -- the orchestrator imports directly from each file

#### Import Migration

The page file that imports `HomeClient` (likely `apps/web/src/app/page.tsx`) does not change -- it still imports the default export from `HomeClient.tsx`.

---

### R3.2: `TrustPageClient.tsx` (251 lines -> 2 files)

**File**: `apps/web/src/app/trust/[id]/TrustPageClient.tsx`
**Current size**: 251 lines, 7 functions

The file has two distinct concerns:
1. **Main component** with data fetching, state, attribution, and loading/error states (lines 1-142)
2. **Presentational sections**: `HeroBanner`, `StatsRow`, `ShareSection`, `BadgeSection`, `CtaSection` (lines 144-251)

#### Split Plan

| New File | Components | Lines (approx) | Rationale |
|---|---|---|---|
| `TrustPageClient.tsx` | `TrustPageClient` (default), `sendTrustEvent` | ~142 | Stateful orchestrator + data fetching |
| `TrustSections.tsx` | `HeroBanner`, `StatsRow`, `ShareSection`, `BadgeSection`, `CtaSection` | ~115 | Pure presentational sections |

#### Directory Structure

```
apps/web/src/app/trust/[id]/
  TrustPageClient.tsx   (orchestrator, ~142 lines)
  TrustSections.tsx     (presentational, ~115 lines)
  trust-helpers.ts      (existing, unchanged)
  trust-attribution.ts  (existing, unchanged)
```

#### New `TrustSections.tsx`

```typescript
'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ShareButtons } from '@/components/ShareButtons';
import { BadgeEmbed } from '@/components/dashboard/BadgeEmbed';
import { ScoreGauge } from '@/components/score/ScoreGauge';
import { GradeDisplay } from '@/components/score/GradeDisplay';
import type { ScorecardData } from './trust-helpers';
import { buildShareText } from './trust-helpers';
import type { TrustTrackEventName } from './trust-attribution';

export function HeroBanner({ data, scoreUrl, trialUrl, onTrack }: {
  data: ScorecardData; scoreUrl: string; trialUrl: string;
  onTrack: (event: TrustTrackEventName) => void;
}) {
  // ... exact content from lines 147-174
}

export function StatsRow({ data, strongestCategory, weakestCategory }: {
  data: ScorecardData;
  strongestCategory: [string, number] | undefined;
  weakestCategory: [string, number] | undefined;
}) {
  // ... exact content from lines 179-198
}

export function ShareSection({ trustUrl, data, onTrack }: {
  trustUrl: string; data: ScorecardData;
  onTrack: (event: TrustTrackEventName) => void;
}) {
  // ... exact content from lines 203-223
}

export function BadgeSection({ instanceId }: { instanceId: string }) {
  // ... exact content from lines 225-235
}

export function CtaSection({ trialUrl, demoUrl, onTrack }: {
  trialUrl: string; demoUrl: string;
  onTrack: (event: TrustTrackEventName) => void;
}) {
  // ... exact content from lines 239-251
}
```

#### Updated `TrustPageClient.tsx`

Replace the local function definitions with imports:

```typescript
import { HeroBanner, StatsRow, ShareSection, BadgeSection, CtaSection } from './TrustSections';
```

Remove lines 144-251 (the five section functions). The file shrinks from 251 to ~142 lines.

---

### R3.3: `DemoClient.tsx` (235 lines -> 2 files)

**File**: `apps/web/src/app/demo/DemoClient.tsx`
**Current size**: 235 lines, 5 functions

The file has:
1. **Main component** with all state hooks and effects (lines 1-129)
2. **Presentational helpers**: `DemoBanner`, `DemoHeader`, `DemoTabs`, `DemoCTA` (lines 131-235)

#### Split Plan

| New File | Components | Lines (approx) | Rationale |
|---|---|---|---|
| `DemoClient.tsx` | `DemoClient` (default) | ~129 | Stateful orchestrator with all hooks |
| `DemoShell.tsx` | `DemoBanner`, `DemoHeader`, `DemoTabs`, `DemoCTA` | ~110 | Stateless presentational shell components |

#### Directory Structure

```
apps/web/src/app/demo/
  DemoClient.tsx      (orchestrator, ~129 lines)
  DemoShell.tsx       (shell components, ~110 lines)
  OverviewTab.tsx     (existing, unchanged)
  EventsTab.tsx       (existing, unchanged)
  NetworkTab.tsx      (existing, unchanged)
  demo-constants.ts   (existing, unchanged)
  demo-helpers.ts     (existing, unchanged)
```

#### New `DemoShell.tsx`

```typescript
'use client';

import Link from 'next/link';
import { ArrowRight, Eye, Activity, Network, Bell, Clock, RefreshCw } from 'lucide-react';
import type { DemoTab } from './demo-constants';

export function DemoBanner({ notifCount, onClearNotifs }: {
  notifCount: number; onClearNotifs: () => void;
}) {
  // ... exact content from lines 132-158
}

export function DemoHeader({ upDays, upHours, upMin, lastScanned, scanText }: {
  upDays: number; upHours: number; upMin: number;
  lastScanned: number; scanText: string;
}) {
  // ... exact content from lines 163-185
}

export function DemoTabs({ tab, setTab, notifCount }: {
  tab: DemoTab; setTab: (t: DemoTab) => void; notifCount: number;
}) {
  // ... exact content from lines 189-214
}

export function DemoCTA() {
  // ... exact content from lines 216-235
}
```

#### Updated `DemoClient.tsx`

Replace the local function definitions with an import:

```typescript
import { DemoBanner, DemoHeader, DemoTabs, DemoCTA } from './DemoShell';
```

Remove lines 131-235 (the four shell functions). The file shrinks from 235 to ~129 lines.

---

## R3 Summary Table

| Original File | Lines | New Files | Max Lines | All Under 200? |
|---|---|---|---|---|
| `HomeClient.tsx` | 328 | 5 files | ~110 | Yes |
| `TrustPageClient.tsx` | 251 | 2 files | ~142 | Yes |
| `DemoClient.tsx` | 235 | 2 files | ~129 | Yes |

**Total new files**: 5 (HomeClient creates 4 new files; TrustPageClient creates 1; DemoClient creates 1)

---

## Implementation Order

The three requirements are independent and can be implemented in parallel. However, the recommended order for a single developer is:

1. **R2 (solo mode logging)** — Smallest change (6 lines added to rbac.ts), highest security value, easy to test
2. **R1 (auth middleware)** — Three small edits (3-4 lines each), plus test files
3. **R3 (file splitting)** — Mechanical refactoring, zero logic changes, visual regression risk

### Verification Checklist

After all changes:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (including new tests)
- [ ] `pnpm build` succeeds
- [ ] No file in `apps/web/src/` exceeds 200 lines
- [ ] No file in `apps/api/src/` exceeds 200 lines
- [ ] `curl /api/admin/data-room` without auth returns 401
- [ ] `curl /api/soc2/` without auth returns 401
- [ ] `curl /api/sla/` without auth returns 401
- [ ] Solo mode requests produce `rbac.solo_bypass` log entries
- [ ] Home page renders identically (visual check)
- [ ] Trust page renders identically (visual check)
- [ ] Demo page renders identically (visual check)

---

## Appendix: Files Modified

| File | Change Type | Lines Changed |
|---|---|---|
| `apps/api/src/routes/data-room.ts` | Add imports + middleware | +4 lines |
| `apps/api/src/routes/soc2-readiness.ts` | Add imports + middleware | +4 lines |
| `apps/api/src/routes/sla-monitoring.ts` | Add imports + middleware | +4 lines |
| `apps/api/src/middleware/rbac.ts` | Add console.log in two branches | +14 lines |
| `apps/web/src/app/HomeClient.tsx` | Extract sections | Rewrite (328 -> ~45) |
| `apps/web/src/app/HeroSection.tsx` | **New file** | ~45 lines |
| `apps/web/src/app/HomeSections.tsx` | **New file** | ~110 lines |
| `apps/web/src/app/HomeFeatures.tsx` | **New file** | ~105 lines |
| `apps/web/src/app/HomeFooter.tsx` | **New file** | ~30 lines |
| `apps/web/src/app/trust/[id]/TrustPageClient.tsx` | Extract sections | Rewrite (251 -> ~142) |
| `apps/web/src/app/trust/[id]/TrustSections.tsx` | **New file** | ~115 lines |
| `apps/web/src/app/demo/DemoClient.tsx` | Extract shell | Rewrite (235 -> ~129) |
| `apps/web/src/app/demo/DemoShell.tsx` | **New file** | ~110 lines |

**Total files modified**: 5
**Total files created**: 6
**New dependencies**: 0
