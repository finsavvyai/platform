# EXTENDING.md — How to Add Features

## How to Add a New Screening Matcher

### Step 1: Create the Matcher File

Create `internal/screening/my_matcher.go` (must be <100 lines):

```go
package screening

import "github.com/aegis-aml/aegis/internal/domain"

type MyMatcher struct {
    // fields
}

func NewMyMatcher() *MyMatcher {
    return &MyMatcher{}
}

func (m *MyMatcher) Match(
    query domain.Name,
    candidates []domain.Name,
) []domain.MatchEvidence {
    var evidence []domain.MatchEvidence

    for _, cand := range candidates {
        score := m.calculateSimilarity(query, cand)
        if score > 0.8 { // threshold
            evidence = append(evidence, domain.MatchEvidence{
                Layer:   domain.LayerMyMatcher,
                Score:   score,
                Details: "Custom matcher logic",
            })
        }
    }

    return evidence
}

func (m *MyMatcher) calculateSimilarity(q, c domain.Name) float64 {
    // Your logic here
    return 0.85
}
```

### Step 2: Create Tests

Create `internal/screening/my_matcher_test.go`:

```go
package screening

import (
    "testing"
    "github.com/aegis-aml/aegis/internal/domain"
)

func TestMyMatcher(t *testing.T) {
    tests := []struct {
        name     string
        query    domain.Name
        expected float64
    }{
        {
            name:     "exact match",
            query:    domain.Name{GivenName: "John", FamilyName: "Smith"},
            expected: 1.0,
        },
        {
            name:     "partial match",
            query:    domain.Name{GivenName: "Jon", FamilyName: "Smith"},
            expected: 0.8,
        },
    }

    m := NewMyMatcher()
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test logic
        })
    }
}
```

### Step 3: Register in Engine

Edit `internal/screening/engine.go` to use your matcher:

```go
type Engine struct {
    exactMatcher    *ExactMatcher
    fuzzyMatcher    *FuzzyMatcher
    myMatcher       *MyMatcher      // ADD THIS
    scorer          *WeightedScorer
}

func NewEngine(scorer *WeightedScorer) *Engine {
    return &Engine{
        exactMatcher: NewExactMatcher(),
        fuzzyMatcher: NewFuzzyMatcher(0.75),
        myMatcher:    NewMyMatcher(),      // ADD THIS
        scorer:       scorer,
    }
}

func (e *Engine) Screen(...) (...) {
    // ... existing layers ...
    allEvidence = append(allEvidence, e.myMatcher.Match(...))
    // ... rest of logic ...
}
```

### Step 4: Add to Domain Model

Edit `internal/domain/match_layer.go` to add your layer:

```go
const (
    LayerExact     MatchLayer = "Exact"
    LayerFuzzy     MatchLayer = "Fuzzy"
    // ... existing layers ...
    LayerMyMatcher MatchLayer = "MyMatcher"
)
```

### Step 5: Update Scoring Weights

Edit `internal/domain/tenant_config.go` to add weight for new layer:

```go
type MatchLayerWeights struct {
    Exact      int  // Default 30
    Fuzzy      int  // Default 25
    Phonetic   int  // Default 15
    Token      int  // Default 15
    Embedding  int  // Default 10
    Graph      int  // Default 5
    MyMatcher  int  // Default 0 (disabled by default)
}
```

### Test It

```bash
go test -v ./internal/screening/
go test -run TestMyMatcher -v ./internal/screening/
```

---

## How to Add a New Sanctions List Parser

### Step 1: Create the Parser

Create `internal/ingestion/my_list_parser.go`:

```go
package ingestion

import (
    "encoding/json"
    "github.com/aegis-aml/aegis/internal/domain"
)

type MyListParser struct{}

func NewMyListParser() *MyListParser {
    return &MyListParser{}
}

func (p *MyListParser) Parse(data []byte) ([]domain.Entity, error) {
    var items []map[string]interface{}
    if err := json.Unmarshal(data, &items); err != nil {
        return nil, err
    }

    var entities []domain.Entity
    for _, item := range items {
        entity := domain.Entity{
            ID:         domain.EntityID(item["id"].(string)),
            EntityType: domain.Individual,
            Names: []domain.Name{
                {
                    GivenName:  item["given_name"].(string),
                    FamilyName: item["family_name"].(string),
                },
            },
        }
        entities = append(entities, entity)
    }

    return entities, nil
}
```

### Step 2: Create Tests

Create `internal/ingestion/my_list_parser_test.go`:

```go
func TestMyListParser(t *testing.T) {
    tests := []struct {
        name      string
        input     []byte
        wantCount int
    }{
        {
            name:      "valid list",
            input:     []byte(`[{"id":"1","given_name":"John"}]`),
            wantCount: 1,
        },
    }

    parser := NewMyListParser()
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            entities, _ := parser.Parse(tt.input)
            if len(entities) != tt.wantCount {
                t.Errorf("got %d, want %d", len(entities), tt.wantCount)
            }
        })
    }
}
```

### Step 3: Add to Domain Enum

Edit `internal/domain/list_source.go`:

```go
const (
    ListSourceOFAC    ListSource = "OFAC"
    ListSourceUN      ListSource = "UN"
    ListSourceEU      ListSource = "EU"
    ListSourceMyList  ListSource = "MyList"  // ADD THIS
)
```

### Step 4: Register in Parser Registry

Edit `internal/ingestion/registry.go`:

```go
func NewParserRegistry() *ParserRegistry {
    reg := &ParserRegistry{
        parsers: make(map[domain.ListSource]Parser),
    }
    reg.Register(domain.ListSourceOFAC, NewOFACParser())
    reg.Register(domain.ListSourceUN, NewUNParser())
    reg.Register(domain.ListSourceMyList, NewMyListParser())  // ADD THIS
    return reg
}
```

### Test It

```bash
go test -v ./internal/ingestion/
```

---

## How to Add a New API Endpoint

### Step 1: Create Handler

Create `api/handler_myfeature.go`:

```go
package api

import (
    "encoding/json"
    "net/http"
)

type MyFeatureRequest struct {
    Param1 string `json:"param1"`
}

type MyFeatureResponse struct {
    Result string `json:"result"`
}

func (s *Server) handleMyFeature(w http.ResponseWriter, r *http.Request) {
    tenantID := r.Context().Value("tenant_id").(string)

    var req MyFeatureRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        Error(w, "INVALID_INPUT", "Invalid request body", http.StatusBadRequest)
        return
    }

    result := req.Param1 + " processed"

    resp := MyFeatureResponse{Result: result}
    JSON(w, resp, http.StatusOK)
}
```

### Step 2: Create Tests

Create `api/handler_myfeature_test.go`:

```go
package api

import (
    "bytes"
    "encoding/json"
    "testing"
)

func TestHandleMyFeature(t *testing.T) {
    tests := []struct {
        name           string
        input          MyFeatureRequest
        expectedStatus int
    }{
        {
            name:           "valid request",
            input:          MyFeatureRequest{Param1: "test"},
            expectedStatus: 200,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test logic
        })
    }
}
```

### Step 3: Register Route

Edit `api/router.go`:

```go
func (s *Server) setupRoutes(router *http.ServeMux) {
    // ... existing routes ...
    router.HandleFunc("POST /myfeature", s.handleMyFeature)
}
```

### Step 4: Update API Documentation

Edit `docs/API_REFERENCE.md` with new endpoint details.

### Test It

```bash
go test -v ./api/
curl -X POST http://localhost:8080/myfeature -H "X-API-Key: ..." -d '{"param1":"value"}'
```

---

## How to Add a React Page

### Step 1: Create Component

Create `web/src/pages/MyPage.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';

interface MyPageProps {
  tenantId: string;
}

export function MyPage({ tenantId }: MyPageProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const loadData = async () => {
    setLoading(true);
    // Load data from API
    setLoading(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">My Page</h1>
      {loading && <p>Loading...</p>}
      {data && <p>{data}</p>}
      <Button onClick={loadData}>Refresh</Button>
    </div>
  );
}
```

