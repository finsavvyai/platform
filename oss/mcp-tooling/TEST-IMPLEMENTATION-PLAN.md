# Test Implementation Plan - MCPOverflow

**Start Date**: 2025-11-08
**Target Completion**: 10-12 weeks (2 engineers) or 15-17 weeks (1 engineer)
**Target Coverage**: 85%+

---

## Overview

This plan provides a **week-by-week roadmap** to achieve production-ready test coverage for MCPOverflow. The plan is organized by priority, with critical paths addressed first.

### Success Criteria:
- ✅ 85%+ overall test coverage
- ✅ 100% coverage on critical business logic
- ✅ Integration tests for all major flows
- ✅ E2E tests for key user journeys
- ✅ Automated CI/CD pipeline
- ✅ Performance benchmarks established

---

## Phase 1: Critical Path Testing (Weeks 1-4)

### Week 1: Test Infrastructure Setup

**Goal**: Establish testing foundation and tooling

#### Tasks:

**Day 1-2: CI/CD Pipeline Setup**
- [ ] Create GitHub Actions workflow (`.github/workflows/test.yml`)
  ```yaml
  name: Tests
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - Checkout code
        - Setup Node.js
        - Setup Go
        - Run npm install
        - Run unit tests
        - Run integration tests
        - Upload coverage to Codecov
  ```
- [ ] Configure Codecov for coverage reporting
- [ ] Set up branch protection rules (require tests to pass)

**Day 3: Frontend Test Infrastructure**
- [ ] Configure Vitest with coverage thresholds
  ```typescript
  // vite.config.ts
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70
    }
  }
  ```
- [ ] Set up React Testing Library helpers
- [ ] Create test utilities file (`src/test/utils.tsx`)

**Day 4: Backend Test Infrastructure**
- [ ] Set up Go test framework with testify
- [ ] Create test database setup/teardown helpers
- [ ] Configure Go test coverage reporting

**Day 5: Integration Test Environment**
- [ ] Set up testcontainers for PostgreSQL
- [ ] Create integration test database seed data
- [ ] Configure test environment variables

**Deliverable**: Complete test infrastructure ready for development

---

### Week 2: Core Generator Testing

**Goal**: Test the critical OpenAPI → MCP conversion logic

#### Tasks:

**Day 1-2: OpenAPI Parser Tests** (`src/lib/generator.ts`)

**Test File**: `src/lib/__tests__/generator.test.ts`

```typescript
describe('OpenAPIParser', () => {
  describe('detectAuthMode', () => {
    it('should detect API key authentication', () => {
      const spec = {
        components: {
          securitySchemes: {
            apiKey: { type: 'apiKey', in: 'header' }
          }
        }
      }
      const parser = new OpenAPIParser(spec)
      expect(parser.detectAuthMode()).toBe('api_key')
    })

    it('should detect OAuth2 authentication', () => {
      // Test OAuth detection
    })

    it('should detect JWT authentication', () => {
      // Test JWT detection
    })

    it('should default to none when no auth scheme', () => {
      // Test no auth
    })
  })

  describe('buildInputSchema', () => {
    it('should build schema from path parameters', () => {
      // Test parameter parsing
    })

    it('should include request body in schema', () => {
      // Test body parsing
    })

    it('should mark required parameters correctly', () => {
      // Test required field detection
    })
  })

  describe('buildOutputSchema', () => {
    it('should extract success response schema', () => {
      // Test 200/201 response parsing
    })

    it('should flatten nested schemas', () => {
      // Test schema flattening
    })

    it('should handle missing response schema', () => {
      // Test default case
    })
  })

  describe('extractTools', () => {
    it('should convert OpenAPI paths to MCP tools', () => {
      // Test tool extraction
    })

    it('should exclude health/admin endpoints', () => {
      // Test path exclusion
    })

    it('should generate unique tool names', () => {
      // Test name generation
    })
  })
})
```

**Test Cases**: 20-25 tests covering all methods

**Day 3-4: Code Generator Tests**

**Test File**: `packages/codegen/__tests__/generator.test.ts`

```typescript
describe('GoMCPGenerator', () => {
  describe('generateServer', () => {
    it('should generate valid Go code', () => {
      const manifest = createTestManifest()
      const code = generator.generateServer(manifest)

      // Verify code compiles
      expect(code).toContain('package main')
      expect(code).toContain('func main()')
    })

    it('should include all tools from manifest', () => {
      // Test tool generation
    })

    it('should generate auth handlers', () => {
      // Test auth code generation
    })

    it('should handle different auth modes', () => {
      // Test API key, OAuth, JWT, none
    })
  })

  describe('generateAgentKitIntegration', () => {
    it('should generate AgentKit compatible code', () => {
      // Test AgentKit integration
    })
  })
})
```

