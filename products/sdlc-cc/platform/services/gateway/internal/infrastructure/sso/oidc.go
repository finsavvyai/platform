package sso

import (
	"context"
	"errors"
	"net/http"

	gooidc "github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

// OIDCConfig is the per-tenant OIDC / OpenID Connect IdP configuration.
// ClientSecret is stored encrypted at rest; decrypt before passing here.
type OIDCConfig struct {
	IssuerURL    string   // OIDC discovery URL (e.g. https://login.microsoftonline.com/<tid>/v2.0)
	ClientID     string
	ClientSecret string   // decrypted at runtime
	RedirectURL  string   // ACS-equivalent callback URL
	Scopes       []string // default: openid, email, profile
}

// OIDCProvider wraps coreos/go-oidc and golang.org/x/oauth2 for a tenant.
type OIDCProvider struct {
	verifier   *gooidc.IDTokenVerifier
	oauth2Cfg  oauth2.Config
}

// Verifier is the interface we mock in tests so we don't need a live IdP.
type Verifier interface {
	Verify(ctx context.Context, rawIDToken string) (*gooidc.IDToken, error)
}

// NewOIDCProvider fetches the OIDC discovery document and returns a ready
// provider. Pass a custom httpClient to override (useful in tests).
func NewOIDCProvider(ctx context.Context, cfg OIDCConfig, httpClient *http.Client) (*OIDCProvider, error) {
	if cfg.IssuerURL == "" || cfg.ClientID == "" {
		return nil, errors.New("sso: OIDCConfig requires IssuerURL and ClientID")
	}
	if httpClient != nil {
		ctx = gooidc.ClientContext(ctx, httpClient)
	}

	provider, err := gooidc.NewProvider(ctx, cfg.IssuerURL)
	if err != nil {
		return nil, err
	}

	scopes := cfg.Scopes
	if len(scopes) == 0 {
		scopes = []string{gooidc.ScopeOpenID, "email", "profile"}
	}

	verifier := provider.Verifier(&gooidc.Config{ClientID: cfg.ClientID})
	oauth2Cfg := oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		RedirectURL:  cfg.RedirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       scopes,
	}

	return &OIDCProvider{
		verifier:  verifier,
		oauth2Cfg: oauth2Cfg,
	}, nil
}

// AuthCodeURL returns the IdP redirect URL for the OAuth2 authorization code
// flow. state is a random, opaque, session-bound value.
func (p *OIDCProvider) AuthCodeURL(state string, extraParams ...oauth2.AuthCodeOption) string {
	return p.oauth2Cfg.AuthCodeURL(state, extraParams...)
}

// Exchange swaps the authorization code for an oauth2.Token.
func (p *OIDCProvider) Exchange(ctx context.Context, code string) (*oauth2.Token, error) {
	return p.oauth2Cfg.Exchange(ctx, code)
}

// VerifyIDToken validates the raw ID token string and returns the parsed claims.
// The caller must verify the nonce in the returned *IDToken against the session.
func (p *OIDCProvider) VerifyIDToken(ctx context.Context, rawIDToken string) (*gooidc.IDToken, error) {
	return p.verifier.Verify(ctx, rawIDToken)
}

// ExtractClaims unmarshals standard OIDC claims from the verified token into
// a plain map for downstream use (tenant user provisioning, session stamping).
func ExtractClaims(token *gooidc.IDToken) (map[string]interface{}, error) {
	var claims map[string]interface{}
	if err := token.Claims(&claims); err != nil {
		return nil, err
	}
	return claims, nil
}
