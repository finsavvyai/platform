# TESTING.md — Test Strategy & Patterns

## Go Testing

### Table-Driven Test Pattern

Every Go test file must use table-driven tests. This is non-negotiable.

```go
// ✓ REQUIRED PATTERN
func TestJaroWinkler(t *testing.T) {
    tests := []struct {
        name     string
        s1       string
        s2       string
        expected float64
    }{
        {"identical", "SMITH", "SMITH", 1.0},
        {"one diff", "SMITH", "SMTH", 0.93},
        {"empty", "", "", 1.0},
        {"completely different", "ABC", "XYZ", 0.0},
    }

    jw := NewJaroWinkler()
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := jw.Distance(tt.s1, tt.s2)
            if math.Abs(got-tt.expected) > 0.01 {
                t.Errorf("Distance(%q, %q) = %.2f, want %.2f",
                    tt.s1, tt.s2, got, tt.expected)
            }
        })
    }
}
```

### Test File Naming

- Main file: `entity.go`
- Test file: `entity_test.go` (in same package)
- Test function: `TestEntityXxx` (matches exported function)

### No testify/assert

Use stdlib `testing` only:

```go
// ✓ GOOD
if got != expected {
    t.Errorf("got %v, want %v", got, expected)
}

// ✗ BAD (don't use external assert libraries)
assert.Equal(t, expected, got)
```

### Test Coverage

Target >80% coverage per package:

```bash
go test -cover ./internal/domain/
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### Mock Repositories for Unit Tests

Create mock implementations in `_test.go` files:

```go
// In handler_screening_test.go
type MockScreeningRepository struct {
    createFunc func(ctx context.Context, s Screening) error
}

func (m *MockScreeningRepository) Create(ctx context.Context, s Screening) error {
    if m.createFunc != nil {
        return m.createFunc(ctx, s)
    }
    return nil
}

// Usage in test
func TestHandleScreening(t *testing.T) {
    mockRepo := &MockScreeningRepository{
        createFunc: func(ctx context.Context, s Screening) error {
            // Verify called with correct data
            return nil
        },
    }

    handler := &Server{
        screeningRepo: mockRepo,
    }

    // Test handler
    handler.handleScreening(w, r)
}
```

### Integration Test Pattern

For testing end-to-end flows, use in-memory repository:

```go
// Integration test
func TestScreeningFlow(t *testing.T) {
    // Setup
    memoryRepo := storage.NewInMemoryScreeningRepository()
    engine := NewEngine(nil)
    handler := &Server{
        screeningRepo: memoryRepo,
        engine:        engine,
    }

    // Execute
    req := ScreenRequest{
        EntityName: "John Smith",
        EntityType: "Individual",
    }

    // Verify
    screenings, _ := memoryRepo.List(context.Background())
    if len(screenings) != 1 {
        t.Errorf("Expected 1 screening, got %d", len(screenings))
    }
}
```

### Test Helpers

Create helper functions for common test setup:

```go
// helpers_test.go
func newTestEntity(id, name string) domain.Entity {
    return domain.Entity{
        ID: domain.EntityID(id),
        Names: []domain.Name{
            {GivenName: "John", FamilyName: "Smith"},
        },
    }
}

func newTestScreenRequest(name string) domain.ScreenRequest {
    return domain.ScreenRequest{
        EntityName: name,
        EntityType: "Individual",
    }
}

// Usage
func TestSomething(t *testing.T) {
    entity := newTestEntity("ent_1", "John Smith")
    // ...
}
```

### Benchmark Tests

For performance-sensitive code:

```go
func BenchmarkJaroWinkler(b *testing.B) {
    jw := NewJaroWinkler()
    for i := 0; i < b.N; i++ {
        jw.Distance("SMITH", "SMYTH")
    }
}

// Run: go test -bench=. ./internal/screening/
// Target: >10k ops/sec for matcher layers
```

### Run All Tests

```bash
# All packages
go test ./...

# Specific package
go test -v ./internal/screening/

# Single test
go test -run TestJaroWinkler -v ./internal/screening/

# With coverage
go test -cover ./...

# With race detector
go test -race ./...

# Verbose output
go test -v ./...
```

---

## React Testing

### Component Test Pattern

Use React Testing Library (RTL) + Vitest:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScreeningPage } from './ScreeningPage';

describe('ScreeningPage', () => {
  test('renders screening form', () => {
    render(<ScreeningPage tenantId="ten_123" />);
    expect(screen.getByLabelText('Entity Name')).toBeInTheDocument();
  });

  test('displays matches after screening', async () => {
    render(<ScreeningPage tenantId="ten_123" />);

    const input = screen.getByLabelText('Entity Name');
    fireEvent.change(input, { target: { value: 'John Smith' } });

    const button = screen.getByRole('button', { name: /screen/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/1 match/i)).toBeInTheDocument();
    });
  });

  test('handles API errors gracefully', async () => {
    // Mock API error
    vi.mock('../api/screening', () => ({
      screen: vi.fn().mockRejectedValue(new Error('Network error')),
    }));

    render(<ScreeningPage tenantId="ten_123" />);

    fireEvent.click(screen.getByRole('button', { name: /screen/i }));

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

### Test Behavior, Not Implementation

```tsx
// ✓ GOOD: Test what user sees/does
test('user can filter alerts by status', async () => {
  render(<AlertsPage tenantId="ten_123" />);

  const statusSelect = screen.getByLabelText('Status');
  fireEvent.change(statusSelect, { target: { value: 'Resolved' } });

  expect(await screen.findByText(/resolved alerts/i)).toBeInTheDocument();
});