**Test Cases**: 15-20 tests

**Day 5: Worker Code Generation Tests**

**Test**: `generateWorkerCode()` function

```typescript
describe('generateWorkerCode', () => {
  it('should generate Cloudflare Worker code', () => {
    const tools = [createTestTool()]
    const code = generateWorkerCode('test-api', tools, 'api_key')

    expect(code).toContain('export default')
    expect(code).toContain('addEventListener("fetch"')
  })

  it('should include CORS headers', () => {
    // Test CORS header generation
  })

  it('should handle different auth modes in workers', () => {
    // Test auth in worker code
  })
})
```

**Deliverable**: 40-50 tests for core generator logic, 90%+ coverage

---

### Week 3: OpenAPI Parser Package Tests

**Goal**: Test the @mcpoverflow/openapi-parser package

#### Tasks:

**Day 1-2: Parser Core Tests**

**Test File**: `packages/openapi-parser/__tests__/parser.test.ts`

```typescript
describe('OpenAPIParser', () => {
  describe('parse', () => {
    it('should parse valid OpenAPI 3.0 spec', async () => {
      const spec = loadFixture('petstore.yaml')
      const result = await parser.parse(spec)
      expect(result.valid).toBe(true)
    })

    it('should validate OpenAPI schema', () => {
      // Test schema validation
    })

    it('should resolve $ref references', () => {
      // Test ref resolution
    })

    it('should handle YAML and JSON formats', () => {
      // Test format handling
    })

    it('should reject invalid specs', () => {
      // Test validation errors
    })
  })

  describe('extractEndpoints', () => {
    it('should extract all paths and methods', () => {
      // Test endpoint extraction
    })

    it('should include path parameters', () => {
      // Test parameter extraction
    })

    it('should include request/response schemas', () => {
      // Test schema extraction
    })
  })

  describe('extractSecuritySchemes', () => {
    it('should identify all security schemes', () => {
      // Test security extraction
    })
  })
})
```

**Test Cases**: 25-30 tests

**Day 3: GraphQL Parser Tests**

**Test File**: `services/api-service/internal/parser/graphql_test.go`

```go
func TestGraphQLParser(t *testing.T) {
    t.Run("Parse GraphQL schema", func(t *testing.T) {
        schema := loadTestSchema()
        result, err := ParseGraphQL(schema)
        assert.NoError(t, err)
        assert.NotNil(t, result)
    })

    t.Run("Extract queries and mutations", func(t *testing.T) {
        // Test query/mutation extraction
    })

    t.Run("Handle custom scalars", func(t *testing.T) {
        // Test scalar types
    })
}
```

**Test Cases**: 15-20 tests

**Day 4: Postman Collection Parser Tests**

**Test File**: `services/api-service/internal/parser/postman_test.go`

```go
func TestPostmanParser(t *testing.T) {
    t.Run("Parse Postman collection v2.1", func(t *testing.T) {
        collection := loadTestCollection()
        result, err := ParsePostman(collection)
        assert.NoError(t, err)
    })

    t.Run("Extract request examples", func(t *testing.T) {
        // Test example extraction
    })

    t.Run("Convert Postman auth to MCP auth", func(t *testing.T) {
        // Test auth conversion
    })
}
```

**Test Cases**: 10-15 tests

**Day 5: Edge Cases and Error Handling**
- [ ] Test malformed specs
- [ ] Test extremely large specs (1000+ endpoints)
- [ ] Test circular references
- [ ] Test missing required fields
- [ ] Test deprecated features

**Deliverable**: 50-65 tests for parser package, 85%+ coverage

---

### Week 4: API Handler Tests (Backend)

**Goal**: Test all Go API handlers

#### Tasks:

**Day 1: Connector Handler Tests**

**Test File**: `services/api-service/internal/handlers/connector_handler_test.go`

```go
func TestConnectorHandler(t *testing.T) {
    // Setup test database and handler
    db := setupTestDB(t)
    defer db.Close()
    handler := NewConnectorHandler(db)

    t.Run("CreateConnector", func(t *testing.T) {
        req := &CreateConnectorRequest{
            Name: "test-api",
            Spec: testSpec,
        }
        resp, err := handler.CreateConnector(context.Background(), req)
        assert.NoError(t, err)
        assert.NotEmpty(t, resp.ID)
    })

    t.Run("ListConnectors with pagination", func(t *testing.T) {
        // Test list with pagination
    })

    t.Run("GetConnector by ID", func(t *testing.T) {
        // Test get by ID
    })

    t.Run("UpdateConnector", func(t *testing.T) {
        // Test update
    })

    t.Run("DeleteConnector", func(t *testing.T) {
        // Test delete with cascade
    })

    t.Run("Unauthorized access denied", func(t *testing.T) {
        // Test authorization
    })
}
```

