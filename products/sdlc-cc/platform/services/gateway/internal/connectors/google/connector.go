// Package google is the REAL Google Workspace connector.
// Targets Drive (read), Docs (read), and Sheets (read).
//
// API references:
//   - Drive v3: https://developers.google.com/drive/api/v3/reference
//   - OAuth 2.0: https://developers.google.com/identity/protocols/oauth2
//
// Status: REAL HTTP client. Needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
// at runtime. Tests use httptest.NewServer + an in-memory TokenStore.
package google

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
const Name = "google_workspace"

// OAuth scopes required from Google.
var oauthScopes = []string{
	"https://www.googleapis.com/auth/drive.readonly",
	"https://www.googleapis.com/auth/documents.readonly",
	"https://www.googleapis.com/auth/spreadsheets.readonly",
}

// Connector is the REAL Google Workspace connector.
type Connector struct {
	logger       *slog.Logger
	tokens       connectors.Store
	hc           *http.Client
	clientID     string
	clientSecret string
	redirectURI  string

	// BaseURL points at https://www.googleapis.com in prod.
	BaseURL string
	// OAuthURL points at https://oauth2.googleapis.com in prod.
	OAuthURL string
}

// Config bundles runtime credentials for the connector.
type Config struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
}

// New returns a configured Google connector.
func New(logger *slog.Logger, tokens connectors.Store, cfg Config) *Connector {
	if logger == nil {
		logger = slog.Default()
	}
	return &Connector{
		logger:       logger.With("connector", Name),
		tokens:       tokens,
		hc:           &http.Client{Timeout: 30 * time.Second},
		clientID:     cfg.ClientID,
		clientSecret: cfg.ClientSecret,
		redirectURI:  cfg.RedirectURI,
		BaseURL:      "https://www.googleapis.com",
		OAuthURL:     "https://oauth2.googleapis.com",
	}
}

// Name returns the canonical id.
func (c *Connector) Name() string { return Name }

type tokenResp struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	Scope        string `json:"scope"`
	ExpiresIn    int    `json:"expires_in"`
}

// Authenticate exchanges an OAuth code for an access token at /token.
func (c *Connector) Authenticate(ctx context.Context, tenantID uuid.UUID, code string) error {
	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", c.clientID)
	form.Set("client_secret", c.clientSecret)
	form.Set("redirect_uri", c.redirectURI)
	form.Set("grant_type", "authorization_code")
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		strings.TrimRight(c.OAuthURL, "/")+"/token", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.hc.Do(req)
	if err != nil {
		return fmt.Errorf("google oauth: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("google oauth %d: %s", resp.StatusCode, string(raw))
	}
	var tr tokenResp
	if err := json.Unmarshal(raw, &tr); err != nil {
		return fmt.Errorf("google oauth decode: %w", err)
	}
	tok := connectors.Token{
		AccessToken:  tr.AccessToken,
		RefreshToken: tr.RefreshToken,
		TokenType:    tr.TokenType,
		Scope:        tr.Scope,
		Expiry:       time.Now().Add(time.Duration(tr.ExpiresIn) * time.Second),
	}
	return c.tokens.Save(ctx, tenantID, Name, tok)
}

type driveFile struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	MimeType     string `json:"mimeType"`
	WebViewLink  string `json:"webViewLink"`
	ModifiedTime string `json:"modifiedTime"`
}

type driveListResp struct {
	Files         []driveFile `json:"files"`
	NextPageToken string      `json:"nextPageToken"`
}

// ListResources enumerates Drive files with pageToken pagination.
func (c *Connector) ListResources(ctx context.Context, tenantID uuid.UUID) ([]connectors.Resource, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	var out []connectors.Resource
	pageToken := ""
	for {
		q := url.Values{}
		q.Set("fields", "files(id,name,mimeType,webViewLink,modifiedTime),nextPageToken")
		q.Set("pageSize", "100")
		if pageToken != "" {
			q.Set("pageToken", pageToken)
		}
		page, err := c.driveList(ctx, tok.AccessToken, q)
		if err != nil {
			return nil, err
		}
		for _, f := range page.Files {
			out = append(out, fileToResource(f))
		}
		if page.NextPageToken == "" {
			break
		}
		pageToken = page.NextPageToken
	}
	return out, nil
}

func (c *Connector) driveList(ctx context.Context, accessToken string, q url.Values) (*driveListResp, error) {
	u := strings.TrimRight(c.BaseURL, "/") + "/drive/v3/files?" + q.Encode()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("google drive list: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("google drive list %d: %s", resp.StatusCode, string(raw))
	}
	var page driveListResp
	if err := json.Unmarshal(raw, &page); err != nil {
		return nil, fmt.Errorf("google drive decode: %w", err)
	}
	return &page, nil
}

