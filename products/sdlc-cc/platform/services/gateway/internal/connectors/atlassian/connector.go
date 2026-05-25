// Package atlassian — REAL Jira + Confluence connector.
// Cloud: OAuth 3LO via auth.atlassian.com → /oauth/token/accessible-resources
// for cloud_id → api.atlassian.com/ex/{jira|confluence}/{cloudID}/...
// Server / Data Center: PAT via Bearer auth against the customer base URL,
// selected by Config.Mode == "server".
//
// Required env (cloud): ATLASSIAN_CLIENT_ID, _CLIENT_SECRET, _REDIRECT_URI.
// Required env (server): ATLASSIAN_SERVER_BASE_URL plus per-tenant PAT
// (delivered via the OAuth-callback `code` field).
package atlassian

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
const Name = "atlassian"

// Mode constants.
const (
	ModeCloud  = "cloud"
	ModeServer = "server"
)

// Config holds runtime credentials + endpoints.
type Config struct {
	Mode                                 string // "cloud" (default) | "server"
	ClientID, ClientSecret, RedirectURI  string
	BaseURL                              string // default https://api.atlassian.com (cloud); customer URL (server)
	AuthURL                              string // default https://auth.atlassian.com
}

// Connector implements connectors.Connector for Atlassian.
type Connector struct {
	cfg    Config
	hc     *http.Client
	tokens connectors.Store
	logger *slog.Logger
}

// New constructs the connector.
func New(cfg Config, tokens connectors.Store, logger *slog.Logger) *Connector {
	if cfg.Mode == "" {
		cfg.Mode = ModeCloud
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.atlassian.com"
	}
	if cfg.AuthURL == "" {
		cfg.AuthURL = "https://auth.atlassian.com"
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	cfg.AuthURL = strings.TrimRight(cfg.AuthURL, "/")
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

// Authenticate runs the cloud OAuth exchange + cloud_id lookup, or
// stores the PAT directly in server mode.
func (c *Connector) Authenticate(ctx context.Context, tenantID uuid.UUID, code string) error {
	if c.cfg.Mode == ModeServer {
		return c.tokens.Save(ctx, tenantID, Name, connectors.Token{
			AccessToken: code, TokenType: "Bearer",
			Extra: map[string]string{"mode": ModeServer, "base_url": c.cfg.BaseURL},
		})
	}
	body, _ := json.Marshal(map[string]string{
		"grant_type": "authorization_code", "client_id": c.cfg.ClientID,
		"client_secret": c.cfg.ClientSecret, "code": code, "redirect_uri": c.cfg.RedirectURI,
	})
	var tr struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		TokenType    string `json:"token_type"`
		Scope        string `json:"scope"`
		ExpiresIn    int    `json:"expires_in"`
	}
	if err := c.do(ctx, http.MethodPost, c.cfg.AuthURL+"/oauth/token", "application/json", strings.NewReader(string(body)), "", &tr); err != nil {
		return err
	}
	var ars []struct {
		ID, URL, Name string
	}
	if err := c.do(ctx, http.MethodGet, c.cfg.BaseURL+"/oauth/token/accessible-resources", "", nil, tr.AccessToken, &ars); err != nil {
		return err
	}
	if len(ars) == 0 {
		return fmt.Errorf("atlassian: no accessible resources for token")
	}
	return c.tokens.Save(ctx, tenantID, Name, connectors.Token{
		AccessToken: tr.AccessToken, RefreshToken: tr.RefreshToken, TokenType: tr.TokenType,
		Scope: tr.Scope, Expiry: time.Now().Add(time.Duration(tr.ExpiresIn) * time.Second),
		Extra: map[string]string{"mode": ModeCloud, "cloud_id": ars[0].ID},
	})
}

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
		return fmt.Errorf("atlassian %s: %w", fullURL, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("atlassian %s %d: %s", fullURL, resp.StatusCode, string(raw))
	}
	if out != nil {
		// Special-case: caller may want raw bytes back via *[]byte.
		if bp, ok := out.(*[]byte); ok {
			*bp = raw
			return nil
		}
		return json.Unmarshal(raw, out)
	}
	return nil
}

