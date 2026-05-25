# DOMAIN_MODEL.md — Entity Reference

## Entity Types

**EntityType enum**: What kind of entity is being screened?

```go
type EntityType string
const (
    Individual  EntityType = "Individual"    // Person
    Company     EntityType = "Company"       // Legal entity
    Vessel      EntityType = "Vessel"        // Ship
    Aircraft    EntityType = "Aircraft"      // Plane
)
```

## Screening Flow

```
ScreenRequest (what to screen)
    ↓
Entity (structured: name, identifiers, type)
    ↓
Engine.Screen() (6-layer matching)
    ↓
MatchResult[] (candidates with evidence)
    ↓
Confidence + Disposition (decision)
    ↓
Alert (if confidence high → human review)
    ↓
AlertStatus (Pending, Resolved, FalsePositive)
```

## Value Objects (Core Types)

### Identity & Lookup

| Type | Example | Validation |
|------|---------|-----------|
| EntityID | `ent_a1b2c3d4` | UUID prefix "ent_" |
| TenantID | `ten_x9y8z7` | UUID prefix "ten_" |
| ScreeningID | `scr_abc123` | UUID prefix "scr_" |
| AlertID | `alr_xyz789` | UUID prefix "alr_" |
| AuditID | `aud_123abc` | UUID prefix "aud_" |
| SubscriptionID | `sub_free1` | UUID prefix "sub_" |
| APICredentialID | `apicred_x1` | UUID prefix "apicred_" |

### Names & Identifiers

| Type | Fields | Example |
|------|--------|---------|
| Name | GivenName, FamilyName, MiddleNames, Aliases | {Given: "John", Family: "Smith"} |
| Identifier | Type, Value | {Type: "Passport", Value: "AB123456"} |
| Confidence | Score (0-100) | 87 (87% match confidence) |

### Matching & Disposition

| Type | Enum Values | Meaning |
|------|-------------|---------|
| MatchLayer | Exact, Fuzzy, Phonetic, Token, Embedding, Graph | Which layer found match |
| MatchEvidence | Layer, Candidate, Score, Details | Single layer's result |
| Disposition | NeedsReview, Accept, Reject, FalsePositive | What to do with match |

## Entities

### Entity (Sanctioned Person/Company)

```go
type Entity struct {
    ID           EntityID
    ListID       string                 // OFAC, UN, EU, etc
    EntityType   EntityType
    Names        []Name                 // Multiple names/aliases
    Identifiers  []Identifier           // Passport, DOB, Company reg
    Metadata     map[string]interface{} // Sanctions reason, date, country
    CreatedAt    time.Time
}
```

### ScreenRequest (What to Screen)

```go
type ScreenRequest struct {
    QueryEntity   Entity
    TransactionID string      // Unique identifier for this screening
    TenantID      TenantID
    CustomerID    string      // End customer being screened
    CreatedAt     time.Time
}
```

### ScreenResponse (Screening Result)

```go
type ScreenResponse struct {
    ID        ScreeningID
    Request   ScreenRequest
    Matches   []MatchResult
    Summary   Summary  // Total matches, highest confidence, etc
    Timestamp time.Time
}
```

### MatchResult (Single Match)

```go
type MatchResult struct {
    EntityID      EntityID              // Which sanctioned entity matched
    Confidence    Confidence            // Match confidence (0-100)
    Disposition   Disposition           // What to do
    Evidence      []MatchEvidence       // Why (which layers, scores)
    Explanation   string                // Human-readable: "Exact match on family name + DOB"
    ListID        string                // Which sanctions list
}
```

### MatchEvidence (Layer Result)

```go
type MatchEvidence struct {
    Layer       MatchLayer    // Exact, Fuzzy, etc
    Candidate   Name
    Score       float64       // 0-1 (will be 0-100 in Confidence)
    Details     string        // "Jaro-Winkler distance 0.92"
}
```

### Alert (High-Confidence Match)

```go
type Alert struct {
    ID          AlertID
    ScreeningID ScreeningID
    MatchResult MatchResult
    Status      AlertStatus       // Pending, Resolved, FalsePositive
    Priority    AlertPriority     // Low, Medium, High, Critical
    Notes       string            // Compliance officer comments
    ResolvedAt  *time.Time
    CreatedAt   time.Time
}
```

## Billing & Subscriptions

### Subscription (SaaS Plan)

```go
type Subscription struct {
    ID           SubscriptionID
    TenantID     TenantID
    Product      Product           // API, Dashboard, SDK, iFrame, Dataset
    Tier         ProductTier       // Lite, Pro, Enterprise
    Status       SubscriptionStatus // Active, Paused, Cancelled
    ExpiresAt    *time.Time
    CreatedAt    time.Time
}
```

### SubscriptionStatus Enum

```go
const (
    PendingPayment SubscriptionStatus = "PendingPayment"
    Active         SubscriptionStatus = "Active"
    Paused         SubscriptionStatus = "Paused"
    Cancelled      SubscriptionStatus = "Cancelled"
    Expired        SubscriptionStatus = "Expired"
)
```

