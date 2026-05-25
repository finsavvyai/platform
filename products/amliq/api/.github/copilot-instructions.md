# GitHub Copilot Instructions — AMLIQ v2

When using GitHub Copilot on this repository, follow these project-specific rules.

## Project Overview

**AMLIQ** = AI-Enhanced Global Intelligence Screening
- AML/CFT sanctions screening platform
- Go 1.22 backend, React 18 frontend
- 6-layer matching engine (Exact, Fuzzy, Phonetic, Token, Embedding, Graph)
- SaaS model with 5 products, LemonSqueezy billing

## Critical Rules

### File Size Limit (100 Lines MAX)

**Every file must be ≤100 lines** (including blank lines, comments).

When suggesting code:
- Split large functions into separate files
- Extract helpers to utility files
- Keep _test.go files separate from main files
- Reject suggestions that would make file >100 lines

### Table-Driven Tests (Go)

All Go tests MUST use table-driven pattern:

```go
// ✓ CORRECT
func TestXxx(t *testing.T) {
    tests := []struct {
        name     string
        input    interface{}
        expected interface{}
    }{
        {"case1", "in1", "exp1"},
        {"case2", "in2", "exp2"},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := FunctionUnderTest(tt.input)
            if got != tt.expected {
                t.Errorf("got %v, want %v", got, tt.expected)
            }
        })
    }
}

// ✗ WRONG - Don't do this
func TestXxx(t *testing.T) {
    got := FunctionUnderTest("input")
    if got != "expected" {
        t.Fail()
    }
}
```

### No panic() in Production Code

**Only use panic in tests.** Production code must return (T, error):

```go
// ✓ CORRECT
func NewEntity(id string) (Entity, error) {
    if id == "" {
        return Entity{}, errors.New(errors.ErrInvalidInput, "id required")
    }
    return Entity{ID: id}, nil
}

// ✗ WRONG
func NewEntity(id string) Entity {
    if id == "" {
        panic("id required")  // Never in production!
    }
    return Entity{ID: id}
}
```

### Validate on Construction

Value objects validate when created, not when used:

```go
// ✓ CORRECT
func NewConfidence(val float64) (Confidence, error) {
    if val < 0 || val > 100 {
        return Confidence{}, ErrInvalidRange
    }
    return Confidence{Value: val}, nil
}

entity, err := NewConfidence(87)  // Validation here
if err != nil { return err }
use(entity)  // Already guaranteed valid

// ✗ WRONG
type Confidence struct { Value float64 }
c := Confidence{Value: 150}  // Invalid, not caught
if IsInvalid(c) { ... }      // Check later
```

### Naming Conventions

| Scope | Convention | Example |
|-------|-----------|---------|
| Go packages | lowercase | `domain`, `screening`, `billing` |
| Go types | PascalCase | `ExactMatcher`, `ScreenRequest` |
| Go functions | camelCase | `Match()`, `NewEntity()` |
| Go constants | UPPER_SNAKE | `MAX_SCREENINGS`, `DEFAULT_THRESHOLD` |
| IDs | Prefixed | `ent_123`, `ten_456`, `alr_789` |
| React components | PascalCase | `ScreeningPage`, `AlertCard` |
| React hooks | use prefix | `useScreening`, `useAlerts` |
| React files | kebab-case | `screening-page.tsx`, `alert-card.tsx` |
| Database tables | snake_case | `screenings`, `audit_entries` |

### Small Interfaces (≤3 Methods)

Interfaces should be small and composable:

```go
// ✓ CORRECT
type Matcher interface {
    Match(query Name, candidates []Name) []MatchEvidence
}

type Scorer interface {
    Score(evidence []MatchEvidence) (float64, error)
}

// ✗ WRONG - Too many responsibilities
type Engine interface {
    Screen(...)
    GetScore(...)
    Explain(...)
    GetEvidence(...)
    SerializeToJSON(...)
}
```

## Go Code Patterns

### Repository Pattern (No DB in Domain)

```go
// ✓ CORRECT: Repository interface in domain/storage
type ScreeningRepository interface {
    Create(ctx context.Context, s Screening) error
    GetByID(ctx context.Context, id string) (Screening, error)
}

// Implement in storage/postgres.go
type PostgresRepository struct { db *sql.DB }
func (r *PostgresRepository) Create(...) error { ... }

// ✗ WRONG: Database logic in domain
type Screening struct {
    func (s *Screening) Save(db *sql.DB) error { ... }
}
```

### Error Handling

```go
// ✓ CORRECT: Use domain errors
return errors.New(errors.ErrInvalidInput, "entity_name required")

// ✓ CORRECT: Wrapping errors
if err := service.Do(); err != nil {
    return fmt.Errorf("operation failed: %w", err)
}

// ✗ WRONG: Generic errors
return fmt.Errorf("error")
return nil  // Silent failures!
```

### Comments

```go
// ✓ CORRECT: Explain why/business logic
// Short-circuit when confidence exceeds threshold to reduce latency
if confidence > threshold {
    return results
}

// ✓ CORRECT: Document exported functions
// Match cascades through 6 layers of algorithms.
// Returns matches with evidence and explanations.
func (e *Engine) Screen(...) (...) { ... }

// ✗ WRONG: Obvious comments
i++  // Increment i
x = 5  // Set x to 5
```