func fileToResource(f driveFile) connectors.Resource {
	t, _ := time.Parse(time.RFC3339, f.ModifiedTime)
	return connectors.Resource{
		ID:        f.ID,
		Type:      driveType(f.MimeType),
		Title:     f.Name,
		URL:       f.WebViewLink,
		UpdatedAt: t,
	}
}

func driveType(mime string) string {
	switch {
	case strings.Contains(mime, "spreadsheet"):
		return "sheet"
	case strings.Contains(mime, "document"):
		return "doc"
	default:
		return "file"
	}
}

// Fetch downloads file metadata + body via alt=media.
func (c *Connector) Fetch(ctx context.Context, tenantID uuid.UUID, resourceID string) (*connectors.Document, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	metaURL := fmt.Sprintf("%s/drive/v3/files/%s?fields=id,name,mimeType,webViewLink,modifiedTime",
		strings.TrimRight(c.BaseURL, "/"), url.PathEscape(resourceID))
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, metaURL, nil)
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("google fetch meta: %w", err)
	}
	raw, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("google fetch meta %d: %s", resp.StatusCode, string(raw))
	}
	var f driveFile
	if err := json.Unmarshal(raw, &f); err != nil {
		return nil, fmt.Errorf("google fetch decode: %w", err)
	}
	body, err := c.downloadBody(ctx, tok.AccessToken, resourceID, f.MimeType)
	if err != nil {
		return nil, err
	}
	return &connectors.Document{
		Resource: fileToResource(f),
		Body:     body,
		MimeType: f.MimeType,
	}, nil
}

func (c *Connector) downloadBody(ctx context.Context, accessToken, id, mime string) ([]byte, error) {
	var u string
	if strings.HasPrefix(mime, "application/vnd.google-apps") {
		u = fmt.Sprintf("%s/drive/v3/files/%s/export?mimeType=text/plain",
			strings.TrimRight(c.BaseURL, "/"), url.PathEscape(id))
	} else {
		u = fmt.Sprintf("%s/drive/v3/files/%s?alt=media",
			strings.TrimRight(c.BaseURL, "/"), url.PathEscape(id))
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("google fetch body: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("google fetch body %d: %s", resp.StatusCode, string(raw))
	}
	return raw, nil
}

// Search runs Drive's q= full-text query.
func (c *Connector) Search(ctx context.Context, tenantID uuid.UUID, query string) ([]connectors.Resource, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	q := url.Values{}
	q.Set("q", fmt.Sprintf("fullText contains %q", query))
	q.Set("fields", "files(id,name,mimeType,webViewLink,modifiedTime),nextPageToken")
	page, err := c.driveList(ctx, tok.AccessToken, q)
	if err != nil {
		return nil, err
	}
	out := make([]connectors.Resource, 0, len(page.Files))
	for _, f := range page.Files {
		out = append(out, fileToResource(f))
	}
	return out, nil
}

// Watch registers a Drive push notification channel (files.watch).
func (c *Connector) Watch(ctx context.Context, tenantID uuid.UUID) (<-chan connectors.ChangeEvent, error) {
	tok, err := c.tokens.Load(ctx, tenantID, Name)
	if err != nil {
		return nil, err
	}
	body, _ := json.Marshal(map[string]string{
		"id":      uuid.NewString(),
		"type":    "web_hook",
		"address": c.redirectURI,
	})
	u := strings.TrimRight(c.BaseURL, "/") + "/drive/v3/changes/watch"
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, u, strings.NewReader(string(body)))
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("google watch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("google watch %d: %s", resp.StatusCode, string(raw))
	}
	ch := make(chan connectors.ChangeEvent)
	go func() {
		<-ctx.Done()
		close(ch)
	}()
	return ch, nil
}

// Metadata returns the registry metadata.
func Metadata() connectors.Metadata {
	return connectors.Metadata{
		Name:        Name,
		DisplayName: "Google Workspace",
		Vendor:      "Google",
		Category:    "productivity",
		Scopes: []connectors.Scope{
			"read:drive",
			"read:docs",
			"read:sheets",
		},
		DocsURL: "https://developers.google.com/workspace",
	}
}

// Register installs the connector into the given registry.
func Register(r *connectors.Registry, logger *slog.Logger, tokens connectors.Store, cfg Config) error {
	return r.RegisterWithMeta(New(logger, tokens, cfg), Metadata())
}

// OAuthScopes exposes the Google OAuth scopes for the redirect URL.
func OAuthScopes() []string { return append([]string(nil), oauthScopes...) }
