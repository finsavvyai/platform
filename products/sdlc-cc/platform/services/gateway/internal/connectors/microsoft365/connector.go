// Package microsoft365 — REAL Microsoft Graph connector.
// OAuth via the v2.0 token endpoint; resource enumeration over /sites
// and /me/drive/root/children with @odata.nextLink paging; content
// fetch via /drives/{id}/items/{id}/content; full-text search via
// /search/query; change-notifications via /subscriptions.
//
// Required env: MICROSOFT365_CLIENT_ID / _CLIENT_SECRET / _TENANT_ID.
// Required Graph delegated permissions: Files.Read.All, Sites.Read.All,
// Chat.Read (admin consent), offline_access.
package microsoft365

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
const Name = "microsoft365"

var oauthScopes = []string{"Files.Read.All", "Sites.Read.All", "Chat.Read", "offline_access"}

// Config holds runtime credentials + endpoints (BaseURL/LoginURL are
// exported for httptest swapping).
type Config struct {
	ClientID, ClientSecret, TenantID, RedirectURI string
	BaseURL                                       string // default https://graph.microsoft.com
	LoginURL                                      string // default https://login.microsoftonline.com
}

// Connector implements connectors.Connector against Microsoft Graph.
type Connector struct {
	cfg    Config
	hc     *http.Client
	tokens connectors.Store
	logger *slog.Logger
}

// New constructs the connector. tokens=nil → in-process MemoryStore.
func New(cfg Config, tokens connectors.Store, logger *slog.Logger) *Connector {
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://graph.microsoft.com"
	}
	if cfg.LoginURL == "" {
		cfg.LoginURL = "https://login.microsoftonline.com"
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	cfg.LoginURL = strings.TrimRight(cfg.LoginURL, "/")
	if logger == nil {
		logger = slog.Default()
	}
	if tokens == nil {
		tokens = connectors.NewMemoryStore()
	}
	return &Connector{cfg: cfg, hc: &http.Client{Timeout: 30 * time.Second}, tokens: tokens, logger: logger.With("connector", Name)}
}

// Name returns the canonical id.
func (c *Connector) Name() string { return Name }

// Authenticate exchanges the OAuth code for tokens and persists them.
func (c *Connector) Authenticate(ctx context.Context, tenantID uuid.UUID, code string) error {
	form := url.Values{
		"client_id": {c.cfg.ClientID}, "client_secret": {c.cfg.ClientSecret},
		"code": {code}, "grant_type": {"authorization_code"},
		"redirect_uri": {c.cfg.RedirectURI}, "scope": {strings.Join(oauthScopes, " ")},
	}
	tenant := c.cfg.TenantID
	if tenant == "" {
		tenant = "common"
	}
	var tr struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		TokenType    string `json:"token_type"`
		Scope        string `json:"scope"`
		ExpiresIn    int    `json:"expires_in"`
	}
	if err := c.do(ctx, http.MethodPost, c.cfg.LoginURL+"/"+tenant+"/oauth2/v2.0/token",
		"application/x-www-form-urlencoded", strings.NewReader(form.Encode()), "", &tr); err != nil {
		return err
	}
	return c.tokens.Save(ctx, tenantID, Name, connectors.Token{
		AccessToken: tr.AccessToken, RefreshToken: tr.RefreshToken, TokenType: tr.TokenType,
		Scope: tr.Scope, Expiry: time.Now().Add(time.Duration(tr.ExpiresIn) * time.Second),
	})
}