### Step 2: Create Tests

Create `web/src/pages/MyPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MyPage } from './MyPage';

test('renders page title', () => {
  render(<MyPage tenantId="ten_123" />);
  expect(screen.getByText('My Page')).toBeInTheDocument();
});
```

### Step 3: Add Route

Edit `web/src/App.tsx`:

```tsx
import { MyPage } from './pages/MyPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ... existing routes ... */}
        <Route path="/mypage" element={<MyPage tenantId={tenantId} />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### Test It

```bash
cd web
npm test -- MyPage
npm run dev  # View at http://localhost:5173/mypage
```

---

## How to Add a Billing Product

### Step 1: Add to Domain

Edit `internal/domain/product.go`:

```go
const (
    API       Product = "API"
    Dashboard Product = "Dashboard"
    // ... existing products ...
    MyProduct Product = "MyProduct"
)
```

### Step 2: Create Plans

Edit database or migration:

```sql
INSERT INTO plans (id, product, tier, monthly, annual, features)
VALUES (
  'myproduct-lite', 'MyProduct', 'Lite', 500, 5000,
  '{"feature1": true, "feature2": false}'
);
```

### Step 3: Add Usage Metric

Edit `internal/domain/usage_metric.go`:

```go
const (
    ScreeningsCount   UsageMetric = "screenings"
    // ... existing metrics ...
    MyProductCount    UsageMetric = "myproduct_items"
)
```

### Step 4: Create Billing Handler

Edit `api/handler_billing.go` to track product-specific usage.

### Test It

```bash
# Verify in billing endpoints
curl http://localhost:8080/billing/products -H "X-API-Key: ..."
```

---

## How to Add a React Component

### Step 1: Create Component

Create `web/src/components/category/MyComponent.tsx`:

```tsx
interface Props {
  title: string;
  onClick?: () => void;
}

export function MyComponent({ title, onClick }: Props) {
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-semibold">{title}</h2>
      {onClick && <button onClick={onClick}>Click</button>}
    </div>
  );
}
```

### Step 2: Create Tests

Create `web/src/components/category/MyComponent.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

test('renders title', () => {
  render(<MyComponent title="Test" />);
  expect(screen.getByText('Test')).toBeInTheDocument();
});
```

### Step 3: Use in Pages

```tsx
import { MyComponent } from '../components/category/MyComponent';

export function MyPage() {
  return <MyComponent title="Hello" onClick={() => {}} />;
}
```

---

## How to Add a Database Migration

### Step 1: Create Migration File

Create `migrations/NNN_description.sql` (use next sequential number):

```sql
-- migrations/005_add_custom_table.sql

CREATE TABLE custom_entities (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_custom_entities_tenant ON custom_entities(tenant_id);
```

### Step 2: Run Migration

```bash
# Migrations run automatically on startup via migrations/ package
go run ./cmd/api/main.go

# Verify in psql:
psql $DATABASE_URL -c "\dt"
```

### Step 3: Update Repository Interface

If adding new queries, update relevant repository in `internal/storage/`:

```go
type CustomRepository interface {
    Create(ctx context.Context, entity CustomEntity) error
    GetByID(ctx context.Context, id string) (CustomEntity, error)
    List(ctx context.Context, tenantID string) ([]CustomEntity, error)
}
```

---

## Checklist for Any Addition

- [ ] Code in <100 line files
- [ ] Includes _test.go with table-driven tests
- [ ] Follows naming conventions (PascalCase types, camelCase functions)
- [ ] No panic() or fmt.Println (use logger)
- [ ] Value objects validate on construction
- [ ] Interfaces ≤3 methods
- [ ] Tests pass: `go test ./...` and `npm test`
- [ ] API docs updated (if endpoint added)
- [ ] Domain model updated (if new type added)

---

Start with: **"Read the most-modified file in the relevant package"** to understand patterns.