**Test Cases**: 25-30 tests

**Day 2: Job Handler Tests**

**Test File**: `services/api-service/internal/handlers/job_handler_test.go`

```go
func TestJobHandler(t *testing.T) {
    t.Run("CreateJob", func(t *testing.T) {
        // Test job creation
    })

    t.Run("GetJobStatus", func(t *testing.T) {
        // Test status retrieval
    })

    t.Run("GetJobLogs with streaming", func(t *testing.T) {
        // Test log streaming
    })

    t.Run("CancelJob", func(t *testing.T) {
        // Test cancellation
    })

    t.Run("RetryFailedJob", func(t *testing.T) {
        // Test retry logic
    })
}
```

**Test Cases**: 15-20 tests

**Day 3: Deployment Handler Tests**

**Test File**: `services/api-service/internal/handlers/deployment_handler_test.go`

```go
func TestDeploymentHandler(t *testing.T) {
    t.Run("DeployToCloudflare", func(t *testing.T) {
        // Mock Cloudflare API
        mockCF := setupMockCloudflare()
        // Test deployment
    })

    t.Run("Handle deployment failure", func(t *testing.T) {
        // Test failure handling
    })

    t.Run("Rollback deployment", func(t *testing.T) {
        // Test rollback
    })
}
```

**Test Cases**: 10-15 tests

**Day 4: Auth & User Handler Tests**
- [ ] Test authentication endpoints
- [ ] Test user CRUD operations
- [ ] Test password reset flow
- [ ] Test email verification

**Test Cases**: 20-25 tests

**Day 5: Usage & Webhook Handler Tests**
- [ ] Test usage metrics collection
- [ ] Test metrics aggregation
- [ ] Test webhook creation/management
- [ ] Test webhook delivery

**Test Cases**: 15-20 tests

**Deliverable**: 85-110 tests for all handlers, 80%+ coverage on handlers

---

## Phase 2: Integration Testing (Weeks 5-6)

### Week 5: Critical Flow Integration Tests

**Goal**: Test end-to-end flows through the system

#### Tasks:

**Day 1-2: Connector Creation Flow**

**Test File**: `services/api-service/test/integration/connector_creation_test.go`

```go
func TestConnectorCreationFlow(t *testing.T) {
    // Setup test environment with real DB
    env := setupIntegrationTest(t)
    defer env.Cleanup()

    t.Run("Complete flow: Upload → Parse → Generate → Store", func(t *testing.T) {
        // 1. Upload OpenAPI spec
        uploadResp := env.Client.UploadSpec(testSpec)
        assert.NotEmpty(t, uploadResp.ID)

        // 2. Trigger parsing
        parseResp := env.Client.ParseSpec(uploadResp.ID)
        assert.True(t, parseResp.Success)

        // 3. Generate MCP worker
        genResp := env.Client.GenerateWorker(uploadResp.ID)
        assert.NotEmpty(t, genResp.WorkerCode)

        // 4. Verify stored in database
        connector := env.DB.GetConnector(uploadResp.ID)
        assert.Equal(t, "active", connector.Status)
    })

    t.Run("Handle invalid spec gracefully", func(t *testing.T) {
        // Test error handling
    })

    t.Run("Support all spec formats", func(t *testing.T) {
        // Test OpenAPI, GraphQL, Postman
    })
}
```

**Test Cases**: 8-10 integration tests

**Day 3: Deployment Flow**

**Test File**: `services/api-service/test/integration/deployment_test.go`

```go
func TestDeploymentFlow(t *testing.T) {
    env := setupIntegrationTest(t)

    t.Run("Deploy worker to Cloudflare", func(t *testing.T) {
        // Create connector
        connector := env.CreateTestConnector()

        // Trigger deployment
        deployResp := env.Client.Deploy(connector.ID)
        assert.Equal(t, "pending", deployResp.Status)

        // Wait for completion (use test timeout)
        env.WaitForJobCompletion(deployResp.JobID, 30*time.Second)

        // Verify deployment
        deployment := env.DB.GetDeployment(deployResp.ID)
        assert.Equal(t, "deployed", deployment.Status)
        assert.NotEmpty(t, deployment.WorkerURL)
    })

    t.Run("Handle deployment failures", func(t *testing.T) {
        // Test failure scenarios
    })
}
```

**Test Cases**: 5-8 integration tests

**Day 4: Authentication Flow**

