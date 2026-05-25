# SECURITY.md — Security Architecture Reference

## Transport Security

### TLS 1.3 (Mandatory)

All HTTP communication must use TLS 1.3:

```go
// cmd/api/main.go
server := &http.Server{
    Addr:      ":" + port,
    TLSConfig: &tls.Config{
        MinVersion: tls.VersionTLS13,
        MaxVersion: tls.VersionTLS13,
    },
}
```

**Certificate management**:
- Production: Use Let's Encrypt via ACME protocol
- Staging: Self-signed for testing
- Auto-renewal: 90-day certificates with 30-day renewal

### mTLS (Mutual TLS) Support

For B2B integrations, require client certificates:

```go
tlsConfig := &tls.Config{
    MinVersion: tls.VersionTLS13,
    ClientAuth: tls.RequireAndVerifyClientCert,
    ClientCAs:  clientCertPool,
}
```

Partners provide client certificate signed by trusted CA.

---

## Authentication

### JWT (Bearer Tokens)

Used for dashboard UI and programmatic access:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**JWT Claims**:
```json
{
  "sub": "ten_123",           // Tenant ID
  "role": "Admin",             // User role
  "exp": 1711500000,           // Expiry (default 1 hour)
  "iat": 1711496400            // Issued at
}
```

**Token generation**:
```go
token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
    "sub":  tenantID,
    "role": role,
    "exp":  time.Now().Add(time.Hour).Unix(),
})
signed, _ := token.SignedString([]byte(tokenSecret))
```

### API Keys (Product-Based)

For server-to-server API calls:

```
X-API-Key: api_sk_abc123def456...
```

**API Key Structure**:
```
[product]_[type]_[random_32_bytes_base64]

api_sk_abc123...       → API product
dash_sk_xyz789...      → Dashboard product (internal use)
sdk_sk_pqr456...       → SDK product
iframe_sk_lmn789...    → iFrame product
dataset_sk_jkl012...   → Dataset product
```

**Why prefixes?**: Middleware can instantly identify product → check tier limits without DB lookup.

**API Key storage**:
```go
type APICredential struct {
    ID       string
    TenantID string
    KeyHash  string        // SHA-256(full_key) — never store plaintext
    Product  Product       // Which product
    ExpiresAt *time.Time   // Optional expiry
}

// On issue:
fullKey := "api_sk_" + generateRandomBytes(32)
credential.KeyHash = sha256.Sum256([]byte(fullKey))
// Return fullKey to user, store credential (hash only)

// On validation:
providedKey := extractFromHeader()
hash := sha256.Sum256([]byte(providedKey))
if hash == storedCredential.KeyHash {
    // Valid
}
```

### No Plaintext Passwords

Never store passwords. Use OAuth2/SAML for user authentication:

```go
// ✗ BAD: User provides password
func LoginWithPassword(username, password string) { ... }

// ✓ GOOD: OAuth2 redirect
func StartOAuth2Login(provider string) {
    // Redirect to provider (Google, GitHub, Okta)
    // Provider handles password
    // We receive JWT with user identity
}
```

---

## Authorization (RBAC)

### Role-Based Access Control

5 roles for Dashboard product:

| Role | Permissions |
|------|-----------|
| **Admin** | All settings, user management, configuration changes |
| **Compliance Officer** | View all alerts, approve dispositions, change thresholds |
| **Analyst L1** | Review and disposition low-confidence matches (0-75) |
| **Analyst L2** | Review high-confidence matches, escalate to L3 |
| **Analyst L3** | Deep investigation, special access (PEP queries, graph) |
| **Auditor** | Read-only access to audit trail, no modifications |

### Authorization Checks

```go
// ✓ GOOD: Check role on every request
func (s *Server) requireRole(roles ...Role) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        userRole := r.Context().Value("role").(Role)
        allowed := false
        for _, r := range roles {
            if userRole == r {
                allowed = true
                break
            }
        }
        if !allowed {
            http.Error(w, "Forbidden", http.StatusForbidden)
            return
        }
        // Handle request
    })
}

// Usage:
router.HandleFunc("PUT /config", s.requireRole(Admin, ComplianceOfficer)(
    s.handleUpdateConfig,
))
```

