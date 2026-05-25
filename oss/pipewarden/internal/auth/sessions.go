package auth

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// SessionTTL is how long a login persists. 7 days matches industry default
// for non-MFA web sessions; refresh on activity is a future hardening step.
const SessionTTL = 7 * 24 * time.Hour

// SessionCookie is the name written by IssueSessionCookie. Centralised so
// frontend/backend can't drift.
const SessionCookie = "pipewarden_session"

// SessionClaims is the JWT body issued by IssueSession. UserID is the
// only durable identifier; everything else is informational + included
// to avoid a DB lookup on every request. PasswordVersion is the user's
// password_version at issue time — when the user resets their password
// we bump that column, invalidating every JWT carrying the prior value
// (effective "log out everywhere"). PasswordVersion is verified against
// the database lazily — on auth-protected requests that need it.
type SessionClaims struct {
	UserID          int64  `json:"uid"`
	Email           string `json:"email"`
	Onboarded       bool   `json:"onboarded"`
	PasswordVersion int64  `json:"pwv"`
	jwt.RegisteredClaims
}

// ErrInvalidSession means the cookie is missing, malformed, expired, or
// signed with the wrong key. Caller maps to 401.
var ErrInvalidSession = errors.New("invalid session")

// SessionSecret returns the HMAC key used to sign JWTs. Reads
// PIPEWARDEN_SESSION_SECRET so secrets stay out of source. Fails
// closed (returns nil) when unset — IssueSession surfaces a clear
// startup error in that case rather than silently signing with "".
func SessionSecret() []byte {
	s := os.Getenv("PIPEWARDEN_SESSION_SECRET")
	if s == "" {
		return nil
	}
	return []byte(s)
}

// IssueSession creates a new signed JWT for the user. Caller writes
// the result to a cookie via IssueSessionCookie. passwordVersion is
// stamped into the JWT claims so future password rotations invalidate
// this token without needing a session-revocation table.
func IssueSession(userID int64, email string, onboarded bool, passwordVersion int64) (string, error) {
	secret := SessionSecret()
	if secret == nil {
		return "", fmt.Errorf("PIPEWARDEN_SESSION_SECRET is not set — cannot issue sessions")
	}
	now := time.Now().UTC()
	claims := SessionClaims{
		UserID:          userID,
		Email:           email,
		Onboarded:       onboarded,
		PasswordVersion: passwordVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "pipewarden",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(SessionTTL)),
			NotBefore: jwt.NewNumericDate(now),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString(secret)
	if err != nil {
		return "", fmt.Errorf("sign session: %w", err)
	}
	return signed, nil
}

// VerifySession parses + verifies a token string. Returns the claims on
// success, ErrInvalidSession on any failure (signature, expiry, parse).
func VerifySession(tokenString string) (*SessionClaims, error) {
	secret := SessionSecret()
	if secret == nil {
		return nil, ErrInvalidSession
	}
	claims := &SessionClaims{}
	tok, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return secret, nil
	})
	if err != nil || !tok.Valid {
		return nil, ErrInvalidSession
	}
	return claims, nil
}

// IssueSessionCookie writes the signed token as an httpOnly cookie.
//
// Two prod-critical behaviors:
//
//  1. Secure flag derives from r.TLS or X-Forwarded-Proto=https. Local
//     plain HTTP gets non-Secure (browser-friendly); production behind
//     Cloudflare/nginx gets Secure automatically.
//
//  2. Domain attribute reads PIPEWARDEN_COOKIE_DOMAIN. Set this to
//     ".pipewarden.io" in production so a cookie issued by
//     api.pipewarden.io is sent on requests to pipewarden.io. Without
//     it, cookies are host-only — sign-in via api.pipewarden.io won't
//     authenticate the dashboard at pipewarden.io.
//
//     Cookies CANNOT span eTLD+1, so .pipewarden.io and pipewarden.com
//     are necessarily separate cookie scopes. Pick one canonical domain
//     and 301 the other to it.
//
// When SameSite=None (cross-domain cookies), the spec mandates Secure.
// We always issue SameSite=Lax which is safe over plain HTTP.
func IssueSessionCookie(w http.ResponseWriter, r *http.Request, token string) {
	http.SetCookie(w, sessionCookie(token, time.Now().Add(SessionTTL), 0, isHTTPS(r)))
}

// ClearSessionCookie writes an immediately-expired cookie to log out.
func ClearSessionCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, sessionCookie("", time.Time{}, -1, isHTTPS(r)))
}

func sessionCookie(value string, expires time.Time, maxAge int, secure bool) *http.Cookie {
	c := &http.Cookie{
		Name:     SessionCookie,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		Domain:   os.Getenv("PIPEWARDEN_COOKIE_DOMAIN"),
	}
	if maxAge != 0 {
		c.MaxAge = maxAge
	} else if !expires.IsZero() {
		c.Expires = expires
	}
	return c
}

// isHTTPS detects whether the request arrived over TLS, either directly
// or via a reverse proxy that set X-Forwarded-Proto. Used to decide
// whether the session cookie should carry the Secure flag.
func isHTTPS(r *http.Request) bool {
	if r == nil {
		return false
	}
	if r.TLS != nil {
		return true
	}
	if r.Header.Get("X-Forwarded-Proto") == "https" {
		return true
	}
	return false
}

// SessionFromRequest extracts + verifies the cookie. Returns nil
// claims + ErrInvalidSession when no valid session is present.
func SessionFromRequest(r *http.Request) (*SessionClaims, error) {
	c, err := r.Cookie(SessionCookie)
	if err != nil {
		return nil, ErrInvalidSession
	}
	return VerifySession(c.Value)
}