## React Code Patterns

### Functional Components Only

```tsx
// ✓ CORRECT: Functional component with hooks
interface Props {
  tenantId: string;
  onComplete?: (result: Result) => void;
}

export function ScreeningPage({ tenantId, onComplete }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [tenantId]);

  const load = async () => {
    setLoading(true);
    const res = await api.getScreening(tenantId);
    setData(res);
    setLoading(false);
  };

  return <div>...</div>;
}

// ✗ WRONG: Class components
class ScreeningPage extends React.Component { ... }
```

### React Testing Library

```tsx
// ✓ CORRECT: Test behavior, not implementation
test('displays matches after screening', async () => {
  render(<ScreeningPage tenantId="ten_123" />);

  fireEvent.change(screen.getByLabelText('Entity Name'), {
    target: { value: 'John Smith' }
  });
  fireEvent.click(screen.getByRole('button', { name: /screen/i }));

  expect(await screen.findByText(/matches/i)).toBeInTheDocument();
});

// ✗ WRONG: Test implementation details
test('setData called with correct payload', () => {
  const mockSetData = vi.fn();
  // ...
});
```

### Responsive Tailwind

```tsx
// ✓ CORRECT: Mobile-first responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id} item={item} />)}
</div>

// ✗ WRONG: Desktop-only or hardcoded widths
<div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)'}}>
<div className="w-1200px">  {/* Not responsive */}
```

## Database Patterns

### Migrations

```sql
-- ✓ CORRECT: NNN_description.sql
-- migrations/003_add_audit.sql

CREATE TABLE audit_entries (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_audit_tenant ON audit_entries(tenant_id);

-- ✗ WRONG: Modifying existing migration
-- (Don't modify migration files, create new ones)
```

### Always Include Timestamps

```sql
-- ✓ CORRECT
CREATE TABLE screenings (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ✗ WRONG: Missing timestamps
CREATE TABLE screenings (
    id TEXT PRIMARY KEY
);
```

## API Patterns

### Endpoint Naming

```
POST /screen              ← Action on resource
GET /alerts              ← List resource
GET /alerts/{id}         ← Get specific resource
PUT /alerts/{id}/resolve ← Action on resource
GET /config              ← Get settings
PUT /config              ← Update settings
```

### Authentication

```go
// ✓ CORRECT: Check auth on every endpoint
func (s *Server) handleScreening(w http.ResponseWriter, r *http.Request) {
    apiKey := r.Header.Get("X-API-Key")
    if apiKey == "" {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    tenant := r.Context().Value("tenant_id").(string)
    // Rest of handler
}

// ✗ WRONG: Skipping auth
func (s *Server) handleScreening(w http.ResponseWriter, r *http.Request) {
    // No auth check!
}
```

## Secrets & Security

**Never suggest**:
- Plaintext passwords
- API keys in code/logs
- Unencrypted PII
- Skipping rate limits
- Disabling auth checks
- Using `panic()` in production
- `TODO` without issue link

**Always suggest**:
- Environment variables for secrets
- HMAC for webhook verification
- TLS 1.3 minimum
- RBAC checks
- Audit logging
- Input validation

## Domain Model Reference

| Type | File | Validates |
|------|------|-----------|
| EntityID | entity_id.go | Non-empty, UUID format |
| TenantID | tenant_id.go | Non-empty, UUID format |
| Confidence | confidence.go | 0-100 range |
| MatchLayer | match_layer.go | Valid enum |
| Disposition | disposition.go | Valid enum |
| Entity | entity.go | Has names/identifiers |
| ScreenRequest | screen_request.go | Has entity_name |
| ScreenResponse | screen_response.go | Has screening_id |

## Key Files to Reference

| File | When to Reference |
|------|-------------------|
| CLAUDE.md | First-time understanding |
| docs/ARCHITECTURE.md | System design questions |
| docs/CODE_MAP.md | File locations |
| docs/CONVENTIONS.md | Coding standards |
| internal/domain/ | Domain models |
| internal/screening/ | Matching engine |
| api/ | Endpoints |

## Code Review Checklist

When Copilot suggests code, verify:

- [ ] File would be ≤100 lines
- [ ] Tests use table-driven pattern (Go)
- [ ] Value objects validate on construction
- [ ] No panic() in production
- [ ] Interfaces ≤3 methods
- [ ] Follows naming conventions
- [ ] No plaintext secrets
- [ ] Comments explain "why"
- [ ] RBAC checks on endpoints
- [ ] Error handling is explicit

## When to Reject Copilot Suggestions

**Reject suggestions that**:
1. Create files >100 lines
2. Use assert library in Go tests
3. Store passwords or API keys in code
4. Skip error handling
5. Use panic() outside tests
6. Have hardcoded magic numbers
7. Log sensitive data
8. Miss RBAC/auth checks
9. Use single-letter test cases
10. Skip table-driven test pattern

---

**Golden Rule**: "Small, focused, tested, documented code that's easy for other AIs to understand."
