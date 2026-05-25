// Package servicenow is the REAL ServiceNow connector.
// Implements OAuth (form-encoded /oauth_token.do) plus the Table API
// surface using net/http + encoding/json. BaseURL overrides the
// {instance}.service-now.com host for httptest.
//
// Vendor docs:
//   - OAuth:     https://docs.servicenow.com/bundle/utah-platform-security/page/administer/security/concept/c_OAuthApplications.html
//   - Table API: https://developer.servicenow.com/dev.do#!/reference/api/utah/rest/c_TableAPI
//
// Required env vars at runtime:
//   SERVICENOW_CLIENT_ID, SERVICENOW_CLIENT_SECRET, SERVICENOW_INSTANCE
//
// Watch note: ServiceNow does not expose a self-service webhook
// registration endpoint over REST — Business Rules + REST integrations
// must be configured in Studio by an admin. Watch therefore returns a
// polling-based channel that re-queries the table on a fixed interval
// and emits update events for rows whose sys_updated_on advanced.
package servicenow

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
)

// Name is the canonical registry id.
const Name = "servicenow"

// DefaultTable is the Table-API target when callers don't override.
const DefaultTable = "incident"

// Connector is the real ServiceNow client.
type Connector struct {
	logger       *slog.Logger
	httpClient   *http.Client
	tokens       connectors.Store
	clientID     string
	clientSecret string
	instance     string
	BaseURL      string        // overrides https://{instance}.service-now.com
	PollInterval time.Duration // Watch poll cadence (default 30s)
	Table        string        // table targeted (default incident)
}

// New builds a connector. nil store -> in-memory MemoryStore.
func New(logger *slog.Logger, store connectors.Store, clientID, clientSecret, instance string) *Connector {
	if logger == nil {
		logger = slog.Default()
	}
	if store == nil {
		store = connectors.NewMemoryStore()
	}
	return &Connector{
		logger:       logger.With("connector", Name),
		httpClient:   &http.Client{Timeout: 30 * time.Second},
		tokens:       store,
		clientID:     clientID,
		clientSecret: clientSecret,
		instance:     instance,
		PollInterval: 30 * time.Second,
		Table:        DefaultTable,
	}
}

// Name returns the canonical id.
func (c *Connector) Name() string { return Name }

func (c *Connector) base() string {
	if c.BaseURL != "" {
		return strings.TrimRight(c.BaseURL, "/")
	}
	return fmt.Sprintf("https://%s.service-now.com", c.instance)
}

func (c *Connector) table() string {
	if c.Table != "" {
		return c.Table
	}
	return DefaultTable
}

// Authenticate POSTs application/x-www-form-urlencoded to /oauth_token.do.
func (c *Connector) Authenticate(ctx context.Context, tenantID uuid.UUID, code string) error {
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"client_id":     {c.clientID},
		"client_secret": {c.clientSecret},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base()+"/oauth_token.do", strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("servicenow: build auth request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("servicenow: oauth request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("servicenow: oauth status %d: %s", resp.StatusCode, string(b))
	}
	var out struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		TokenType    string `json:"token_type"`
		ExpiresIn    int    `json:"expires_in"`
		Scope        string `json:"scope"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return fmt.Errorf("servicenow: decode token: %w", err)
	}
	if out.AccessToken == "" {
		return fmt.Errorf("servicenow: empty access_token")
	}
	t := connectors.Token{AccessToken: out.AccessToken, RefreshToken: out.RefreshToken, TokenType: out.TokenType, Scope: out.Scope}
	if out.ExpiresIn > 0 {
		t.Expiry = time.Now().Add(time.Duration(out.ExpiresIn) * time.Second)
	}
	return c.tokens.Save(ctx, tenantID, Name, t)
}

func (c *Connector) authedGet(ctx context.Context, tenantID uuid.UUID, path string, out interface{}) error {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return fmt.Errorf("servicenow: load token: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base()+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	req.Header.Set("Accept", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("servicenow: do request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("servicenow: %s status %d: %s", path, resp.StatusCode, string(b))
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// Metadata returns the registry metadata.
func Metadata() connectors.Metadata {
	return connectors.Metadata{
		Name: Name, DisplayName: "ServiceNow", Vendor: "ServiceNow", Category: "support",
		Scopes: []connectors.Scope{"read:incidents"}, DocsURL: "https://developer.servicenow.com/",
	}
}

// Register installs the connector.
func Register(r *connectors.Registry, logger *slog.Logger, store connectors.Store, clientID, clientSecret, instance string) error {
	return r.RegisterWithMeta(New(logger, store, clientID, clientSecret, instance), Metadata())
}