**Test File**: `services/api-service/test/integration/auth_test.go`

```go
func TestAuthenticationFlow(t *testing.T) {
    env := setupIntegrationTest(t)

    t.Run("Complete signup flow", func(t *testing.T) {
        // Sign up
        signupResp := env.Client.SignUp("test@example.com", "password")
        assert.NotEmpty(t, signupResp.UserID)

        // Verify email (mock)
        env.Client.VerifyEmail(signupResp.VerificationToken)

        // Login
        loginResp := env.Client.Login("test@example.com", "password")
        assert.NotEmpty(t, loginResp.SessionToken)

        // Access protected resource
        connectors := env.Client.ListConnectors(loginResp.SessionToken)
        assert.NotNil(t, connectors)
    })

    t.Run("Multi-domain SSO", func(t *testing.T) {
        // Test cross-domain authentication
    })
}
```

**Test Cases**: 6-8 integration tests

**Day 5: Job Processing Flow**
- [ ] Test job lifecycle (create → running → completed)
- [ ] Test concurrent job processing
- [ ] Test job retry logic
- [ ] Test job cancellation

**Test Cases**: 8-10 integration tests

**Deliverable**: 27-36 integration tests covering critical flows

---

### Week 6: Database & External API Integration Tests

#### Tasks:

**Day 1-2: Database Integration Tests**

**Test File**: `services/api-service/test/integration/database_test.go`

```go
func TestDatabaseIntegration(t *testing.T) {
    db := setupTestDB(t)

    t.Run("RLS policies enforce user isolation", func(t *testing.T) {
        user1 := createTestUser("user1")
        user2 := createTestUser("user2")

        // User1 creates connector
        connector := createConnector(db, user1.ID)

        // User2 attempts to access
        _, err := getConnector(db, user2.ID, connector.ID)
        assert.Error(t, err) // Should be denied by RLS
    })

    t.Run("Cascade deletes work correctly", func(t *testing.T) {
        user := createTestUser("user")
        connector := createConnector(db, user.ID)
        job := createJob(db, connector.ID)

        // Delete connector
        deleteConnector(db, connector.ID)

        // Verify job is deleted
        _, err := getJob(db, job.ID)
        assert.Error(t, err)
    })

    t.Run("Triggers fire correctly", func(t *testing.T) {
        connector := createConnector(db, user.ID)

        // Update connector
        updateConnector(db, connector.ID, updates)

        // Verify updated_at changed
        updated := getConnector(db, connector.ID)
        assert.True(t, updated.UpdatedAt.After(connector.UpdatedAt))
    })

    t.Run("Full-text search works", func(t *testing.T) {
        // Create connectors with different names
        // Test search functionality
    })
}
```

**Test Cases**: 12-15 tests

**Day 3: Supabase Integration Tests**

**Test File**: `src/lib/__tests__/supabase-integration.test.ts`

```typescript
describe('Supabase Integration', () => {
  it('should authenticate users', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'Test123!@#'
    })
    expect(error).toBeNull()
    expect(data.user).toBeTruthy()
  })

  it('should handle RLS policies', async () => {
    // Test row-level security
  })

  it('should sync user profiles', async () => {
    // Test profile creation on signup
  })
})
```

**Test Cases**: 8-10 tests

**Day 4: Cloudflare API Integration Tests**

**Test File**: `services/api-service/test/integration/cloudflare_test.go`

```go
func TestCloudflareIntegration(t *testing.T) {
    // Use test Cloudflare account
    cf := setupTestCloudflare(t)

    t.Run("Deploy worker successfully", func(t *testing.T) {
        code := generateTestWorkerCode()
        result := cf.DeployWorker("test-worker", code)
        assert.True(t, result.Success)
    })

    t.Run("Update existing worker", func(t *testing.T) {
        // Test worker updates
    })

    t.Run("Delete worker", func(t *testing.T) {
        // Test cleanup
    })
}
```

**Test Cases**: 6-8 tests

**Day 5: Complete Frontend Database Tests**

Implement the placeholder tests in `src/lib/__tests__/database.test.ts`

**Deliverable**: 26-33 additional integration tests

---

## Phase 3: Frontend & E2E Testing (Weeks 7-9)

### Week 7: Frontend Page Tests

**Goal**: Test all React page components

#### Tasks:

**Day 1: Dashboard Page Tests**