### Product Enum (5 Products)

```go
const (
    API       Product = "API"       // RESTful screening service
    Dashboard Product = "Dashboard" // Web UI for compliance
    SDK       Product = "SDK"       // Downloadable library
    IFrame    Product = "IFrame"    // Embeddable widget
    Dataset   Product = "Dataset"   // Raw sanctions data
)
```

### ProductTier Enum

```go
const (
    Lite        ProductTier = "Lite"
    Pro         ProductTier = "Pro"
    Enterprise  ProductTier = "Enterprise"
)
```

### Plan (Product + Tier)

```go
type Plan struct {
    ID         string          // "api-lite", "dashboard-pro", etc
    Product    Product
    Tier       ProductTier
    Monthly    float64         // Monthly cost in USD
    Annual     float64         // Annual cost (with discount)
    Features   PlanTierFeatures
}

type PlanTierFeatures struct {
    ScreeningsPerMonth int         // -1 = unlimited
    Seats              int         // For Dashboard only
    APICallsPerSecond  float64     // Rate limit
    EmbeddingLayers    bool        // Layer 5 enabled?
    GraphLayers        bool        // Layer 6 enabled?
    CustomLists        bool        // Upload own list?
    Webhooks           bool        // LemonSqueezy events?
}
```

### UsageMetric Enum

```go
const (
    ScreeningsCount    UsageMetric = "screenings"
    SeatsCount         UsageMetric = "seats"
    APICallsCount      UsageMetric = "api_calls"
    DatasetDownloads   UsageMetric = "dataset_downloads"
)
```

### UsageRecord

```go
type UsageRecord struct {
    ID           string
    TenantID     TenantID
    Metric       UsageMetric
    Quantity     int
    PeriodStart  time.Time
    PeriodEnd    time.Time
    Billed       bool
}
```

### PromoCode

```go
type PromoCode struct {
    Code      string      // "AMLIQ_FREE"
    Discount  float64     // 0.50 = 50% off
    ExpiresAt time.Time
    MaxUses   int
    UsedCount int
}
```

### Invoice

```go
type Invoice struct {
    ID              string
    TenantID        TenantID
    SubscriptionID  SubscriptionID
    UsageRecords    []UsageRecord
    Amount          float64
    Discount        float64
    Tax             float64
    Total           float64
    DueDate         time.Time
    PaidAt          *time.Time
}
```

## Audit & Compliance

### AuditEntry (Immutable Log)

```go
type AuditEntry struct {
    ID            AuditID
    TenantID      TenantID
    ResourceType  string              // "Entity", "Alert", "Subscription"
    ResourceID    string              // The ID being audited
    Action        AuditAction         // Create, Update, Delete, Resolve
    Changes       map[string]interface{} // What changed (delta)
    PreviousHash  string              // Hash chain integrity
    Hash          string              // SHA-256(this entry)
    CreatedAt     time.Time
}
```

### AuditAction Enum

```go
const (
    Create    AuditAction = "Create"
    Update    AuditAction = "Update"
    Delete    AuditAction = "Delete"
    Resolve   AuditAction = "Resolve"
    Export    AuditAction = "Export"
    Download  AuditAction = "Download"
)
```

## Configuration

### TenantConfig (Per-Customer Settings)

```go
type TenantConfig struct {
    ID                TenantID
    ScreeningWeights  MatchLayerWeights  // Layer 1-6 weights (sum=100)
    ConfidenceThreshold float64          // 0-100, default 75
    ListPriorities    []ListSource       // Order to check lists
    EnableEmbedding   bool               // Use Layer 5?
    EnableGraph       bool               // Use Layer 6?
    AllowlistEntities []EntityID         // Won't match these
    CustomLists       []ListSource       // Customer-uploaded lists
}

type MatchLayerWeights struct {
    Exact      int  // Default 30
    Fuzzy      int  // Default 25
    Phonetic   int  // Default 15
    Token      int  // Default 15
    Embedding  int  // Default 10
    Graph      int  // Default 5
}
```

### APICredential (Auth)

```go
type APICredential struct {
    ID        APICredentialID
    TenantID  TenantID
    KeyPrefix string              // "api_sk_", "dash_sk_", etc
    KeyHash   string              // Hashed secret (never store plaintext)
    Product   Product             // Which product this key accesses
    CreatedAt time.Time
    ExpiresAt *time.Time
}
```

## Relationships (ER Diagram)

```
Tenant (multi-tenancy root)
├─ Subscription (5 products)
│  ├─ Plan (pricing)
│  └─ UsageRecord (metering)
├─ APICredential (auth keys)
├─ Screening (requests + results)
│  └─ MatchResult (candidates)
│     ├─ MatchEvidence (layer scores)
│     └─ Alert (if high confidence)
├─ Entity (sanctioned data from lists)
├─ AuditEntry (immutable log)
├─ DomainAllowlist (whitelisted entities)
└─ TenantConfig (screening settings)
```

---

**Convention**: All IDs are prefixed (`ent_`, `ten_`, `alr_`, etc) for readability and type safety.
