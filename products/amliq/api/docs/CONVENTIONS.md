# CONVENTIONS.md — Coding Standards

## Universal Rules

### File Size Constraint

**EVERY file ≤100 lines** (including blank lines and comments). No exceptions.

If you're approaching 100 lines:
- Split into multiple files
- Move helper functions to a separate file
- Extract tests into separate _test.go file

### Naming Conventions

| Language | Scope | Convention | Example |
|----------|-------|-----------|---------|
| Go | Package | lowercase, 1-2 words | `screening`, `domain`, `config` |
| Go | Types/Interfaces | PascalCase | `ExactMatcher`, `ScreenRequest`, `Entity` |
| Go | Functions/Methods | camelCase | `Match()`, `Score()`, `NewExactMatcher()` |
| Go | Constants | UPPER_SNAKE_CASE | `MAX_SCREENINGS`, `DEFAULT_THRESHOLD` |
| React | Components | PascalCase | `ScreeningPage`, `AlertList`, `Button` |
| React | Hooks | camelCase (use prefix) | `useScreening()`, `useAlerts()`, `useBilling()` |
| React | Files | kebab-case | `screening-page.tsx`, `alert-list.tsx` |
| Routes | Paths | kebab-case | `/screening`, `/alerts`, `/billing` |
| Database | Tables | snake_case | `screenings`, `alert_status`, `usage_records` |

### IDs with Prefixes

Always prefix IDs for type safety and readability:

```
ent_         Entity ID
ten_         Tenant ID
scr_         Screening ID
alr_         Alert ID
sub_         Subscription ID
apicred_     API Credential ID
aud_         Audit ID
chk_         Checkout ID
batch_       Batch Job ID
```

**Why**: Easier to debug logs, prevents type confusion, helps with prefix-based API key identification.

## Go Conventions

### Constructors & Validation

Every value object validates on construction:

```go
// ✓ GOOD
func NewConfidence(value float64) (Confidence, error) {
    if value < 0 || value > 100 {
        return Confidence{}, errors.New(errors.ErrInvalidInput, "confidence must be 0-100")
    }
    return Confidence{Value: value}, nil
}

// ✗ BAD
func NewConfidence(value float64) Confidence {
    return Confidence{Value: value}  // No validation!
}
```

### Package Organization

```
internal/
├── domain/                  # Value objects, entities, enums
│   ├── entity.go           # Individual file per type
│   ├── entity_test.go
│   ├── confidence.go
│   ├── confidence_test.go
│   └── ...
├── screening/              # Matchers, scorer, explainer
│   ├── engine.go
│   ├── engine_test.go
│   ├── exact.go
│   ├── exact_test.go
│   └── ...
├── storage/                # Repository interfaces only
│   ├── entity_repository.go
│   ├── alert_repository.go
│   └── ...
├── config/                 # Configuration loading
└── ...
```

**Rule**: One file per exported type. Test file immediately follows main file.

### Error Handling

Use stdlib `errors` package + custom error codes:

```go
// ✓ GOOD
if err != nil {
    return errors.New(errors.ErrInvalidInput, "entity_name required")
}

// ✗ BAD
if err != nil {
    fmt.Println("Error occurred")  // No structure
}

if err != nil {
    panic(err)  // Never panic in production code!
}
```

### Interface Design

Keep interfaces small (1-3 methods max):

```go
// ✓ GOOD
type Matcher interface {
    Match(query Name, candidates []Name) []MatchEvidence
}

// ✗ BAD
type Matcher interface {
    Match(...)
    GetScore(...)
    GetEvidence(...)
    Explain(...)
    SerializeToJSON(...)
}
```

### No Primitive Obsession

Always wrap primitives in value objects:

```go
// ✓ GOOD
type EntityID string
func NewEntityID(s string) (EntityID, error) { ... }
type Entity struct { ID EntityID ... }

// ✗ BAD
type Entity struct { ID string ... }  // Too generic!
```

### Table-Driven Tests

Every test file must use table-driven pattern:

```go
func TestJaroWinkler(t *testing.T) {
    tests := []struct {
        name     string
        s1       string
        s2       string
        expected float64
    }{
        {"identical", "SMITH", "SMITH", 1.0},
        {"one char diff", "SMITH", "SMTH", 0.93},
        {"empty", "", "", 1.0},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := jw.Distance(tt.s1, tt.s2)
            if math.Abs(got-tt.expected) > 0.01 {
                t.Errorf("got %.2f, want %.2f", got, tt.expected)
            }
        })
    }
}
```

### No testify/assert

Use stdlib `testing` package only. No external assertion libraries.

```go
// ✓ GOOD
if got != expected {
    t.Errorf("got %v, want %v", got, expected)
}

// ✗ BAD
assert.Equal(t, expected, got)
```

### Logging

Use structured logging (not fmt.Println):

```go
// ✓ GOOD
logger.Debug("screening completed", map[string]interface{}{
    "tenant_id": tenantID,
    "matches": len(results),
    "duration_ms": duration.Milliseconds(),
})

// ✗ BAD
fmt.Println("Screening done:", len(results))
```

### Comments

- **Export all public functions/types**: `// EntityID identifies a sanctioned entity`
- **No obvious comments**: Skip comments for code that reads itself
- **Why comments**: Explain business logic, not implementation

```go
// ✓ GOOD
// Match short-circuits when confidence exceeds threshold to reduce latency
if confidence > threshold {
    return results
}

// ✗ BAD
// Increment i
i++
```

### Method Receivers

Use value receivers for immutable types, pointer receivers otherwise:

```go
// ✓ GOOD (Confidence is immutable value object)
func (c Confidence) String() string { return fmt.Sprintf("%d", c.Value) }

// ✓ GOOD (Repository is mutable)
func (r *PostgresRepository) Create(ctx context.Context, entity Entity) error { ... }
```

## React Conventions

### Component Structure

```tsx
// ✓ GOOD: Functional component with hooks
import { useState, useEffect } from 'react';

interface Props {
  tenantId: string;
  onScreeningComplete?: (result: ScreeningResult) => void;
}

export function ScreeningPage({ tenantId, onScreeningComplete }: Props) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Side effect
  }, [tenantId]);

  return <div>...</div>;
}

// ✗ BAD: Class component (outdated pattern)
class ScreeningPage extends React.Component { ... }

// ✗ BAD: No prop types
export function ScreeningPage(props) { ... }
```

### Hooks Pattern

Custom hooks should follow `useFeature` naming:

```tsx
// ✓ GOOD
export function useScreening(tenantId: string) {
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [loading, setLoading] = useState(false);

  const screen = async (entity: Entity) => {
    setLoading(true);
    const res = await api.screen(tenantId, entity);
    setResult(res);
    setLoading(false);
  };

  return { result, loading, screen };
}
```

### Apple HIG Styling

Use Tailwind CSS with Apple HIG color palette:

```tsx
// ✓ GOOD: Apple HIG color hierarchy
<div className="bg-white dark:bg-gray-900">           {/* Primary background */}
  <h1 className="text-3xl font-bold text-gray-900">  {/* Primary text */}
    Screening Results
  </h1>
  <p className="text-gray-600">Secondary text</p>     {/* Secondary text */}
</div>

// ✗ BAD: Random colors
<div style={{backgroundColor: '#FF5733'}}> ... </div>
```

### Responsive Design

Test at three breakpoints:

| Size | Breakpoint | Test Device |
|------|-----------|-------------|
| Mobile | 375px | iPhone SE |
| Tablet | 768px | iPad |
| Desktop | 1024px+ | MacBook |

```tsx
// ✓ GOOD: Mobile-first responsive
<div className="
  grid grid-cols-1 gap-4        // Mobile: 1 column
  md:grid-cols-2                // Tablet: 2 columns
  lg:grid-cols-3                // Desktop: 3 columns
">
  {results.map(r => <ResultCard key={r.id} result={r} />)}
</div>

// ✗ BAD: Desktop-only
<div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)'}}>
```

### State Management

Use React hooks + custom hooks. No Redux/Zustand (unless absolutely necessary).