**Test File**: `src/pages/__tests__/Dashboard.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dashboard } from '../Dashboard'

describe('Dashboard', () => {
  it('should display connector list', async () => {
    const mockConnectors = [
      { id: '1', name: 'test-api', status: 'active' }
    ]

    render(<Dashboard />, {
      wrapper: TestWrapper,
      connectors: mockConnectors
    })

    await waitFor(() => {
      expect(screen.getByText('test-api')).toBeInTheDocument()
    })
  })

  it('should filter connectors by status', async () => {
    // Test filtering
  })

  it('should handle empty state', () => {
    // Test empty state UI
  })

  it('should navigate to connector detail on click', async () => {
    // Test navigation
  })

  it('should show delete confirmation modal', async () => {
    // Test delete flow
  })
})
```

**Test Cases**: 15-20 tests

**Day 2: Generate Page Tests**

**Test File**: `src/pages/__tests__/Generate.test.tsx`

```typescript
describe('Generate', () => {
  it('should upload OpenAPI spec file', async () => {
    const user = userEvent.setup()
    render(<Generate />)

    const file = new File(['openapi spec'], 'spec.yaml', {
      type: 'text/yaml'
    })
    const input = screen.getByLabelText(/upload/i)

    await user.upload(input, file)

    expect(screen.getByText('spec.yaml')).toBeInTheDocument()
  })

  it('should validate spec before generation', async () => {
    // Test validation
  })

  it('should show generation progress', async () => {
    // Test progress UI
  })

  it('should handle generation errors', async () => {
    // Test error handling
  })

  it('should support spec URL input', async () => {
    // Test URL input
  })
})
```

**Test Cases**: 12-15 tests

**Day 3: ConnectorDetail Page Tests**

```typescript
describe('ConnectorDetail', () => {
  it('should display connector information', () => {
    // Test info display
  })

  it('should show job status and logs', async () => {
    // Test job monitoring
  })

  it('should enable deployment button when ready', () => {
    // Test deployment UI
  })

  it('should display generated code preview', () => {
    // Test code preview
  })
})
```

**Test Cases**: 10-12 tests

**Day 4: Settings & Auth Pages Tests**
- [ ] Settings page (profile update, preferences)
- [ ] Login page (form validation, error handling)
- [ ] ForgotPassword page (email validation, success state)
- [ ] ResetPassword page (token validation, password strength)

**Test Cases**: 20-25 tests

**Day 5: Component Tests**
- [ ] Layout, Header components
- [ ] ProtectedRoute (auth redirects)
- [ ] SecurityBanner
- [ ] ThemeSwitcher, LanguageSwitcher

**Test Cases**: 15-18 tests

**Deliverable**: 72-90 frontend tests, 75%+ coverage

---

### Week 8: E2E Test Suite

**Goal**: Implement end-to-end user journey tests

#### Tasks:

**Day 1: E2E Framework Setup**

- [ ] Install Playwright
  ```bash
  npm install -D @playwright/test
  npx playwright install
  ```

- [ ] Create E2E test structure
  ```
  tests/e2e/
    ├── fixtures/
    │   ├── test-specs.ts
    │   └── test-users.ts
    ├── helpers/
    │   ├── auth.ts
    │   └── api.ts
    └── specs/
        ├── onboarding.spec.ts
        ├── connector-creation.spec.ts
        └── deployment.spec.ts
  ```

- [ ] Configure Playwright
  ```typescript
  // playwright.config.ts
  export default defineConfig({
    testDir: './tests/e2e',
    use: {
      baseURL: 'http://localhost:3000',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
    },
    projects: [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] }},
      { name: 'firefox', use: { ...devices['Desktop Firefox'] }},
      { name: 'webkit', use: { ...devices['Desktop Safari'] }},
    ]
  })
  ```

**Day 2: User Onboarding E2E Tests**

**Test File**: `tests/e2e/specs/onboarding.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('User Onboarding', () => {
  test('should complete full signup flow', async ({ page }) => {
    // Visit homepage
    await page.goto('/')
    await expect(page).toHaveTitle(/MCPOverflow/)

    // Click Sign Up
    await page.click('text=Sign Up')

    // Fill form
    await page.fill('input[name="email"]', 'newuser@example.com')
    await page.fill('input[name="password"]', 'Test123!@#')
    await page.fill('input[name="confirmPassword"]', 'Test123!@#')
    await page.click('button[type="submit"]')

    // Verify email sent message
    await expect(page.locator('text=Check your email')).toBeVisible()

    // Mock email verification (in test environment)
    await page.evaluate(() => {
      window.localStorage.setItem('email_verified', 'true')
    })

    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', 'newuser@example.com')
    await page.fill('input[name="password"]', 'Test123!@#')
    await page.click('button[type="submit"]')

    // Should see dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('should show validation errors for weak password', async ({ page }) => {
    await page.goto('/register')
    await page.fill('input[name="password"]', 'weak')
    await page.blur('input[name="password"]')

    await expect(page.locator('text=at least 8 characters')).toBeVisible()
  })
})
```

