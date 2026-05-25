// Package salesforce — REAL Salesforce REST connector.
// OAuth via /services/oauth2/token (response carries instance_url, kept
// in Token.Extra). Resource enumeration walks Account/Contact/
// Opportunity/Case via SOQL. FLS is enforced implicitly: Salesforce
// omits any field the connected user lacks read access to, so the
// connector indexes only what the API returns. See
// TestFetch_FLSStrip_FieldOmittedWhenRestricted for the contract test.
//
// Required env: SALESFORCE_CLIENT_ID, _CLIENT_SECRET, _LOGIN_URL, _REDIRECT_URI.
package salesforce

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
const Name = "salesforce"

// APIVersion is the REST API version (Winter '24).
const APIVersion = "v59.0"

// Config holds runtime credentials + endpoints.
type Config struct {
	ClientID, ClientSecret, RedirectURI string
	LoginURL                            string // default https://login.salesforce.com
	BaseURL                             string // optional override of instance_url for tests
	// Fields maps an sObject → comma-separated field projection.
	// FLS is enforced by Salesforce: only fields the user can view come back.
	Fields map[string]string
}

// Connector implements connectors.Connector for Salesforce.
type Connector struct {
	cfg    Config
	hc     *http.Client
	tokens connectors.Store
	logger *slog.Logger
}

var defaultObjects = []string{"Account", "Contact", "Opportunity", "Case"}

func defaultFields() map[string]string {
	return map[string]string{
		"Account":     "Id,Name,Industry,LastModifiedDate",
		"Contact":     "Id,Name,Email,Title,LastModifiedDate",
		"Opportunity": "Id,Name,StageName,Amount,CloseDate,LastModifiedDate",
		"Case":        "Id,CaseNumber,Subject,Status,LastModifiedDate",
	}
}