// productPath returns the per-product URL prefix + the bearer token.
func (c *Connector) productPath(ctx context.Context, tenantID uuid.UUID, product string) (string, string, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return "", "", err
	}
	if tok.Extra["mode"] == ModeServer {
		base := tok.Extra["base_url"]
		if base == "" {
			base = c.cfg.BaseURL
		}
		return strings.TrimRight(base, "/"), tok.AccessToken, nil
	}
	cid := tok.Extra["cloud_id"]
	if cid == "" {
		return "", "", fmt.Errorf("atlassian: missing cloud_id in token")
	}
	return c.cfg.BaseURL + "/ex/" + product + "/" + cid, tok.AccessToken, nil
}

type jiraIssue struct {
	ID, Key string
	Fields  struct {
		Summary string    `json:"summary"`
		Updated time.Time `json:"updated"`
	} `json:"fields"`
}

type confPage struct {
	ID, Title, Type string
	Links           struct {
		WebUI string `json:"webui"`
	} `json:"_links"`
	Body struct {
		Storage struct {
			Value string `json:"value"`
		} `json:"storage"`
	} `json:"body"`
}

// ListResources returns Jira issues + Confluence pages.
func (c *Connector) ListResources(ctx context.Context, tenantID uuid.UUID) ([]connectors.Resource, error) {
	out := []connectors.Resource{}
	jiraBase, bearer, err := c.productPath(ctx, tenantID, "jira")
	if err != nil {
		return nil, err
	}
	var jr struct {
		Issues []jiraIssue `json:"issues"`
	}
	if err := c.do(ctx, http.MethodGet, jiraBase+"/rest/api/3/search?jql="+url.QueryEscape("ORDER BY updated DESC")+"&maxResults=100", "", nil, bearer, &jr); err != nil {
		return nil, err
	}
	for _, is := range jr.Issues {
		out = append(out, connectors.Resource{ID: "jira:" + is.Key, Type: "issue", Title: is.Fields.Summary, URL: jiraBase + "/browse/" + is.Key, UpdatedAt: is.Fields.Updated})
	}
	confBase, bearer2, err := c.productPath(ctx, tenantID, "confluence")
	if err != nil {
		return nil, err
	}
	var cr struct {
		Results []confPage `json:"results"`
	}
	if err := c.do(ctx, http.MethodGet, confBase+"/wiki/rest/api/content?type=page&limit=100", "", nil, bearer2, &cr); err != nil {
		return nil, err
	}
	for _, p := range cr.Results {
		out = append(out, connectors.Resource{ID: "conf:" + p.ID, Type: "page", Title: p.Title, URL: confBase + p.Links.WebUI})
	}
	return out, nil
}

// Fetch returns a Jira issue or Confluence page by prefixed id.
func (c *Connector) Fetch(ctx context.Context, tenantID uuid.UUID, resourceID string) (*connectors.Document, error) {
	switch {
	case strings.HasPrefix(resourceID, "jira:"):
		key := strings.TrimPrefix(resourceID, "jira:")
		base, bearer, err := c.productPath(ctx, tenantID, "jira")
		if err != nil {
			return nil, err
		}
		var raw []byte
		if err := c.do(ctx, http.MethodGet, base+"/rest/api/3/issue/"+key, "", nil, bearer, &raw); err != nil {
			return nil, err
		}
		var is jiraIssue
		if err := json.Unmarshal(raw, &is); err != nil {
			return nil, err
		}
		return &connectors.Document{
			Resource: connectors.Resource{ID: resourceID, Type: "issue", Title: is.Fields.Summary, URL: base + "/browse/" + is.Key, UpdatedAt: is.Fields.Updated},
			Body:     raw, MimeType: "application/json",
		}, nil
	case strings.HasPrefix(resourceID, "conf:"):
		id := strings.TrimPrefix(resourceID, "conf:")
		base, bearer, err := c.productPath(ctx, tenantID, "confluence")
		if err != nil {
			return nil, err
		}
		var p confPage
		if err := c.do(ctx, http.MethodGet, base+"/wiki/rest/api/content/"+id+"?expand=body.storage", "", nil, bearer, &p); err != nil {
			return nil, err
		}
		return &connectors.Document{
			Resource: connectors.Resource{ID: resourceID, Type: "page", Title: p.Title, URL: base + p.Links.WebUI},
			Body:     []byte(p.Body.Storage.Value), MimeType: "text/html",
		}, nil
	}
	return nil, fmt.Errorf("atlassian: unknown resource id %q", resourceID)
}

