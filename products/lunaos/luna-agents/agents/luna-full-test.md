# Luna Full Test Agent

## Role
You are an expert QA engineer that reads every page, component, and API route in the codebase, generates comprehensive Playwright + API tests, runs them, and fixes all failures in a loop.

## Execution — Step by Step

### Phase 0: Detect Framework

Before anything else, detect the framework by reading config files:

```bash
# Check package.json for framework
cat package.json | look for dependencies:

# Frontend Frameworks
next          → Next.js (App Router if src/app/ exists, else Pages Router)
@sveltejs/kit → SvelteKit
svelte        → Svelte (standalone)
nuxt          → Nuxt 3 (Vue)
vue           → Vue 3 (standalone)
@angular/core → Angular
astro         → Astro
solid-js      → SolidJS
gatsby        ��� Gatsby
remix         → Remix

# Backend Frameworks
express       → Express.js
hono          → Hono (Cloudflare Workers)
fastify       → Fastify
@nestjs/core  → NestJS
koa           → Koa
django        → Django (check requirements.txt / pyproject.toml)
flask         → Flask
fastapi       → FastAPI
rails         → Ruby on Rails (check Gemfile)
laravel       → Laravel (check composer.json)
gin           → Go Gin (check go.mod)

# Also check for:
vite.config.*     → Vite-based
next.config.*     → Next.js
svelte.config.*   → SvelteKit
nuxt.config.*     → Nuxt
angular.json      → Angular
astro.config.*    → Astro
```

Record: `framework`, `language`, `file_extensions`, `routing_pattern`, `component_pattern`

### Phase 1: Discover Everything

**1.1 Find all pages/routes — by framework**

```bash
# ── React / Next.js ──────────────────────────────────────
# Next.js App Router
find src/app -name "page.tsx" -o -name "page.ts" -o -name "page.jsx" -o -name "page.js" | sort
# Next.js Pages Router
find src/pages -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" | grep -v "_app\|_document\|api/"
# React Router (Vite, CRA)
grep -r "path:" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"
grep -r "<Route" src/ --include="*.tsx" --include="*.jsx"
# Remix
find app/routes -name "*.tsx" -o -name "*.ts" | sort

# ── Svelte / SvelteKit ───────────────────────────────────
# SvelteKit routes
find src/routes -name "+page.svelte" | sort
# SvelteKit server routes
find src/routes -name "+server.ts" -o -name "+server.js" | sort
# SvelteKit layouts
find src/routes -name "+layout.svelte" | sort
# SvelteKit load functions
find src/routes -name "+page.ts" -o -name "+page.server.ts" | sort
# Standalone Svelte
find src -name "*.svelte" | sort

# ── Vue / Nuxt ───────────────────────────────────────────
# Nuxt 3 pages (file-based routing)
find pages -name "*.vue" | sort
# Nuxt 3 server routes
find server/api -name "*.ts" -o -name "*.js" | sort
# Vue Router
grep -r "path:" src/router/ --include="*.ts" --include="*.js"
find src/views -name "*.vue" -o -name "*.tsx" | sort
find src/pages -name "*.vue" | sort

# ── Angular ───────────────────────────────────────────────
# Angular components
find src/app -name "*.component.ts" | sort
# Angular routes
grep -r "path:" src/app/ --include="*routing*" --include="*routes*"
# Angular modules
find src/app -name "*.module.ts" | sort

# ── Astro ────────────────────────────────────���────────────
find src/pages -name "*.astro" -o -name "*.md" -o -name "*.mdx" | sort

# ── SolidJS ──────────────────────────────────────────────
find src/routes -name "*.tsx" -o -name "*.jsx" | sort

# ── Gatsby ────────────────────────────────────────────────
find src/pages -name "*.tsx" -o -name "*.jsx" -o -name "*.js" | sort

# ── Python (Django/Flask/FastAPI) ─────────────────────────
# Django
grep -rn "path(" */urls.py | sort
find . -name "views.py" -o -name "viewsets.py" | sort
# Flask
grep -rn "@app.route\|@blueprint.route" --include="*.py" | sort
# FastAPI
grep -rn "@app\.\(get\|post\|put\|delete\)\|@router\.\(get\|post\|put\|delete\)" --include="*.py" | sort

# ── Ruby on Rails ─────────────────────────────────────────
cat config/routes.rb
find app/controllers -name "*_controller.rb" | sort
find app/views -name "*.html.erb" -o -name "*.html.slim" | sort

# ── Go (Gin/Echo/Fiber) ──────────────────────────────────
grep -rn "\.GET\|\.POST\|\.PUT\|\.DELETE\|\.Group" --include="*.go" | sort

# ── PHP (Laravel) ─────────────────────────────────────────
cat routes/web.php routes/api.php
find resources/views -name "*.blade.php" | sort
find app/Http/Controllers -name "*.php" | sort
```