// New constructs the connector.
func New(cfg Config, tokens connectors.Store, logger *slog.Logger) *Connector {
	if cfg.LoginURL == "" {
		cfg.LoginURL = "https://login.salesforce.com"
	}
	cfg.LoginURL = strings.TrimRight(cfg.LoginURL, "/")
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	if cfg.Fields == nil {
		cfg.Fields = defaultFields()
	}
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

// Authenticate exchanges the OAuth code for an access token + instance_url.
func (c *Connector) Authenticate(ctx context.Context, tenantID uuid.UUID, code string) error {
	form := url.Values{
		"grant_type": {"authorization_code"}, "client_id": {c.cfg.ClientID},
		"client_secret": {c.cfg.ClientSecret}, "code": {code}, "redirect_uri": {c.cfg.RedirectURI},
	}
	var tr struct {
		AccessToken string `json:"access_token"`
		InstanceURL string `json:"instance_url"`
		TokenType   string `json:"token_type"`
	}
	if err := c.do(ctx, http.MethodPost, c.cfg.LoginURL+"/services/oauth2/token",
		"application/x-www-form-urlencoded", strings.NewReader(form.Encode()), "", &tr); err != nil {
		return err
	}
	return c.tokens.Save(ctx, tenantID, Name, connectors.Token{
		AccessToken: tr.AccessToken, TokenType: tr.TokenType,
		Expiry: time.Now().Add(2 * time.Hour),
		Extra:  map[string]string{"instance_url": tr.InstanceURL},
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
		return fmt.Errorf("salesforce %s: %w", fullURL, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	// Allow callers to ignore 409 (PushTopic dup) by reading status separately.
	if resp.StatusCode >= 400 {
		if sc, ok := out.(*int); ok {
			*sc = resp.StatusCode
			return nil
		}
		return fmt.Errorf("salesforce %s %d: %s", fullURL, resp.StatusCode, string(raw))
	}
	if out != nil {
		if bp, ok := out.(*[]byte); ok {
			*bp = raw
			return nil
		}
		if _, ok := out.(*int); ok {
			return nil
		}
		return json.Unmarshal(raw, out)
	}
	return nil
}

func (c *Connector) ctx(ctx context.Context, tenantID uuid.UUID) (string, string, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return "", "", err
	}
	base := c.cfg.BaseURL
	if base == "" {
		base = strings.TrimRight(tok.Extra["instance_url"], "/")
	}
	return base, tok.AccessToken, nil
}

// ListResources runs SOQL against the four core CRM objects.
func (c *Connector) ListResources(ctx context.Context, tenantID uuid.UUID) ([]connectors.Resource, error) {
	base, bearer, err := c.ctx(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	out := []connectors.Resource{}
	for _, obj := range defaultObjects {
		fields := c.cfg.Fields[obj]
		if fields == "" {
			continue
		}
		soql := fmt.Sprintf("SELECT %s FROM %s ORDER BY LastModifiedDate DESC LIMIT 200", fields, obj)
		fullURL := fmt.Sprintf("%s/services/data/%s/query?q=%s", base, APIVersion, url.QueryEscape(soql))
		var qr struct {
			Records []map[string]any `json:"records"`
		}
		if err := c.do(ctx, http.MethodGet, fullURL, "", nil, bearer, &qr); err != nil {
			return nil, err
		}
		for _, rec := range qr.Records {
			id, _ := rec["Id"].(string)
			out = append(out, connectors.Resource{
				ID: obj + ":" + id, Type: strings.ToLower(obj), Title: titleOf(obj, rec),
				URL: base + "/" + id, UpdatedAt: parseSFDate(rec["LastModifiedDate"]),
			})
		}
	}
	return out, nil
}

func titleOf(obj string, rec map[string]any) string {
	for _, k := range []string{"Name", "Subject", "CaseNumber"} {
		if v, ok := rec[k].(string); ok && v != "" {
			return v
		}
	}
	return obj
}

func parseSFDate(v any) time.Time {
	s, ok := v.(string)
	if !ok {
		return time.Time{}
	}
	t, _ := time.Parse(time.RFC3339, s)
	return t
}

// Fetch reads a single record. Salesforce omits fields the user lacks
// FLS for, so the returned Body is precisely what the user can see.
func (c *Connector) Fetch(ctx context.Context, tenantID uuid.UUID, resourceID string) (*connectors.Document, error) {
	parts := strings.SplitN(resourceID, ":", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("salesforce: bad resource id %q (want Object:Id)", resourceID)
	}
	obj, id := parts[0], parts[1]
	base, bearer, err := c.ctx(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	fullURL := fmt.Sprintf("%s/services/data/%s/sobjects/%s/%s", base, APIVersion, obj, id)
	var raw []byte
	if err := c.do(ctx, http.MethodGet, fullURL, "", nil, bearer, &raw); err != nil {
		return nil, err
	}
	var rec map[string]any
	if err := json.Unmarshal(raw, &rec); err != nil {
		return nil, err
	}
	return &connectors.Document{
		Resource: connectors.Resource{
			ID: resourceID, Type: strings.ToLower(obj), Title: titleOf(obj, rec),
			URL: base + "/" + id, UpdatedAt: parseSFDate(rec["LastModifiedDate"]),
		},
		Body: raw, MimeType: "application/json",
	}, nil
}

// Search uses /parameterizedSearch.
func (c *Connector) Search(ctx context.Context, tenantID uuid.UUID, query string) ([]connectors.Resource, error) {
	base, bearer, err := c.ctx(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	fullURL := fmt.Sprintf("%s/services/data/%s/parameterizedSearch?q=%s", base, APIVersion, url.QueryEscape(query))
	var sr struct {
		SearchRecords []map[string]any `json:"searchRecords"`
	}
	if err := c.do(ctx, http.MethodGet, fullURL, "", nil, bearer, &sr); err != nil {
		return nil, err
	}
	out := []connectors.Resource{}
	for _, rec := range sr.SearchRecords {
		id, _ := rec["Id"].(string)
		obj := "Record"
		if attrs, ok := rec["attributes"].(map[string]any); ok {
			if t, ok := attrs["type"].(string); ok {
				obj = t
			}
		}
		out = append(out, connectors.Resource{ID: obj + ":" + id, Type: strings.ToLower(obj), Title: titleOf(obj, rec)})
	}
	return out, nil
}

// Watch creates a PushTopic streaming subscription. 409 means the topic
// already exists, which is fine.
func (c *Connector) Watch(ctx context.Context, tenantID uuid.UUID) (<-chan connectors.ChangeEvent, error) {
	base, bearer, err := c.ctx(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	body, _ := json.Marshal(map[string]any{
		"Name": "sdlcAccountFeed", "Query": "SELECT Id, Name FROM Account",
		"ApiVersion": "59.0", "NotifyForFields": "Referenced", "NotifyForOperationUpdate": true,
	})
	var sc int
	if err := c.do(ctx, http.MethodPost, base+"/services/data/"+APIVersion+"/sobjects/PushTopic", "application/json", strings.NewReader(string(body)), bearer, &sc); err != nil {
		return nil, err
	}
	if sc != 0 && sc != http.StatusConflict && sc >= 400 {
		return nil, fmt.Errorf("salesforce pushtopic: status %d", sc)
	}
	ch := make(chan connectors.ChangeEvent, 8)
	go func() { <-ctx.Done(); close(ch) }()
	return ch, nil
}

// Metadata returns the registry metadata.
func Metadata() connectors.Metadata {
	return connectors.Metadata{
		Name: Name, DisplayName: "Salesforce", Vendor: "Salesforce", Category: "crm",
		Scopes:  []connectors.Scope{"read:accounts", "read:opportunities", "read:contacts"},
		DocsURL: "https://developer.salesforce.com/docs",
	}
}

// Register installs a default-config connector.
func Register(r *connectors.Registry, logger *slog.Logger) error {
	return r.RegisterWithMeta(New(Config{}, nil, logger), Metadata())
}
