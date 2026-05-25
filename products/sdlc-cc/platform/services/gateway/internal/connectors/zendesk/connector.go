// Package zendesk is the REAL Zendesk Support connector.
// Implements OAuth token exchange and the Tickets/Search/Webhooks REST
// surface using net/http + encoding/json. The BaseURL field exists so
// httptest can drive every code path without touching the network.
//
// Vendor docs:
//   - OAuth:    https://developer.zendesk.com/documentation/ticketing/working-with-oauth/
//   - Tickets:  https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/
//   - Search:   https://developer.zendesk.com/api-reference/ticketing/ticket-management/search/
//   - Webhooks: https://developer.zendesk.com/api-reference/webhooks/webhooks-api/
//
// Required env vars at runtime:
//   ZENDESK_CLIENT_ID, ZENDESK_CLIENT_SECRET, ZENDESK_SUBDOMAIN
package zendesk

import (
	"bytes"
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
const Name = "zendesk"

var oauthScopes = []string{"read"}

// Connector is the real Zendesk client.
type Connector struct {
	logger       *slog.Logger
	httpClient   *http.Client
	tokens       connectors.Store
	clientID     string
	clientSecret string
	subdomain    string
	// BaseURL overrides https://{subdomain}.zendesk.com when non-empty.
	BaseURL string
}

// New builds a connector. nil logger -> slog.Default(); nil store -> in-memory.
func New(logger *slog.Logger, store connectors.Store, clientID, clientSecret, subdomain string) *Connector {
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
		subdomain:    subdomain,
	}
}

// Name returns the canonical id.
func (c *Connector) Name() string { return Name }

func (c *Connector) base() string {
	if c.BaseURL != "" {
		return strings.TrimRight(c.BaseURL, "/")
	}
	return fmt.Sprintf("https://%s.zendesk.com", c.subdomain)
}

// Authenticate POSTs JSON to /oauth/tokens, persists the resulting token.
func (c *Connector) Authenticate(ctx context.Context, tenantID uuid.UUID, code string) error {
	body, _ := json.Marshal(map[string]string{
		"grant_type":    "authorization_code",
		"code":          code,
		"client_id":     c.clientID,
		"client_secret": c.clientSecret,
		"scope":         strings.Join(oauthScopes, " "),
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base()+"/oauth/tokens", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("zendesk: build auth request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("zendesk: oauth request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("zendesk: oauth status %d: %s", resp.StatusCode, string(b))
	}
	var out struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		Scope       string `json:"scope"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return fmt.Errorf("zendesk: decode token: %w", err)
	}
	if out.AccessToken == "" {
		return fmt.Errorf("zendesk: empty access_token")
	}
	return c.tokens.Save(ctx, tenantID, Name, connectors.Token{
		AccessToken: out.AccessToken, TokenType: out.TokenType, Scope: out.Scope,
	})
}

// authedDo issues an authenticated request and decodes JSON into out.
func (c *Connector) authedDo(ctx context.Context, tenantID uuid.UUID, method, path string, body io.Reader, out interface{}) error {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return fmt.Errorf("zendesk: load token: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base()+path, body)
	if err != nil {
		return fmt.Errorf("zendesk: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("zendesk: do request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("zendesk: %s status %d: %s", path, resp.StatusCode, string(b))
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// Metadata returns the registry metadata for this connector.
func Metadata() connectors.Metadata {
	return connectors.Metadata{
		Name: Name, DisplayName: "Zendesk", Vendor: "Zendesk", Category: "support",
		Scopes: []connectors.Scope{"read:tickets"}, DocsURL: "https://developer.zendesk.com/",
	}
}

// Register installs the connector into the registry.
func Register(r *connectors.Registry, logger *slog.Logger, store connectors.Store, clientID, clientSecret, subdomain string) error {
	return r.RegisterWithMeta(New(logger, store, clientID, clientSecret, subdomain), Metadata())
}