**Test Cases**: 5-7 tests

**Day 3: Connector Creation E2E Tests**

**Test File**: `tests/e2e/specs/connector-creation.spec.ts`

```typescript
test.describe('Connector Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Login helper
    await loginAsTestUser(page)
  })

  test('should create connector from OpenAPI spec', async ({ page }) => {
    await page.goto('/generate')

    // Upload spec file
    const specPath = path.join(__dirname, '../fixtures/petstore.yaml')
    await page.setInputFiles('input[type="file"]', specPath)

    // Fill metadata
    await page.fill('input[name="name"]', 'Petstore API')
    await page.fill('textarea[name="description"]', 'Test connector')

    // Submit
    await page.click('button:has-text("Generate")')

    // Wait for job completion
    await page.waitForSelector('text=Generation complete', {
      timeout: 30000
    })

    // Should redirect to connector detail
    await expect(page).toHaveURL(/\/connector\//)

    // Verify connector created
    const connectorName = page.locator('h1')
    await expect(connectorName).toHaveText('Petstore API')
  })

  test('should show real-time job progress', async ({ page }) => {
    await page.goto('/generate')

    // Upload and submit
    await uploadSpecAndSubmit(page)

    // Monitor progress
    await expect(page.locator('text=Parsing spec')).toBeVisible()
    await expect(page.locator('text=Generating code')).toBeVisible()
    await expect(page.locator('text=Complete')).toBeVisible({
      timeout: 30000
    })
  })

  test('should handle invalid spec gracefully', async ({ page }) => {
    await page.goto('/generate')

    const invalidSpec = path.join(__dirname, '../fixtures/invalid.yaml')
    await page.setInputFiles('input[type="file"]', invalidSpec)

    await page.click('button:has-text("Generate")')

    // Should show validation errors
    await expect(page.locator('.error-message')).toBeVisible()
    await expect(page.locator('text=Invalid OpenAPI spec')).toBeVisible()
  })
})
```

**Test Cases**: 8-10 tests

**Day 4: Deployment E2E Tests**

```typescript
test.describe('Connector Deployment', () => {
  test('should deploy connector to Cloudflare', async ({ page }) => {
    // Create connector first
    const connectorId = await createTestConnector()

    await page.goto(`/connector/${connectorId}`)

    // Click deploy button
    await page.click('button:has-text("Deploy")')

    // Confirm deployment
    await page.click('button:has-text("Confirm")')

    // Wait for deployment
    await expect(page.locator('text=Deploying')).toBeVisible()
    await expect(page.locator('text=Deployed successfully')).toBeVisible({
      timeout: 60000
    })

    // Verify worker URL displayed
    const workerURL = page.locator('[data-testid="worker-url"]')
    await expect(workerURL).toBeVisible()
  })

  test('should show deployment logs in real-time', async ({ page }) => {
    // Test log streaming
  })
})
```

**Test Cases**: 5-7 tests

**Day 5: Additional E2E Tests**
- [ ] Settings page (update profile, change password)
- [ ] API key management
- [ ] Connector filtering and search
- [ ] Dark mode toggle
- [ ] Multi-language support

**Test Cases**: 10-12 tests

**Deliverable**: 28-36 E2E tests covering critical user journeys

---

### Week 9: Performance Testing

**Goal**: Establish performance benchmarks

#### Tasks:

**Day 1-2: API Load Testing**

**Tool**: k6

**Test File**: `tests/performance/api-load.js`

```javascript
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],   // Error rate < 1%
  },
}

export default function () {
  // Test connector list
  const listRes = http.get('http://localhost:8080/api/connectors')
  check(listRes, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  })

  sleep(1)

  // Test connector detail
  const detailRes = http.get('http://localhost:8080/api/connectors/test-id')
  check(detailRes, {
    'status is 200': (r) => r.status === 200,
    'response time < 100ms': (r) => r.timings.duration < 100,
  })

  sleep(1)
}
```

- [ ] Test connector CRUD endpoints
- [ ] Test job creation under load
- [ ] Test concurrent deployments
- [ ] Test database query performance

**Day 3: Code Generation Performance**

**Test File**: `tests/performance/generation-benchmark.go`

```go
func BenchmarkCodeGeneration(b *testing.B) {
    spec := loadLargeOpenAPISpec() // 100+ endpoints

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, err := generator.GenerateWorker(spec)
        if err != nil {
            b.Fatal(err)
        }
    }
}

func BenchmarkConcurrentGeneration(b *testing.B) {
    // Test with multiple concurrent generations
}
```

