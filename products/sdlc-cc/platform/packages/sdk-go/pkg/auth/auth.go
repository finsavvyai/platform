//go:build never
// +build never

package auth

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/clientcredentials"

	"github.com/SDLC/sdln-sdk-go/pkg/sdln"
)

// Authenticator implementations

// APIKeyAuth authenticates using an API key
type APIKeyAuth struct {
	apiKey string
	header string // e.g., "X-API-Key", "Authorization"
	prefix string // e.g., "Bearer", ""
}

// NewAPIKeyAuth creates a new API key authenticator
func NewAPIKeyAuth(apiKey string) *APIKeyAuth {
	return &APIKeyAuth{
		apiKey: apiKey,
		header: "Authorization",
		prefix: "Bearer",
	}
}

// NewAPIKeyAuthWithHeader creates a new API key authenticator with custom header
func NewAPIKeyAuthWithHeader(apiKey, header, prefix string) *APIKeyAuth {
	return &APIKeyAuth{
		apiKey: apiKey,
		header: header,
		prefix: prefix,
	}
}

// Authenticate adds the API key to the request
func (a *APIKeyAuth) Authenticate(ctx context.Context, req sdln.Request) error {
	if a.apiKey == "" {
		return sdln.ErrUnauthorized("API key is required")
	}

	value := a.apiKey
	if a.prefix != "" {
		value = a.prefix + " " + value
	}

	req.SetHeader(a.header, value)
	return nil
}

// RefreshToken is a no-op for API key authentication
func (a *APIKeyAuth) RefreshToken(ctx context.Context) error {
	return nil
}

// IsValid always returns true for API key authentication
func (a *APIKeyAuth) IsValid(ctx context.Context) bool {
	return a.apiKey != ""
}

// JWTAuth authenticates using a JWT token
type JWTAuth struct {
	token        string
	tokenSource  jwt.Claims
	refreshToken string
	keyFunc      jwt.Keyfunc
	autoRefresh  bool
	refreshURL   string
	clientID     string
	clientSecret string
}

// NewJWTAuth creates a new JWT authenticator
func NewJWTAuth(token string) *JWTAuth {
	return &JWTAuth{
		token:       token,
		autoRefresh: false,
	}
}

// NewJWTAuthWithRefresh creates a new JWT authenticator with refresh capabilities
func NewJWTAuthWithRefresh(token, refreshToken, refreshURL, clientID, clientSecret string) *JWTAuth {
	return &JWTAuth{
		token:        token,
		refreshToken: refreshToken,
		refreshURL:   refreshURL,
		clientID:     clientID,
		clientSecret: clientSecret,
		autoRefresh:  true,
	}
}

// Authenticate adds the JWT token to the request
func (a *JWTAuth) Authenticate(ctx context.Context, req sdln.Request) error {
	if a.token == "" {
		return sdln.ErrUnauthorized("JWT token is required")
	}

	// Validate token if key function is provided
	if a.keyFunc != nil {
		_, err := jwt.Parse(a.token, a.keyFunc)
		if err != nil {
			// Try to refresh if auto-refresh is enabled
			if a.autoRefresh && a.refreshToken != "" {
				if refreshErr := a.RefreshToken(ctx); refreshErr == nil {
					return a.Authenticate(ctx, req)
				}
			}
			return sdln.ErrAuthenticationError("invalid JWT token: " + err.Error())
		}
	}

	req.SetHeader("Authorization", "Bearer "+a.token)
	return nil
}

// RefreshToken refreshes the JWT token
func (a *JWTAuth) RefreshToken(ctx context.Context) error {
	if !a.autoRefresh || a.refreshToken == "" || a.refreshURL == "" {
		return fmt.Errorf("token refresh not configured")
	}

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequestWithContext(ctx, "POST", a.refreshURL, strings.NewReader(fmt.Sprintf(
		"grant_type=refresh_token&refresh_token=%s&client_id=%s&client_secret=%s",
		a.refreshToken,
		a.clientID,
		a.clientSecret,
	)))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("token refresh failed with status: %d", resp.StatusCode)
	}

	// Parse response to get new token
	// TODO: Implement proper response parsing
	return nil
}

// IsValid checks if the JWT token is valid
func (a *JWTAuth) IsValid(ctx context.Context) bool {
	if a.token == "" {
		return false
	}

	if a.keyFunc == nil {
		return true // No validation possible
	}

	_, err := jwt.Parse(a.token, a.keyFunc)
	return err == nil
}

