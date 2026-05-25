package api

import (
	"database/sql"
	"net/http"

	"github.com/aegis-aml/aegis/internal/config"
	"github.com/aegis-aml/aegis/internal/storage"
)

func setupAuthRoutes(
	mux *http.ServeMux,
	users storage.UserRepository,
	tenants storage.TenantRepository,
	authChain func(http.Handler) http.Handler,
	secret string,
	expiry int,
	oauthCfg config.OAuthConfig,
) {
	auth := NewAuthHandler(users, tenants, secret, expiry)
	oauth := NewOAuthHandler(users, tenants, oauthCfg, secret, expiry)

	mux.HandleFunc("POST /api/v1/auth/login", auth.Login)
	mux.HandleFunc("POST /api/v1/auth/signup", auth.Signup)
	mux.Handle("GET /api/v1/auth/me",
		authChain(http.HandlerFunc(auth.Me)))

	// OAuth redirects
	mux.HandleFunc("GET /auth/oauth/{provider}", oauth.Redirect)
	mux.HandleFunc("GET /auth/oauth/{provider}/callback", oauth.Callback)
}

// setupAuthResetRoutes adds password reset + MFA endpoints.
func setupAuthResetRoutes(
	mux *http.ServeMux,
	db *sql.DB,
	users storage.UserRepository,
	authChain func(http.Handler) http.Handler,
	secret string,
) {
	reset := NewResetHandler(db, users, secret)
	mux.HandleFunc("POST /api/v1/auth/forgot-password", reset.RequestReset)
	mux.HandleFunc("POST /api/v1/auth/reset-password", reset.ExecuteReset)

	mfaH := NewMFAHandler(db)
	mux.Handle("POST /api/v1/auth/mfa/setup",
		authChain(http.HandlerFunc(mfaH.Setup)))
	mux.Handle("POST /api/v1/auth/mfa/verify",
		authChain(http.HandlerFunc(mfaH.Verify)))
	mux.HandleFunc("POST /api/v1/auth/mfa/challenge", mfaH.Challenge)
}