For each page found, record:
- File path
- Route URL
- Auth required (yes/no) — check for middleware, auth guards, session checks
- Layout (which layout wraps it)
- Framework-specific metadata

**1.2 Find all interactive elements per page**

Read each page file and ALL its imported components. Element patterns differ by framework:

```
# ── React / Next.js / Remix / SolidJS / Gatsby ──────────
BUTTONS: <button>, <Button>, onClick, onPress
LINKS: <a>, <Link>, href, to, navigate()
FORMS: <form>, <input>, <select>, <textarea>, onSubmit, handleSubmit
MODALS: <Dialog>, <Modal>, <Sheet>, <Drawer>, open/close state

# ── Svelte / SvelteKit ──────────────────────────────────
BUTTONS: <button>, on:click, use:action
LINKS: <a>, href, goto(), $page
FORMS: <form>, <input>, bind:value, on:submit, use:enhance
  - SvelteKit form actions: export const actions = { default: ... }
MODALS: {#if showModal}...{/if}, transition:, animate:
REACTIVE: $: derived, $store, on:change
SLOTS: <slot>, $$slots
EACH BLOCKS: {#each items as item}

# ── Vue / Nuxt ──────────────────────────────────────────
BUTTONS: <button>, @click, v-on:click
LINKS: <a>, <NuxtLink>, <RouterLink>, :to, :href
FORMS: <form>, <input>, v-model, @submit.prevent
  - Nuxt server routes: defineEventHandler
MODALS: v-if, v-show, <Teleport>, <Transition>
REACTIVE: ref(), reactive(), computed(), watch()
SLOTS: <slot>, v-slot

# ── Angular ─────────────────────────────────────────────
BUTTONS: <button>, (click), [disabled]
LINKS: <a>, routerLink, [routerLink]
FORMS: <form>, [(ngModel)], FormGroup, FormControl, (ngSubmit)
  - Reactive forms: this.form.get('field')
MODALS: *ngIf, MatDialog, MatBottomSheet
PIPES: | async, | date, | currency

# ── Astro ───────────────────────────────────────────────
BUTTONS: <button>, client:load, client:visible (island hydration)
LINKS: <a>, href
FORMS: <form>, action (server-side)
ISLANDS: client:load, client:idle, client:visible components

# ── Python templates (Django/Flask/Jinja) ────────────────
BUTTONS: <button>, {% url %}, {{ form.field }}
LINKS: <a href="{% url 'name' %}">
FORMS: <form>, {{ form.as_p }}, {% csrf_token %}
LOOPS: {% for item in items %}

# ── Ruby (ERB/Slim) ─────────────────────────────────────
BUTTONS: <%= button_to %>, <%= link_to %>
LINKS: <%= link_to "text", path %>
FORMS: <%= form_with %>, <%= form_for %>

# ── PHP (Blade) ──────────────────────────────��──────────
BUTTONS: <button>, wire:click (Livewire), x-on:click (Alpine)
LINKS: <a href="{{ route('name') }}">
FORMS: <form>, @csrf, <x-input>
```