// SetKeyFunc sets the key function for token validation
func (a *JWTAuth) SetKeyFunc(keyFunc jwt.Keyfunc) {
	a.keyFunc = keyFunc
}

// OAuthConfig holds OAuth configuration
type OAuthConfig struct {
	ClientID       string
	ClientSecret   string
	RedirectURL    string
	Scopes         []string
	TokenURL       string
	AuthURL        string
	EndpointParams map[string]string
}

// OAuthAuth authenticates using OAuth 2.0
type OAuthAuth struct {
	config *OAuthConfig
	oauth2 *clientcredentials.Config
	token  *oauth2.Token
}

// NewOAuthAuth creates a new OAuth authenticator
func NewOAuthAuth(config *OAuthConfig) (*OAuthAuth, error) {
	if config == nil {
		return nil, fmt.Errorf("OAuth config is required")
	}

	oauth2Config := &clientcredentials.Config{
		ClientID:       config.ClientID,
		ClientSecret:   config.ClientSecret,
		Scopes:         config.Scopes,
		TokenURL:       config.TokenURL,
		EndpointParams: config.EndpointParams,
	}

	return &OAuthAuth{
		config: config,
		oauth2: oauth2Config,
	}, nil
}

// Authenticate adds OAuth token to the request
func (a *OAuthAuth) Authenticate(ctx context.Context, req sdln.Request) error {
	if err := a.ensureToken(ctx); err != nil {
		return err
	}

	req.SetHeader("Authorization", "Bearer "+a.token.AccessToken)
	return nil
}

// RefreshToken refreshes the OAuth token
func (a *OAuthAuth) RefreshToken(ctx context.Context) error {
	newToken, err := a.oauth2.Token(ctx)
	if err != nil {
		return fmt.Errorf("failed to refresh OAuth token: %w", err)
	}

	a.token = newToken
	return nil
}

// IsValid checks if the OAuth token is valid
func (a *OAuthAuth) IsValid(ctx context.Context) bool {
	if a.token == nil {
		return false
	}

	return a.token.Valid() && !a.token.Expiry.IsZero() && a.token.Expiry.After(time.Now().Add(30*time.Second))
}

// ensureToken ensures we have a valid token
func (a *OAuthAuth) ensureToken(ctx context.Context) error {
	if !a.IsValid(ctx) {
		return a.RefreshToken(ctx)
	}
	return nil
}

// MTLSConfig holds mTLS configuration
type MTLSConfig struct {
	CertFile   string
	KeyFile    string
	CAFile     string
	CertPEM    []byte
	KeyPEM     []byte
	CAPEM      []byte
	SkipVerify bool
	ServerName string
}

// MTLSAuth authenticates using mutual TLS
type MTLSAuth struct {
	config    *MTLSConfig
	tlsConfig *tls.Config
	cert      tls.Certificate
}

// NewMTLSAuth creates a new mTLS authenticator
func NewMTLSAuth(config *MTLSConfig) (*MTLSAuth, error) {
	if config == nil {
		return nil, fmt.Errorf("mTLS config is required")
	}

	auth := &MTLSAuth{
		config: config,
	}

	// Load certificate
	if err := auth.loadCertificate(); err != nil {
		return nil, fmt.Errorf("failed to load certificate: %w", err)
	}

	// Create TLS config
	if err := auth.createTLSConfig(); err != nil {
		return nil, fmt.Errorf("failed to create TLS config: %w", err)
	}

	return auth, nil
}

// Authenticate configures the request for mTLS
func (a *MTLSAuth) Authenticate(ctx context.Context, req sdln.Request) error {
	// mTLS authentication is handled at the transport level
	// This method can be used to add any additional headers if needed
	return nil
}

// RefreshToken is a no-op for mTLS authentication
func (a *MTLSAuth) RefreshToken(ctx context.Context) error {
	return nil
}

// IsValid always returns true for mTLS authentication
func (a *MTLSAuth) IsValid(ctx context.Context) bool {
	return true
}

// GetTLSConfig returns the TLS configuration for HTTP client
func (a *MTLSAuth) GetTLSConfig() *tls.Config {
	return a.tlsConfig
}

