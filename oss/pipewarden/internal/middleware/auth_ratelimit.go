package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

// AuthRateLimit is a tighter limiter mounted only on /api/v1/auth/*
// (login, signup, password-reset, TOTP). 10 requests per minute per IP
// is enough for legitimate retry but stops credential stuffing dead.
//
// Bypasses non-auth paths so the global RateLimiter still owns the
// general request budget.
func AuthRateLimit(next http.Handler) http.Handler {
	limiter := newAuthLimiter(10, time.Minute)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/v1/auth/") {
			next.ServeHTTP(w, r)
			return
		}
		ip := clientIPForAuth(r)
		if !limiter.allow(ip) {
			w.Header().Set("Retry-After", "60")
			http.Error(w, `{"error":"too many auth attempts — try again in a minute"}`, http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// authLimiter is a tiny token-bucket per IP, swept lazily on every
// request to keep memory bounded. Not redis-backed — single-process
// only, but that's fine for our deployment topology (one Go binary
// behind Cloudflare).
type authLimiter struct {
	mu     sync.Mutex
	hits   map[string][]time.Time
	max    int
	window time.Duration
}

func newAuthLimiter(max int, window time.Duration) *authLimiter {
	return &authLimiter{hits: map[string][]time.Time{}, max: max, window: window}
}

func (l *authLimiter) allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	cutoff := now.Add(-l.window)
	prior := l.hits[ip]
	out := prior[:0]
	for _, t := range prior {
		if t.After(cutoff) {
			out = append(out, t)
		}
	}
	if len(out) >= l.max {
		l.hits[ip] = out
		return false
	}
	l.hits[ip] = append(out, now)
	return true
}

// clientIPForAuth extracts the request originator's IP for the auth
// limiter — honours CF-Connecting-IP / X-Forwarded-For so Cloudflare/
// nginx-terminated traffic rate-limits by the real client. The package
// already exports a clientIP function with similar semantics; named
// distinctly so future swaps to a different precedence (e.g. signed
// True-Client-IP) are localised here.
func clientIPForAuth(r *http.Request) string {
	if cf := r.Header.Get("CF-Connecting-IP"); cf != "" {
		return cf
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if idx := strings.Index(xff, ","); idx > 0 {
			return strings.TrimSpace(xff[:idx])
		}
		return strings.TrimSpace(xff)
	}
	host := r.RemoteAddr
	if idx := strings.LastIndex(host, ":"); idx > 0 {
		return host[:idx]
	}
	return host
}
