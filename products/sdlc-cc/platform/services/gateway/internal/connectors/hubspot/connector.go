// Package hubspot is the REAL HubSpot CRM connector.
// Implements OAuth (form-encoded /oauth/v1/token), CRM v3 list/fetch,
// and the search POST endpoint using net/http + encoding/json. The
// BaseURL field overrides https://api.hubapi.com for httptest.
//
// Vendor docs:
//   - OAuth:    https://developers.hubspot.com/docs/api/working-with-oauth
//   - CRM v3:   https://developers.hubspot.com/docs/api/crm/contacts
//   - Search:   https://developers.hubspot.com/docs/api/crm/search
//   - Webhooks: https://developers.hubspot.com/docs/api/webhooks
//
// Required env vars at runtime:
//   HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET, HUBSPOT_APP_ID (Watch)
//
// Watch note: HubSpot webhook subscriptions are app-scoped, not
// portal-scoped. The subscription is created once on the developer
// app and fires for every install. Watch performs that POST so the
// install-time wiring is automatic.
package hubspot

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
)

// Name is the canonical registry id.
const Name = "hubspot"

// DefaultBaseURL is the public HubSpot API host.
const DefaultBaseURL = "https://api.hubapi.com"

var oauthScopes = []string{"crm.objects.contacts.read", "crm.objects.companies.read"}

// Connector is the real HubSpot CRM client.
type Connector struct {
	logger       *slog.Logger
	httpClient   *http.Client
	tokens       connectors.Store
	clientID     string
	clientSecret string
	appID        string
	BaseURL      string // overrides https://api.hubapi.com when non-empty.
}

// New builds a connector. nil store -> in-memory MemoryStore.
func New(logger *slog.Logger, store connectors.Store, clientID, clientSecret, appID string) *Connector {
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
		appID:        appID,
	}
}

// Name returns the canonical id.
func (c *Connector) Name() string { return Name }

func (c *Connector) base() string {
	if c.BaseURL != "" {
		return strings.TrimRight(c.BaseURL, "/")
	}
	return DefaultBaseURL
}

// Authenticate POSTs application/x-www-form-urlencoded to /oauth/v1/token.
func (c *Connector) Authenticate(ctx context.Context, tenantID uuid.UUID, code string) error {
	form := strings.NewReader((newAuthForm(c.clientID, c.clientSecret, code)).Encode())
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base()+"/oauth/v1/token", form)
	if err != nil {
		return fmt.Errorf("hubspot: build auth request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("hubspot: oauth request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("hubspot: oauth status %d: %s", resp.StatusCode, string(b))
	}
	var out struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		TokenType    string `json:"token_type"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return fmt.Errorf("hubspot: decode token: %w", err)
	}
	if out.AccessToken == "" {
		return fmt.Errorf("hubspot: empty access_token")
	}
	t := connectors.Token{AccessToken: out.AccessToken, RefreshToken: out.RefreshToken, TokenType: out.TokenType, Scope: strings.Join(oauthScopes, " ")}
	if out.ExpiresIn > 0 {
		t.Expiry = time.Now().Add(time.Duration(out.ExpiresIn) * time.Second)
	}
	return c.tokens.Save(ctx, tenantID, Name, t)
}

func (c *Connector) authedDo(ctx context.Context, tenantID uuid.UUID, method, path string, body io.Reader, out interface{}) error {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return fmt.Errorf("hubspot: load token: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base()+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("hubspot: do request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("hubspot: %s status %d: %s", path, resp.StatusCode, string(b))
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// Metadata returns the registry metadata.
func Metadata() connectors.Metadata {
	return connectors.Metadata{
		Name: Name, DisplayName: "HubSpot", Vendor: "HubSpot", Category: "crm",
		Scopes: []connectors.Scope{"read:contacts", "read:companies"}, DocsURL: "https://developers.hubspot.com/",
	}
}

// Register installs the connector.
func Register(r *connectors.Registry, logger *slog.Logger, store connectors.Store, clientID, clientSecret, appID string) error {
	return r.RegisterWithMeta(New(logger, store, clientID, clientSecret, appID), Metadata())
}