// ✗ BAD: Test implementation detail
test('setFilter called with correct value', () => {
  const setFilter = vi.fn();
  // ...
});
```

### Mock Data Hooks

Create reusable mock data for tests:

```tsx
// test/mock-data.ts
export const mockScreeningResult = {
  id: 'scr_123',
  matches: [
    {
      entityId: 'ent_1',
      confidence: 87,
      disposition: 'NeedsReview',
    },
  ],
};

export const mockAlert = {
  id: 'alr_123',
  screeningId: 'scr_123',
  status: 'Pending',
  priority: 'High',
};

// Usage in test
test('renders alert', () => {
  render(<AlertCard alert={mockAlert} />);
  expect(screen.getByText('High')).toBeInTheDocument();
});
```

### Mock API Calls

```tsx
import { vi } from 'vitest';

test('fetches alerts on mount', async () => {
  const fetchAlerts = vi.fn().mockResolvedValue([mockAlert]);

  vi.mock('../api/alerts', () => ({
    getAlerts: fetchAlerts,
  }));

  render(<AlertsPage tenantId="ten_123" />);

  await waitFor(() => {
    expect(fetchAlerts).toHaveBeenCalledWith('ten_123');
  });
});
```

### Component Snapshot Tests (Use Sparingly)

```tsx
test('renders without crashing', () => {
  const { container } = render(<ScreeningPage tenantId="ten_123" />);
  expect(container).toMatchSnapshot();
});
```

Snapshots are brittle. Use them only for layout components that rarely change.

### Responsive Design Tests

Test at multiple viewports:

```tsx
describe('ScreeningPage responsive', () => {
  const viewports = [
    { width: 375, name: 'mobile' },      // iPhone SE
    { width: 768, name: 'tablet' },       // iPad
    { width: 1024, name: 'desktop' },     // MacBook
  ];

  viewports.forEach(({ width, name }) => {
    test(`renders correctly on ${name}`, () => {
      // Resize window
      window.innerWidth = width;

      render(<ScreeningPage tenantId="ten_123" />);

      // Verify layout
      const container = screen.getByRole('main');
      expect(container).toBeInTheDocument();
    });
  });
});
```

### Run React Tests

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Specific file
npm test -- ScreeningPage

# With UI
npm run test:ui

# Coverage
npm test -- --coverage
```

---

## Integration Tests

### API Handler Integration Test

```go
// api/handler_screening_integration_test.go
func TestScreeningEndToEnd(t *testing.T) {
    // Setup
    repo := storage.NewInMemoryScreeningRepository()
    engine := screening.NewEngine(nil)
    server := NewServer(repo, engine)

    // Create test request
    body := []byte(`{
        "entity_name": "John Smith",
        "entity_type": "Individual"
    }`)

    req := httptest.NewRequest("POST", "/screen", bytes.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-API-Key", "api_sk_test123")

    // Record response
    w := httptest.NewRecorder()
    server.handleScreening(w, req)

    // Verify
    if w.Code != http.StatusOK {
        t.Errorf("expected 200, got %d", w.Code)
    }

    var resp ScreenResponse
    json.NewDecoder(w.Body).Decode(&resp)

    if resp.ID == "" {
        t.Error("response missing screening ID")
    }
}
```

### Database Integration Test

Test against real PostgreSQL (in CI, use test database):

```go
// internal/storage/postgres_test.go
func TestPostgresScreeningRepository(t *testing.T) {
    // Setup test database
    db, cleanup := setupTestDB(t)
    defer cleanup()

    repo := NewPostgresScreeningRepository(db)

    // Test
    screening := Screening{ID: "scr_123", ...}
    err := repo.Create(context.Background(), screening)

    if err != nil {
        t.Fatalf("Create failed: %v", err)
    }

    // Verify
    fetched, _ := repo.GetByID(context.Background(), "scr_123")
    if fetched.ID != "scr_123" {
        t.Errorf("ID mismatch: got %q", fetched.ID)
    }
}

func setupTestDB(t *testing.T) (*sql.DB, func()) {
    // Create test database
    db, _ := sql.Open("postgres", "postgres://...test...")
    // Run migrations
    // Return db and cleanup function
}
```

---

## Test Coverage Goals

| Package | Target Coverage |
|---------|-----------------|
| `internal/domain/` | 90%+ (critical types) |
| `internal/screening/` | 85%+ (core logic) |
| `internal/storage/` | 80%+ (interfaces) |
| `api/` | 75%+ (handlers) |
| `internal/billing/` | 80%+ (payments) |
| `web/` | 70%+ (React components) |

Check coverage:

```bash
go test -cover ./... | sort
npm test -- --coverage
```

---

## CI/CD Testing

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-go@v4
        with:
          go-version: 1.22

      - run: go test -race -cover ./...

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: cd web && npm test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Common Test Mistakes

| Mistake | Problem | Solution |
|---------|---------|----------|
| Testing implementation | Tests break when refactoring | Test behavior (inputs → outputs) |
| Non-deterministic tests | Fail randomly (threading issues) | Use `t.Parallel()` carefully, avoid global state |
| Slow tests | CI takes forever | Mock external calls, use in-memory repos |
| Flaky tests | Fail intermittently | Avoid sleep(), use proper async waiting |
| No mocks | Tests depend on real database | Use mock repositories in unit tests |
| Too many assertions | Hard to tell which failed | One assertion per test (or group related) |

---

**Goal**: Fast, deterministic, maintainable tests that prevent regressions.