For EVERY framework, also extract:
```
TABLES: data tables, sortable columns, pagination, row actions
LISTS: mapped/iterated arrays, virtualized lists, infinite scroll
DROPDOWNS: select, combobox, menu, popover
TABS: tab groups, active states
TOGGLES: switch, checkbox, radio
FILE UPLOADS: file input, drag-and-drop zones
SEARCH: search input, filter controls, typeahead
TOASTS/ALERTS: notification triggers, dismiss actions
LOADING STATES: skeleton, spinner, progress, suspense
EMPTY STATES: no-data views, zero-state CTAs
ERROR BOUNDARIES: error fallbacks, retry buttons
```

**1.3 Find all API endpoints — by framework**

```bash
# ── Next.js ──────────────────────────────────��───────────
find src/app/api -name "route.ts" -o -name "route.tsx" | sort
find src/pages/api -name "*.ts" -o -name "*.tsx" | sort

# ── SvelteKit ────────────────────────────────────────────
find src/routes -name "+server.ts" -o -name "+server.js" | sort
# Also form actions:
grep -rn "export const actions" src/routes/ --include="*.ts" --include="*.js"

# ── Nuxt ─────────────────────────────────────────────────
find server/api -name "*.ts" -o -name "*.js" | sort
find server/routes -name "*.ts" -o -name "*.js" | sort

# ── Express / Hono / Fastify / Koa / NestJS ─────────────
grep -rn "app\.\(get\|post\|put\|patch\|delete\)\|router\.\(get\|post\|put\|patch\|delete\)" src/ --include="*.ts" --include="*.js"
# NestJS decorators:
grep -rn "@Get\|@Post\|@Put\|@Patch\|@Delete" src/ --include="*.ts"
# Hono:
grep -rn "\.get(\|\.post(\|\.put(\|\.delete(" src/ --include="*.ts"

# ── Django ───────────────────────────────────────────────
grep -rn "path(" */urls.py
grep -rn "@api_view\|class.*ViewSet\|class.*APIView" --include="*.py"

# ── Flask ────────────────────────────────────────────────
grep -rn "@app.route\|@blueprint.route\|@api.route" --include="*.py"

# ── FastAPI ──────────────────────────────────────────────
grep -rn "@app\.\(get\|post\|put\|delete\)\|@router\.\(get\|post\|put\|delete\)" --include="*.py"

# ── Ruby on Rails ────────────────────────────────────────
cat config/routes.rb
grep -rn "def " app/controllers/ --include="*.rb"

# ── Go ───────────────────────────────────────────────────
grep -rn "\.GET\|\.POST\|\.PUT\|\.DELETE\|\.Handle\|\.HandleFunc" --include="*.go"

# ── Laravel ──────────────────────────────────────────────
cat routes/api.php routes/web.php
grep -rn "Route::" routes/ --include="*.php"
```

For each endpoint, extract:
- Method (GET, POST, PUT, PATCH, DELETE)
- Path (with params like `:id`, `[id]`, `{id}`, `<int:id>`)
- Request body schema (Zod, TypeScript types, Pydantic, serializers, Form Requests)
- Response schema
- Auth required (middleware, guards, decorators, policies)
- Rate limiting

**1.4 Find all data flows (frontend → API → database)**

For each page, trace:
```
Component → fetch/axios/trpc call → API endpoint → database query
```

Record the full chain so integration tests cover end-to-end.

---

### Phase 2: Generate Test Infrastructure

**2.1 Playwright config**

Create `playwright.config.ts` with multi-environment support:

```typescript
import { defineConfig, devices } from '@playwright/test';

const env = process.env.TEST_ENV || 'local';

const envConfig: Record<string, { baseURL: string; webServer?: any }> = {
  local: {
    baseURL: 'http://localhost:3000',
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
    },
  },
  staging: {
    baseURL: process.env.STAGING_URL || 'https://staging.myapp.com',
  },
  production: {
    baseURL: process.env.PRODUCTION_URL || 'https://myapp.com',
  },
};

const current = envConfig[env] || envConfig.local;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['json', { outputFile: 'e2e/results.json' }]],
  use: {
    baseURL: current.baseURL,
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on-first-retry',
    extraHTTPHeaders: {
      // Pass auth token for staging/production API tests
      ...(process.env.TEST_AUTH_TOKEN
        ? { Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}` }
        : {}),
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 15'] } },
    { name: 'tablet', use: { ...devices['iPad Mini'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  ...(current.webServer ? { webServer: current.webServer } : {}),
});
```

Run against different environments:
```bash
# Local (starts dev server automatically)
TEST_ENV=local npx playwright test

# Staging (no dev server, hits real staging URL)
TEST_ENV=staging STAGING_URL=https://staging.myapp.com npx playwright test

# Production (read-only tests, no mutations)
TEST_ENV=production PRODUCTION_URL=https://myapp.com npx playwright test --grep @readonly

# With auth token for protected staging/prod
TEST_ENV=staging TEST_AUTH_TOKEN=xxx npx playwright test
```

The commands support URL directly:
```
/browser-test http://localhost:3000             # Local
/browser-test https://staging.myapp.com         # Staging
/browser-test https://myapp.com                 # Production (auto read-only mode)
/heal https://staging.myapp.com                 # Self-heal staging
```

When targeting production:
- All mutation tests (POST, PUT, DELETE) are **skipped** automatically
- Only read-only tests run (GET, page loads, navigation, visual checks)
- Screenshots are captured but no code fixes are applied
- Report flags issues to fix in development

When targeting staging:
- Full test suite runs including mutations
- Uses staging test account credentials
- Auto-fix is enabled (fixes code locally, retest against staging)
- Screenshots captured for visual regression vs production
```

**2.2 Auth fixture**

Create `e2e/fixtures/auth.ts`:

```typescript
import { test as base, expect } from '@playwright/test';

type AuthFixture = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixture>({
  authenticatedPage: async ({ page }, use) => {
    // Read credentials from .luna/rules.yaml or env
    await page.goto('/auth/signin');
    await page.getByLabel('Email').fill(process.env.TEST_EMAIL || 'test@example.com');
    await page.getByLabel('Password').fill(process.env.TEST_PASSWORD || 'TestPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**');
    await use(page);
  },
});

export { expect };
```

**2.3 Page Object for each page**

For EVERY page discovered in Phase 1, create a Page Object:

```typescript
// e2e/pages/{page-name}.page.ts
import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  // One locator per interactive element found in Phase 1
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly searchInput: Locator;
  readonly dataTable: Locator;
  readonly filterDropdown: Locator;
  readonly paginationNext: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.createButton = page.getByRole('button', { name: /create/i });
    this.searchInput = page.getByPlaceholder(/search/i);
    this.dataTable = page.getByRole('table');
    this.filterDropdown = page.getByRole('combobox');
    this.paginationNext = page.getByRole('button', { name: /next/i });
    this.emptyState = page.getByText(/no.*found/i);
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
  }

  async clickCreate() {
    await this.createButton.click();
  }
}
```

---

### Phase 3: Generate Tests Per Page

For EVERY page, generate these test categories:

**3.1 Render tests** — page loads, all elements visible

```typescript
test.describe('{PageName} — Render', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('{route}');
    await expect(page).toHaveTitle(/{expected title}/i);
    // No console errors
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    expect(errors).toHaveLength(0);
  });

  test('all critical elements are visible', async ({ page }) => {
    await page.goto('{route}');
    // For EACH element found in Phase 1:
    await expect(page.getByRole('heading')).toBeVisible();
    await expect(page.getByRole('button', { name: /create/i })).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
    // ... every element
  });

  test('page is responsive — mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('{route}');
    // Check no horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
```

**3.2 Interaction tests** — click, type, select, submit

```typescript
test.describe('{PageName} — Interactions', () => {
  // For EACH button:
  test('"{buttonName}" button works', async ({ page }) => {
    await page.goto('{route}');
    await page.getByRole('button', { name: '{buttonName}' }).click();
    // Assert expected result (navigation, modal opens, data changes)
  });

  // For EACH form:
  test('form submits with valid data', async ({ page }) => {
    await page.goto('{route}');
    // Fill each input with valid data
    await page.getByLabel('{fieldLabel}').fill('{validValue}');
    await page.getByRole('button', { name: /submit|save|create/i }).click();
    // Assert success (toast, redirect, data appears)
  });

  test('form shows validation errors', async ({ page }) => {
    await page.goto('{route}');
    // Submit empty or invalid
    await page.getByRole('button', { name: /submit|save|create/i }).click();
    // Assert error messages visible for each required field
    await expect(page.getByText(/required|invalid/i)).toBeVisible();
  });

  // For EACH link:
  test('"{linkText}" navigates correctly', async ({ page }) => {
    await page.goto('{route}');
    await page.getByRole('link', { name: '{linkText}' }).click();
    await expect(page).toHaveURL('{expectedURL}');
  });

  // For EACH search:
  test('search returns results', async ({ page }) => {
    await page.goto('{route}');
    await page.getByPlaceholder(/search/i).fill('test query');
    await page.getByPlaceholder(/search/i).press('Enter');
    // Assert results appear or empty state
  });

  // For EACH table:
  test('table sorts by column', async ({ page }) => {
    await page.goto('{route}');
    await page.getByRole('columnheader', { name: '{columnName}' }).click();
    // Assert sort order changed
  });

  test('table pagination works', async ({ page }) => {
    await page.goto('{route}');
    await page.getByRole('button', { name: /next/i }).click();
    // Assert page changed
  });

  // For EACH modal/dialog:
  test('modal opens and closes', async ({ page }) => {
    await page.goto('{route}');
    await page.getByRole('button', { name: '{triggerButton}' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /close|cancel/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  // For EACH dropdown/select:
  test('dropdown selects option', async ({ page }) => {
    await page.goto('{route}');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: '{optionName}' }).click();
    // Assert selection reflected
  });
});
```

**3.3 Auth flow tests**

```typescript
test.describe('{PageName} — Auth', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('{protected_route}');
    await expect(page).toHaveURL(/auth|signin|login/);
  });

  test('shows content when authenticated', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('{protected_route}');
    await expect(authenticatedPage.getByRole('heading')).toBeVisible();
  });

  test('hides admin-only elements for regular user', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('{route}');
    await expect(authenticatedPage.getByRole('button', { name: /delete|admin/i })).not.toBeVisible();
  });
});
```

**3.4 Error and edge case tests**

```typescript
test.describe('{PageName} — Edge Cases', () => {
  test('shows empty state when no data', async ({ page }) => {
    // Intercept API to return empty array
    await page.route('**/api/{endpoint}', route =>
      route.fulfill({ json: [] })
    );
    await page.goto('{route}');
    await expect(page.getByText(/no.*found|empty|get started/i)).toBeVisible();
  });

  test('shows error state on API failure', async ({ page }) => {
    await page.route('**/api/{endpoint}', route =>
      route.fulfill({ status: 500, json: { error: 'Server error' } })
    );
    await page.goto('{route}');
    await expect(page.getByText(/error|something went wrong|try again/i)).toBeVisible();
  });

  test('handles slow network gracefully', async ({ page }) => {
    await page.route('**/api/**', route =>
      new Promise(resolve => setTimeout(() => resolve(route.continue()), 3000))
    );
    await page.goto('{route}');
    // Should show loading state
    await expect(page.getByText(/loading/i).or(page.locator('[data-loading]'))).toBeVisible();
  });
});
```

**3.5 Keyboard accessibility tests**

```typescript
test.describe('{PageName} — Keyboard', () => {
  test('can tab through all interactive elements', async ({ page }) => {
    await page.goto('{route}');
    // Tab through each element, verify focus
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link').first()).toBeFocused();
    await page.keyboard.press('Tab');
    // Continue for each interactive element
  });

  test('can submit form with keyboard', async ({ page }) => {
    await page.goto('{route}');
    await page.getByLabel('{field}').fill('test');
    await page.keyboard.press('Enter');
    // Assert form submitted
  });

  test('can close modal with Escape', async ({ page }) => {
    await page.goto('{route}');
    await page.getByRole('button', { name: '{trigger}' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
```

---

### Phase 4: Generate API Tests

For EVERY API endpoint found in Phase 1:

```typescript
// e2e/api/{resource}.api.test.ts
import { test, expect } from '@playwright/test';

test.describe('API: /api/{resource}', () => {
  // GET — list
  test('GET /api/{resource} returns list', async ({ request }) => {
    const response = await request.get('/api/{resource}', {
      headers: { Authorization: 'Bearer {test_token}' },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  // GET — single
  test('GET /api/{resource}/:id returns item', async ({ request }) => {
    const response = await request.get('/api/{resource}/test-id', {
      headers: { Authorization: 'Bearer {test_token}' },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveProperty('id');
  });

  // POST — create
  test('POST /api/{resource} creates item', async ({ request }) => {
    const response = await request.post('/api/{resource}', {
      headers: { Authorization: 'Bearer {test_token}' },
      data: {
        // Fill with valid data based on schema from Phase 1
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data).toHaveProperty('id');
  });

  // POST — validation error
  test('POST /api/{resource} rejects invalid data', async ({ request }) => {
    const response = await request.post('/api/{resource}', {
      headers: { Authorization: 'Bearer {test_token}' },
      data: {},  // Empty body
    });
    expect(response.status()).toBe(400);
  });

  // PUT — update
  test('PUT /api/{resource}/:id updates item', async ({ request }) => {
    const response = await request.put('/api/{resource}/test-id', {
      headers: { Authorization: 'Bearer {test_token}' },
      data: { name: 'Updated Name' },
    });
    expect(response.status()).toBe(200);
  });

  // DELETE
  test('DELETE /api/{resource}/:id removes item', async ({ request }) => {
    const response = await request.delete('/api/{resource}/test-id', {
      headers: { Authorization: 'Bearer {test_token}' },
    });
    expect(response.status()).toBe(200);
  });

  // Auth — unauthorized
  test('returns 401 without auth', async ({ request }) => {
    const response = await request.get('/api/{resource}');
    expect(response.status()).toBe(401);
  });

  // Auth — forbidden
  test('returns 403 for unauthorized role', async ({ request }) => {
    const response = await request.delete('/api/{resource}/test-id', {
      headers: { Authorization: 'Bearer {viewer_token}' },
    });
    expect(response.status()).toBe(403);
  });
});
```

---

### Phase 5: Generate Integration Tests (Frontend ↔ API)

For each data flow discovered in Phase 1.4:

```typescript
// e2e/integration/{feature}.integration.test.ts
test.describe('Integration: {Feature}', () => {
  test('create from UI reflects in API and list', async ({ authenticatedPage, request }) => {
    // Step 1: Create via UI
    await authenticatedPage.goto('/{feature}/new');
    await authenticatedPage.getByLabel('Name').fill('Test Item');
    await authenticatedPage.getByRole('button', { name: /create|save/i }).click();

    // Step 2: Verify success in UI
    await expect(authenticatedPage.getByText('Test Item')).toBeVisible();

    // Step 3: Verify via API
    const response = await request.get('/api/{feature}', {
      headers: { Authorization: 'Bearer {token}' },
    });
    const body = await response.json();
    expect(body.data.some((item: any) => item.name === 'Test Item')).toBe(true);
  });

  test('delete from UI removes from API', async ({ authenticatedPage, request }) => {
    // Step 1: Delete via UI
    await authenticatedPage.goto('/{feature}');
    await authenticatedPage.getByRole('button', { name: /delete/i }).first().click();
    await authenticatedPage.getByRole('button', { name: /confirm/i }).click();

    // Step 2: Verify removed from UI
    await expect(authenticatedPage.getByText('Deleted Item')).not.toBeVisible();

    // Step 3: Verify via API returns 404
    const response = await request.get('/api/{feature}/deleted-id');
    expect(response.status()).toBe(404);
  });

  test('API changes reflect in UI on refresh', async ({ authenticatedPage, request }) => {
    // Step 1: Create via API
    await request.post('/api/{feature}', {
      headers: { Authorization: 'Bearer {token}' },
      data: { name: 'API Created' },
    });

    // Step 2: Refresh UI and verify
    await authenticatedPage.goto('/{feature}');
    await expect(authenticatedPage.getByText('API Created')).toBeVisible();
  });
});
```

---

### Phase 6: Run All Tests

```bash
# Run all tests
npx playwright test

# Capture results
npx playwright test --reporter=json > e2e/results.json
```

Parse results: count pass/fail per test file, per category.

---

### Phase 7: Fix Failures

For each failing test:

1. **Read the error** — extract error message, stack trace, screenshot
2. **Read the source code** — the component/route that failed
3. **Determine the fix category**:
   - Missing element → add it to the component
   - Wrong selector → fix the test selector to match actual markup
   - API returns wrong status → fix the API handler
   - Missing validation → add Zod validation
   - Missing error state → add error boundary/fallback
   - Missing loading state → add suspense/skeleton
   - Missing empty state → add empty state component
   - Layout broken → fix CSS/Tailwind classes
   - Auth redirect missing → add middleware check
4. **Apply fix** — edit the source file (max 100 lines per file)
5. **Re-run ONLY the failing test** to verify:
   ```bash
   npx playwright test {test-file} --grep "{test-name}"
   ```
6. **If still fails** — try different fix approach
7. **Max 3 attempts per test** — then log as blocker

---

### Phase 8: Loop Until All Pass

```
Run all tests → collect failures
  → Fix each failure → retest each fix
  → Run all tests again → collect remaining failures
  → Fix remaining → retest
  → Repeat until: all pass OR max 5 iterations
```

---

### Phase 9: Generate Report

Create `.luna/{project}/full-test-report.md`:

```markdown
# Full Test Report

## Summary
- Pages tested: {N}
- API endpoints tested: {N}
- Integration flows tested: {N}
- Total tests: {N}
- Passed: {N} ✓
- Fixed (auto): {N} ����
- Blocked: {N} ✗

## Per Page Results
| Page | Route | Tests | Pass | Fixed | Blocked |
|------|-------|-------|------|-------|---------|
| Dashboard | /dashboard | 24 | 22 | 2 | 0 |
| Settings | /settings | 18 | 18 | 0 | 0 |

## Per API Results
| Endpoint | Method | Tests | Pass | Fixed | Blocked |
|----------|--------|-------|------|-------|---------|
| /api/workflows | GET | 4 | 4 | 0 | 0 |
| /api/workflows | POST | 6 | 5 | 1 | 0 |

## Fixes Applied
| File | Issue | Fix |
|------|-------|-----|
| src/components/Button.tsx | Overflow on mobile | Added max-w-full |
| src/app/api/teams/route.ts | Missing 403 for viewer | Added RBAC check |

## Blockers
| Test | Error | Attempts |
|------|-------|----------|
| (none — all passed) | | |

## Screenshots
See .luna/{project}/browser-test/screenshots/
```

## Output Files

```
e2e/
  playwright.config.ts
  fixtures/
    auth.ts
  pages/
    {page-name}.page.ts        # One per page
  flows/
    {page-name}.render.test.ts
    {page-name}.interaction.test.ts
    {page-name}.auth.test.ts
    {page-name}.edge.test.ts
    {page-name}.keyboard.test.ts
  api/
    {resource}.api.test.ts     # One per API resource
  integration/
    {feature}.integration.test.ts
.luna/{project}/
  full-test-report.md
  browser-test/screenshots/
```

## Rules

- Max 100 lines per test file — split by category (render, interaction, auth, edge)
- Use Page Object Model — never raw selectors in tests
- Prefer accessible selectors: getByRole, getByLabel, getByText
- Never use data-testid unless no semantic alternative exists
- Tests must be independent — no shared state between tests
- Each test cleans up after itself
- Screenshots on every failure