// do is the unified HTTP helper. bearer="" means "no auth"; otherwise
// it's sent as `Authorization: Bearer <bearer>`. out=nil skips JSON decode.
func (c *Connector) do(ctx context.Context, method, fullURL, contentType string, body io.Reader, bearer string, out any) error {
	req, err := http.NewRequestWithContext(ctx, method, fullURL, body)
	if err != nil {
		return err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	req.Header.Set("Accept", "application/json")
	resp, err := c.hc.Do(req)
	if err != nil {
		return fmt.Errorf("microsoft365 %s: %w", fullURL, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("microsoft365 %s %d: %s", fullURL, resp.StatusCode, string(raw))
	}
	if out != nil {
		return json.Unmarshal(raw, out)
	}
	return nil
}

func (c *Connector) bearer(ctx context.Context, tenantID uuid.UUID) (string, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return "", err
	}
	return tok.AccessToken, nil
}

type graphSite struct {
	ID          string    `json:"id"`
	DisplayName string    `json:"displayName"`
	WebURL      string    `json:"webUrl"`
	LastMod     time.Time `json:"lastModifiedDateTime"`
}

type graphItem struct {
	ID      string    `json:"id"`
	Name    string    `json:"name"`
	WebURL  string    `json:"webUrl"`
	LastMod time.Time `json:"lastModifiedDateTime"`
	File    *struct {
		MimeType string `json:"mimeType"`
	} `json:"file,omitempty"`
}

// ListResources enumerates SharePoint sites + OneDrive root children.
func (c *Connector) ListResources(ctx context.Context, tenantID uuid.UUID) ([]connectors.Resource, error) {
	bearer, err := c.bearer(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	out := []connectors.Resource{}
	for siteURL := c.cfg.BaseURL + "/v1.0/sites?search=*"; siteURL != ""; {
		var page struct {
			Value    []graphSite `json:"value"`
			NextLink string      `json:"@odata.nextLink"`
		}
		if err := c.do(ctx, http.MethodGet, siteURL, "", nil, bearer, &page); err != nil {
			return nil, err
		}
		for _, s := range page.Value {
			out = append(out, connectors.Resource{ID: "site:" + s.ID, Type: "site", Title: s.DisplayName, URL: s.WebURL, UpdatedAt: s.LastMod})
		}
		siteURL = page.NextLink
	}
	for driveURL := c.cfg.BaseURL + "/v1.0/me/drive/root/children"; driveURL != ""; {
		var page struct {
			Value    []graphItem `json:"value"`
			NextLink string      `json:"@odata.nextLink"`
		}
		if err := c.do(ctx, http.MethodGet, driveURL, "", nil, bearer, &page); err != nil {
			return nil, err
		}
		for _, it := range page.Value {
			out = append(out, connectors.Resource{ID: "drive:" + it.ID, Type: "file", Title: it.Name, URL: it.WebURL, UpdatedAt: it.LastMod})
		}
		driveURL = page.NextLink
	}
	return out, nil
}

// Fetch returns full content for a drive item. resourceID = "drive:{driveID}/{itemID}" or "{itemID}".
func (c *Connector) Fetch(ctx context.Context, tenantID uuid.UUID, resourceID string) (*connectors.Document, error) {
	bearer, err := c.bearer(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	id := strings.TrimPrefix(resourceID, "drive:")
	driveSeg, itemID := "me/drive", id
	if i := strings.Index(id, "/"); i > 0 {
		driveSeg, itemID = "drives/"+id[:i], id[i+1:]
	}
	metaURL := fmt.Sprintf("%s/v1.0/%s/items/%s", c.cfg.BaseURL, driveSeg, itemID)
	var item graphItem
	if err := c.do(ctx, http.MethodGet, metaURL, "", nil, bearer, &item); err != nil {
		return nil, err
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, metaURL+"/content", nil)
	req.Header.Set("Authorization", "Bearer "+bearer)
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("microsoft365 fetch %d: %s", resp.StatusCode, string(body))
	}
	mime := resp.Header.Get("Content-Type")
	if item.File != nil && item.File.MimeType != "" {
		mime = item.File.MimeType
	}
	return &connectors.Document{
		Resource: connectors.Resource{ID: resourceID, Type: "file", Title: item.Name, URL: item.WebURL, UpdatedAt: item.LastMod},
		Body:     body, MimeType: mime,
	}, nil
}

// Search runs Graph /search/query (POST searchRequests).
func (c *Connector) Search(ctx context.Context, tenantID uuid.UUID, query string) ([]connectors.Resource, error) {
	bearer, err := c.bearer(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	body, _ := json.Marshal(map[string]any{
		"requests": []map[string]any{{
			"entityTypes": []string{"driveItem"},
			"query":       map[string]string{"queryString": query},
		}},
	})
	var sr struct {
		Value []struct {
			HitsContainers []struct {
				Hits []struct {
					Resource struct {
						ID                   string    `json:"id"`
						Name                 string    `json:"name"`
						WebURL               string    `json:"webUrl"`
						LastModifiedDateTime time.Time `json:"lastModifiedDateTime"`
					} `json:"resource"`
				} `json:"hits"`
			} `json:"hitsContainers"`
		} `json:"value"`
	}
	if err := c.do(ctx, http.MethodPost, c.cfg.BaseURL+"/v1.0/search/query", "application/json", strings.NewReader(string(body)), bearer, &sr); err != nil {
		return nil, err
	}
	out := []connectors.Resource{}
	for _, v := range sr.Value {
		for _, hc := range v.HitsContainers {
			for _, h := range hc.Hits {
				out = append(out, connectors.Resource{ID: "drive:" + h.Resource.ID, Type: "file", Title: h.Resource.Name, URL: h.Resource.WebURL, UpdatedAt: h.Resource.LastModifiedDateTime})
			}
		}
	}
	return out, nil
}

// Watch creates a /subscriptions resource and returns a channel that
// closes on ctx cancel; webhook deliveries are routed in by the gateway.
func (c *Connector) Watch(ctx context.Context, tenantID uuid.UUID) (<-chan connectors.ChangeEvent, error) {
	bearer, err := c.bearer(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	body, _ := json.Marshal(map[string]any{
		"changeType":         "updated",
		"notificationUrl":    c.cfg.RedirectURI + "/webhooks/microsoft365",
		"resource":           "/me/drive/root",
		"expirationDateTime": time.Now().Add(24 * time.Hour),
		"clientState":        tenantID.String(),
	})
	if err := c.do(ctx, http.MethodPost, c.cfg.BaseURL+"/v1.0/subscriptions", "application/json", strings.NewReader(string(body)), bearer, nil); err != nil {
		return nil, err
	}
	ch := make(chan connectors.ChangeEvent, 8)
	go func() { <-ctx.Done(); close(ch) }()
	return ch, nil
}

// Metadata returns the registry metadata.
func Metadata() connectors.Metadata {
	return connectors.Metadata{
		Name: Name, DisplayName: "Microsoft 365", Vendor: "Microsoft", Category: "productivity",
		Scopes:  []connectors.Scope{"read:onedrive", "read:sharepoint", "read:teams_chat"},
		DocsURL: "https://learn.microsoft.com/en-us/graph/overview",
	}
}

// Register installs a default-config connector.
func Register(r *connectors.Registry, logger *slog.Logger) error {
	return r.RegisterWithMeta(New(Config{}, nil, logger), Metadata())
}