### Tenant Isolation

Every request must specify tenant (extracted from API key/JWT):

```go
func (s *Server) extractTenant(r *http.Request) (TenantID, error) {
    // From JWT claim "sub"
    claim := r.Context().Value("tenant_id")

    // Or from API key lookup
    apiKey := r.Header.Get("X-API-Key")
    cred, _ := s.repo.GetCredentialByKey(apiKey)
    return cred.TenantID, nil
}

// ✓ GOOD: Check tenant on all queries
func (s *Server) getAlert(alertID, requestingTenantID string) (Alert, error) {
    alert, _ := s.repo.GetAlert(alertID)

    // Verify this tenant owns this alert
    if alert.TenantID != requestingTenantID {
        return nil, ErrForbidden
    }

    return alert, nil
}
```

---

## Data Encryption

### Encryption at Rest

All data encrypted in PostgreSQL:

```go
// AES-256-GCM for sensitive fields
type Entity struct {
    ID        string
    Names     []EncryptedField  // Encrypted JSON
    Identifiers []EncryptedField  // Encrypted JSON
}

type EncryptedField struct {
    Ciphertext string `db:"ciphertext"`
    Nonce      string `db:"nonce"`
}

// Encryption
func encrypt(plaintext []byte, key []byte) (ciphertext, nonce []byte, err error) {
    block, _ := aes.NewCipher(key)
    gcm, _ := cipher.NewGCM(block)
    nonce = make([]byte, gcm.NonceSize())
    rand.Read(nonce)
    return gcm.Seal(nil, nonce, plaintext, nil), nonce, nil
}

// Decryption
func decrypt(ciphertext, nonce, key []byte) (plaintext []byte, err error) {
    block, _ := aes.NewCipher(key)
    gcm, _ := cipher.NewGCM(block)
    return gcm.Open(nil, nonce, ciphertext, nil)
}
```

**PII Encryption**: Separate encryption key for fields containing Personally Identifiable Information.

### Encryption in Transit

TLS 1.3 handles this (see Transport Security above).

---

## Rate Limiting

### Token Bucket Algorithm

Per API key rate limiting:

```go
type RateLimiter struct {
    buckets map[string]*TokenBucket
}

type TokenBucket struct {
    capacity    int       // Max tokens (e.g., 1000 req/sec)
    fillRate    int       // Tokens added per second
    tokens      int       // Current tokens
    lastRefill  time.Time
}

func (rl *RateLimiter) Allow(apiKey string, cost int) bool {
    bucket := rl.buckets[apiKey]

    // Refill based on elapsed time
    now := time.Now()
    elapsed := now.Sub(bucket.lastRefill).Seconds()
    bucket.tokens += int(elapsed * float64(bucket.fillRate))
    if bucket.tokens > bucket.capacity {
        bucket.tokens = bucket.capacity
    }
    bucket.lastRefill = now

    // Check if request allowed
    if bucket.tokens >= cost {
        bucket.tokens -= cost
        return true
    }
    return false
}
```

**Tier-based limits**:
- API Lite: 100 req/sec
- API Pro: 1000 req/sec
- API Enterprise: 10000 req/sec

---

## Webhook Verification

### HMAC-SHA256 Signature

LemonSqueezy sends webhooks with signature verification:

```go
func verifyWebhookSignature(body []byte, signature string, secret string) bool {
    h := hmac.New(sha256.New, []byte(secret))
    h.Write(body)
    expected := hex.EncodeToString(h.Sum(nil))

    return hmac.Equal(
        []byte(signature),
        []byte(expected),
    )
}

// Middleware
func (s *Server) verifyLemonSqueezySignature(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        signature := r.Header.Get("X-Signature")
        body, _ := io.ReadAll(r.Body)

        if !verifyWebhookSignature(body, signature, s.webhookSecret) {
            http.Error(w, "Invalid signature", http.StatusUnauthorized)
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

---

## Audit Logging

### Immutable Audit Trail

Every action logged in append-only table:

```go
type AuditEntry struct {
    ID           string
    TenantID     string
    ResourceType string              // "Alert", "Subscription", etc
    ResourceID   string              // Which entity changed
    Action       string              // "Create", "Update", "Delete"
    Changes      map[string]interface{} // What changed
    PreviousHash string              // Hash of previous entry
    Hash         string              // SHA-256(this entry)
    CreatedAt    time.Time
    CreatedBy    string              // User who made change
}

// Hash chain integrity
func (ae *AuditEntry) CalculateHash(prevHash string) string {
    data := ae.TenantID + ae.ResourceID + ae.Action + prevHash
    return fmt.Sprintf("%x", sha256.Sum256([]byte(data)))
}

// On append
func (repo *AuditRepository) Append(entry AuditEntry) error {
    lastEntry, _ := repo.GetLast(entry.TenantID)
    entry.PreviousHash = lastEntry.Hash
    entry.Hash = entry.CalculateHash(lastEntry.Hash)
    return repo.db.Insert(entry)
}
```

**Use case**: Prove to regulators that you didn't modify historical data.

---

## Secrets Management

### Environment Variables

Never commit secrets to git:

```bash
# .env (NOT committed)
DATABASE_URL=postgres://...
TOKEN_SECRET=your-secret-key
WEBHOOK_SECRET=lemonsqueezy-secret
STRIPE_API_KEY=sk_test_...

# .env.example (committed, no values)
DATABASE_URL=
TOKEN_SECRET=
WEBHOOK_SECRET=
STRIPE_API_KEY=
```

### Production Secrets

Use platform-provided secret management:

```bash
# On Heroku
heroku config:set TOKEN_SECRET=prod-secret-key

# On AWS
aws secretsmanager create-secret --name aegis/token-secret

# On Kubernetes
kubectl create secret generic aegis-secrets \
  --from-literal=TOKEN_SECRET=prod-secret-key
```

Never log secrets:

```go
// ✗ BAD
log.Printf("API key: %s", apiKey)

// ✓ GOOD
log.Printf("API key: %s", redactSecret(apiKey))

func redactSecret(s string) string {
    if len(s) <= 4 {
        return "***"
    }
    return s[:4] + "..." + s[len(s)-4:]
}
```

---

## Common Security Mistakes

| Mistake | Why It's Bad | Fix |
|---------|------------|-----|
| Storing passwords | Compromised DB = all accounts | Use OAuth2/SAML |
| Plaintext API keys | Logged in files/logs | Use HMAC verification only |
| Weak random | Predictable keys | Use `crypto/rand` |
| No rate limiting | DoS attacks | Token bucket per API key |
| CORS too permissive | CSRF attacks | Whitelist specific origins |
| Logging PII | GDPR violation | Redact before logging |
| No audit trail | Can't prove compliance | Hash-chain audit log |
| Weak TLS | Man-in-the-middle | TLS 1.3 minimum |

---

## Compliance Readiness

### GDPR Design Principles

AMLIQ is designed with GDPR requirements in mind. Formal GDPR assessment is pending.

- **Data retention**: Architecture supports PII deletion after relationship ends
- **Encryption**: PII encrypted at rest + in transit
- **Audit**: Immutable audit trail of all data access
- **Portability**: Endpoint to export customer data as JSON
- **Right to be forgotten**: Architecture supports personal data deletion

### SOC 2 Readiness

AMLIQ architecture aligns with SOC 2 trust service criteria. Formal SOC 2 Type II audit is planned.

- **Access control**: RBAC with audit trail
- **Encryption**: Data at rest + in transit
- **Availability**: 99.9% uptime target
- **Change management**: Version control + code review
- **Incident response**: Documented procedures

---

**Golden Rule**: "Security is everyone's responsibility. Question suspicious requests."