// loadCertificate loads the client certificate
func (a *MTLSAuth) loadCertificate() error {
	var certData, keyData []byte
	var err error

	// Load certificate
	if len(a.config.CertPEM) > 0 {
		certData = a.config.CertPEM
	} else if a.config.CertFile != "" {
		certData, err = ioutil.ReadFile(a.config.CertFile)
		if err != nil {
			return fmt.Errorf("failed to read certificate file: %w", err)
		}
	} else {
		return fmt.Errorf("certificate file or PEM data is required")
	}

	// Load private key
	if len(a.config.KeyPEM) > 0 {
		keyData = a.config.KeyPEM
	} else if a.config.KeyFile != "" {
		keyData, err = ioutil.ReadFile(a.config.KeyFile)
		if err != nil {
			return fmt.Errorf("failed to read key file: %w", err)
		}
	} else {
		return fmt.Errorf("key file or PEM data is required")
	}

	// Load certificate
	cert, err := tls.X509KeyPair(certData, keyData)
	if err != nil {
		return fmt.Errorf("failed to parse certificate/key pair: %w", err)
	}

	a.cert = cert
	return nil
}

// createTLSConfig creates the TLS configuration
func (a *MTLSAuth) createTLSConfig() error {
	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{a.cert},
		SkipVerify:   a.config.SkipVerify,
		ServerName:   a.config.ServerName,
		MinVersion:   tls.VersionTLS12,
	}

	// Load CA certificate if provided
	if len(a.config.CAPEM) > 0 || a.config.CAFile != "" {
		caData, err := a.loadCA()
		if err != nil {
			return fmt.Errorf("failed to load CA certificate: %w", err)
		}

		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caData) {
			return fmt.Errorf("failed to parse CA certificate")
		}

		tlsConfig.RootCAs = caCertPool
		if !a.config.SkipVerify {
			tlsConfig.ClientCAs = caCertPool
			tlsConfig.ClientAuth = tls.RequireAndVerifyClientCert
		}
	}

	a.tlsConfig = tlsConfig
	return nil
}

// loadCA loads the CA certificate
func (a *MTLSAuth) loadCA() ([]byte, error) {
	if len(a.config.CAPEM) > 0 {
		return a.config.CAPEM, nil
	}

	if a.config.CAFile != "" {
		return ioutil.ReadFile(a.config.CAFile)
	}

	return nil, fmt.Errorf("CA file or PEM data is required")
}

// MultiAuth combines multiple authentication methods
type MultiAuth struct {
	authenticators []sdln.Authenticator
	strategy       AuthStrategy
}

// AuthStrategy defines how to combine multiple authenticators
type AuthStrategy int

const (
	// AuthStrategyFirst uses the first successful authentication
	AuthStrategyFirst AuthStrategy = iota
	// AuthStrategyAll requires all authenticators to succeed
	AuthStrategyAll
	// AuthStrategyAny requires at least one authenticator to succeed
	AuthStrategyAny
)

// NewMultiAuth creates a new multi-authenticator
func NewMultiAuth(authenticators ...sdln.Authenticator) *MultiAuth {
	return &MultiAuth{
		authenticators: authenticators,
		strategy:       AuthStrategyFirst,
	}
}

// WithStrategy sets the authentication strategy
func (a *MultiAuth) WithStrategy(strategy AuthStrategy) *MultiAuth {
	a.strategy = strategy
	return a
}

// Authenticate implements the Authenticator interface
func (a *MultiAuth) Authenticate(ctx context.Context, req sdln.Request) error {
	switch a.strategy {
	case AuthStrategyFirst:
		for _, auth := range a.authenticators {
			if err := auth.Authenticate(ctx, req); err == nil {
				return nil
			}
		}
		return sdln.ErrAuthenticationError("all authentication methods failed")

	case AuthStrategyAll:
		for _, auth := range a.authenticators {
			if err := auth.Authenticate(ctx, req); err != nil {
				return err
			}
		}
		return nil

	case AuthStrategyAny:
		var lastErr error
		for _, auth := range a.authenticators {
			if err := auth.Authenticate(ctx, req); err == nil {
				return nil
			} else {
				lastErr = err
			}
		}
		if lastErr != nil {
			return lastErr
		}
		return nil

	default:
		return sdln.ErrAuthenticationError("unknown authentication strategy")
	}
}

// RefreshToken refreshes all applicable tokens
func (a *MultiAuth) RefreshToken(ctx context.Context) error {
	for _, auth := range a.authenticators {
		if err := auth.RefreshToken(ctx); err != nil {
			// Log error but continue
			// TODO: Add proper logging
		}
	}
	return nil
}

// IsValid checks if any authenticator is valid
func (a *MultiAuth) IsValid(ctx context.Context) bool {
	for _, auth := range a.authenticators {
		if auth.IsValid(ctx) {
			return true
		}
	}
	return false
}