```tsx
// ✓ GOOD: Local component state
const [alerts, setAlerts] = useState<Alert[]>([]);
const [filter, setFilter] = useState<AlertFilter>('Pending');

// ✓ GOOD: Custom hook for shared state
const { alerts, filter, setFilter } = useAlerts(tenantId);
```

### API Integration

Wrap API calls in custom hooks:

```tsx
// ✓ GOOD
function useAlerts(tenantId: string) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, [tenantId]);

  const loadAlerts = async () => {
    setLoading(true);
    const res = await api.getAlerts(tenantId);
    setAlerts(res);
    setLoading(false);
  };

  return { alerts, loading, refetch: loadAlerts };
}

// Usage in component
export function AlertsPage() {
  const { alerts, loading } = useAlerts(tenantId);
  return <AlertList alerts={alerts} loading={loading} />;
}
```

### Testing Components

Use Vitest + React Testing Library:

```tsx
// ✓ GOOD: Test behavior, not implementation
import { render, screen, fireEvent } from '@testing-library/react';
import { ScreeningPage } from './ScreeningPage';

test('displays matches after screening', async () => {
  render(<ScreeningPage tenantId="ten_123" />);

  // User interaction
  fireEvent.change(screen.getByLabelText('Entity Name'), {
    target: { value: 'John Smith' }
  });
  fireEvent.click(screen.getByRole('button', { name: /screen/i }));

  // Verify result
  expect(await screen.findByText(/1 match/i)).toBeInTheDocument();
});

// ✗ BAD: Test implementation details
test('calls setMatches with correct data', () => {
  const setMatches = vi.fn();
  // ...
});
```

### File Organization

```
web/src/
├── pages/                      # Full-page components
│   ├── ScreeningPage.tsx
│   ├── ScreeningPage.test.tsx
│   └── ...
├── components/                 # Reusable components
│   ├── ui/                     # Basic UI (button, input, etc)
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   └── ...
│   ├── screening/              # Screening-specific
│   │   ├── MatchResultCard.tsx
│   │   └── ...
│   └── ...
├── hooks/                      # Custom hooks
│   ├── useScreening.ts
│   ├── useAlerts.ts
│   └── ...
├── api/                        # API client wrappers
│   ├── screening.ts
│   └── ...
├── types/                      # TypeScript types
│   └── index.ts
└── styles/                     # Global styles
    └── globals.css
```

## Database Conventions

### Table Naming

```sql
-- ✓ GOOD
CREATE TABLE screenings (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    request JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL
);

-- ✗ BAD
CREATE TABLE screening (  -- singular
    screening_id UUID PRIMARY KEY,  -- redundant prefix
);
```

### Migration Naming

```
migrations/
├── 001_initial_schema.sql
├── 002_add_audit.sql
├── 003_add_indexes.sql
└── ...
```

Format: `NNN_description.sql` where NNN = 3-digit sequential number

### Always Include Timestamps

```sql
CREATE TABLE alerts (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP
);
```

## Git Conventions

### Commit Messages

```
<type>: <subject>

<body>

Fixes: #123
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

**Example**:
```
feat: add embedding layer to screening engine

Implements cosine similarity matching using pgvector.
Disabled by default, enabled per-tenant in config.

Fixes: #456
```

### Branch Naming

```
feature/add-embedding-layer
fix/rate-limit-bug
docs/api-reference
refactor/extract-matcher-interface
```

## Development Workflow

1. Create feature branch from `main`
2. Make commits with meaningful messages
3. Keep files <100 lines
4. Write tests (table-driven Go, RTL React)
5. Open PR with description
6. Code review (check conventions, file size, tests)
7. Merge to main
8. Deploy to staging, then production

## Pre-Commit Checklist

- [ ] All files ≤100 lines
- [ ] Table-driven tests for Go
- [ ] RTL tests for React components
- [ ] No `panic()` in production code
- [ ] No commented-out code
- [ ] Commit message follows convention
- [ ] Code follows naming conventions
- [ ] No lint errors (`go vet`, `eslint`)

---

**TL;DR**: Small files, well-named, thoroughly tested, Apple HIG UI, table-driven tests.