- [ ] Benchmark small specs (<10 endpoints)
- [ ] Benchmark medium specs (10-50 endpoints)
- [ ] Benchmark large specs (50-200 endpoints)
- [ ] Test concurrent generation (10 simultaneous)

**Day 4: Frontend Performance**

**Tool**: Lighthouse CI

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/dashboard
            http://localhost:3000/generate
          budgetPath: './lighthouse-budget.json'
          uploadArtifacts: true
```

**Budget File**: `lighthouse-budget.json`

```json
{
  "budgets": [{
    "path": "/*",
    "timings": [{
      "metric": "interactive",
      "budget": 3000
    }, {
      "metric": "first-contentful-paint",
      "budget": 1000
    }],
    "resourceSizes": [{
      "resourceType": "script",
      "budget": 500
    }, {
      "resourceType": "total",
      "budget": 1000
    }]
  }]
}
```

- [ ] Set up Lighthouse CI
- [ ] Monitor bundle size (bundlesize package)
- [ ] Test page load times
- [ ] Test Time to Interactive (TTI)

**Day 5: Database Performance**

```go
func BenchmarkDatabaseQueries(b *testing.B) {
    db := setupBenchmarkDB(b)

    b.Run("ListConnectors with pagination", func(b *testing.B) {
        for i := 0; i < b.N; i++ {
            db.ListConnectors(userID, 20, 0)
        }
    })

    b.Run("Full-text search", func(b *testing.B) {
        for i := 0; i < b.N; i++ {
            db.SearchConnectors(userID, "test query")
        }
    })

    b.Run("Complex analytics query", func(b *testing.B) {
        for i := 0; i < b.N; i++ {
            db.GetUsageMetrics(connectorID, startDate, endDate)
        }
    })
}
```

- [ ] Benchmark critical queries
- [ ] Test with 10K, 100K, 1M rows
- [ ] Identify slow queries
- [ ] Optimize indexes

**Deliverable**: Performance benchmarks and optimization recommendations

---

## Phase 4: Production Infrastructure (Weeks 10-12)

### Week 10: Monitoring & Production Setup

#### Tasks:

**Day 1-2: Redis Rate Limiting**

- [ ] Update Go API to use Redis for rate limiting
  ```go
  rateLimiter := redis_limiter.New(
      redisClient,
      ratelimit.Options{
          Window: 60 * time.Second,
          Limit:  100,
      },
  )
  ```

- [ ] Update frontend to remove in-memory rate limiting
- [ ] Test distributed rate limiting with multiple instances
- [ ] Add rate limit headers to API responses

**Day 3: Error Tracking**

- [ ] Set up Sentry for error tracking
  ```typescript
  // Frontend
  Sentry.init({
    dsn: process.env.VITE_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [new Sentry.BrowserTracing()],
    tracesSampleRate: 1.0,
  })
  ```

  ```go
  // Backend
  sentry.Init(sentry.ClientOptions{
      Dsn: os.Getenv("SENTRY_DSN"),
      Environment: os.Getenv("ENV"),
  })
  ```

- [ ] Add error boundaries in React
- [ ] Test error reporting
- [ ] Configure alert rules in Sentry

**Day 4: Monitoring Dashboards**

- [ ] Create Grafana dashboards
  - API metrics (request rate, latency, errors)
  - Business metrics (connectors created, deployments)
  - Infrastructure metrics (CPU, memory, disk)
  - Database metrics (connections, query time)

- [ ] Configure Prometheus alert rules
  ```yaml
  groups:
    - name: api_alerts
      rules:
        - alert: HighErrorRate
          expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
          for: 5m
          annotations:
            summary: "High error rate detected"
  ```

**Day 5: Secrets Management**

- [ ] Choose secrets solution (Vault, AWS Secrets Manager)
- [ ] Migrate secrets from .env files
- [ ] Update deployment scripts to fetch secrets
- [ ] Document secrets rotation procedure

**Deliverable**: Production monitoring and infrastructure ready

---

### Week 11: Security & Documentation

#### Tasks:

**Day 1-2: Security Audit**

- [ ] Run automated security scans
  - npm audit
  - Snyk vulnerability scan
  - OWASP dependency check
  - CodeQL analysis

- [ ] Test RLS policies manually
  - Attempt cross-user access
  - Test all RLS rules
  - Verify data isolation

- [ ] Security testing checklist
  - SQL injection attempts
  - XSS attempts
  - CSRF attacks
  - Authentication bypass attempts
  - Rate limit bypass attempts

**Day 3: API Documentation**

- [ ] Generate OpenAPI spec with swaggo
  ```go
  // @title MCPOverflow API
  // @version 1.0
  // @description API for MCP connector generation
  // @host api.mcpoverflow.io
  // @BasePath /api/v1
  ```

- [ ] Set up Swagger UI
- [ ] Add authentication guide
- [ ] Document rate limits
- [ ] Add code examples

**Day 4-5: Operational Documentation**

- [ ] Write deployment runbook
  - Pre-deployment checklist
  - Deployment steps
  - Post-deployment verification
  - Rollback procedure

- [ ] Create troubleshooting guide
  - Common issues and solutions
  - Log analysis guide
  - Performance debugging
  - Database troubleshooting

- [ ] Write incident response playbook
  - Severity classification
  - Escalation procedures
  - Communication templates

**Deliverable**: Security audit complete, comprehensive documentation

---

### Week 12: Final Validation & Launch Prep

#### Tasks:

**Day 1: Staging Environment Testing**

- [ ] Deploy to staging
- [ ] Run full E2E test suite
- [ ] Load testing on staging
- [ ] Performance validation
- [ ] Security scan on staging

**Day 2: Production Checklist**

- [ ] ✅ Test coverage >85%
- [ ] ✅ All integration tests passing
- [ ] ✅ E2E tests passing
- [ ] ✅ Performance benchmarks met
- [ ] ✅ Security audit complete
- [ ] ✅ Monitoring dashboards created
- [ ] ✅ Alerts configured
- [ ] ✅ Documentation complete
- [ ] ✅ Secrets management implemented
- [ ] ✅ Backup/restore tested
- [ ] ✅ Disaster recovery plan documented

**Day 3: Production Deployment Dry Run**

- [ ] Test deployment procedure on staging
- [ ] Verify rollback works
- [ ] Test database migration
- [ ] Verify monitoring works
- [ ] Test alerting

**Day 4: Final Code Review**

- [ ] Review all new test code
- [ ] Ensure test quality
- [ ] Check for test coverage gaps
- [ ] Review documentation

**Day 5: Launch Preparation**

- [ ] Create production deployment plan
- [ ] Schedule deployment window
- [ ] Prepare rollback plan
- [ ] Set up on-call rotation
- [ ] Final stakeholder review

**Deliverable**: Production-ready platform, launch plan finalized

---

## Success Metrics

### Coverage Targets:
- [ ] Overall test coverage: 85%+
- [ ] Critical paths coverage: 100%
- [ ] Frontend coverage: 80%+
- [ ] Backend coverage: 85%+
- [ ] Package coverage: 90%+

### Test Counts:
- [ ] Unit tests: 300+ tests
- [ ] Integration tests: 60+ tests
- [ ] E2E tests: 30+ tests
- [ ] Performance benchmarks: 15+ benchmarks

### Quality Gates:
- [ ] All tests pass in CI/CD
- [ ] No critical security vulnerabilities
- [ ] API latency p95 < 500ms
- [ ] Frontend TTI < 3 seconds
- [ ] Zero-downtime deployments

---

## Team Allocation (2 Engineers)

### Engineer 1 (Backend Focus):
- Weeks 1-4: Core generator testing, API handler tests
- Weeks 5-6: Integration tests, database tests
- Weeks 10-12: Infrastructure, monitoring, deployment

### Engineer 2 (Frontend Focus):
- Weeks 1-3: Test infrastructure, package tests
- Weeks 7-9: Frontend tests, E2E tests, performance tests
- Weeks 11: Documentation, security testing

### Shared Responsibilities:
- Week 1: Test infrastructure setup
- Weeks 5-6: Integration testing
- Week 12: Final validation

---

## Risk Mitigation

### Potential Blockers:

1. **External API Testing**
   - Risk: Cloudflare API rate limits
   - Mitigation: Use test account, mock APIs for most tests

2. **Database Test Data**
   - Risk: Test data conflicts
   - Mitigation: Use testcontainers, isolated test databases

3. **E2E Test Flakiness**
   - Risk: Flaky tests blocking CI
   - Mitigation: Proper waits, retry logic, isolated test data

4. **Performance Testing Environment**
   - Risk: Different results locally vs production
   - Mitigation: Test on staging environment matching production

---

## Conclusion

This 12-week plan provides a structured approach to achieving production-ready test coverage for MCPOverflow. By following this plan, you will:

1. ✅ Achieve 85%+ test coverage
2. ✅ Implement comprehensive integration tests
3. ✅ Create robust E2E test suite
4. ✅ Establish performance benchmarks
5. ✅ Set up production monitoring
6. ✅ Complete security audit
7. ✅ Document all operational procedures

**Timeline**: 12 weeks with 2 engineers, or 17 weeks with 1 engineer

**Next Steps**: Begin with Week 1 test infrastructure setup immediately.