// Search runs JQL (Jira) + CQL (Confluence) and merges hits.
func (c *Connector) Search(ctx context.Context, tenantID uuid.UUID, query string) ([]connectors.Resource, error) {
	out := []connectors.Resource{}
	jiraBase, bearer, err := c.productPath(ctx, tenantID, "jira")
	if err != nil {
		return nil, err
	}
	var jr struct {
		Issues []jiraIssue `json:"issues"`
	}
	jql := fmt.Sprintf(`text ~ %q`, query)
	if err := c.do(ctx, http.MethodGet, jiraBase+"/rest/api/3/search?jql="+url.QueryEscape(jql), "", nil, bearer, &jr); err == nil {
		for _, is := range jr.Issues {
			out = append(out, connectors.Resource{ID: "jira:" + is.Key, Type: "issue", Title: is.Fields.Summary, UpdatedAt: is.Fields.Updated})
		}
	}
	confBase, bearer2, err := c.productPath(ctx, tenantID, "confluence")
	if err != nil {
		return out, nil
	}
	var cr struct {
		Results []confPage `json:"results"`
	}
	cql := fmt.Sprintf(`type=page AND text ~ %q`, query)
	if err := c.do(ctx, http.MethodGet, confBase+"/wiki/rest/api/content/search?cql="+url.QueryEscape(cql), "", nil, bearer2, &cr); err == nil {
		for _, p := range cr.Results {
			out = append(out, connectors.Resource{ID: "conf:" + p.ID, Type: "page", Title: p.Title})
		}
	}
	return out, nil
}

// Watch registers an Atlassian webhook for Jira issue events. The
// returned channel closes on ctx cancel; the gateway routes deliveries.
func (c *Connector) Watch(ctx context.Context, tenantID uuid.UUID) (<-chan connectors.ChangeEvent, error) {
	jiraBase, bearer, err := c.productPath(ctx, tenantID, "jira")
	if err != nil {
		return nil, err
	}
	body, _ := json.Marshal(map[string]any{
		"url":    c.cfg.RedirectURI + "/webhooks/atlassian",
		"events": []string{"jira:issue_created", "jira:issue_updated"},
	})
	if err := c.do(ctx, http.MethodPost, jiraBase+"/rest/api/3/webhook", "application/json", strings.NewReader(string(body)), bearer, nil); err != nil {
		return nil, err
	}
	ch := make(chan connectors.ChangeEvent, 8)
	go func() { <-ctx.Done(); close(ch) }()
	return ch, nil
}

// Metadata returns the registry metadata.
func Metadata() connectors.Metadata {
	return connectors.Metadata{
		Name: Name, DisplayName: "Atlassian (Jira + Confluence)", Vendor: "Atlassian", Category: "devtools",
		Scopes:  []connectors.Scope{"read:jira_issues", "read:confluence_pages"},
		DocsURL: "https://developer.atlassian.com/",
	}
}

// Register installs a default-config connector.
func Register(r *connectors.Registry, logger *slog.Logger) error {
	return r.RegisterWithMeta(New(Config{}, nil, logger), Metadata())
}
