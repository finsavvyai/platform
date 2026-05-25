package api

import (
	"net/http"
	"sync"
	"time"
)

// IPRateLimiter limits requests per IP address within a time window.
type IPRateLimiter struct {
	mu      sync.Mutex
	counts  map[string]int
	limit   int
	window  time.Duration
	cleanup time.Time
}

func NewIPRateLimiter(limit int, window time.Duration) *IPRateLimiter {
	return &IPRateLimiter{
		counts:  make(map[string]int),
		limit:   limit,
		window:  window,
		cleanup: time.Now().Add(window),
	}
}

func (l *IPRateLimiter) Allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if time.Now().After(l.cleanup) {
		l.counts = make(map[string]int)
		l.cleanup = time.Now().Add(l.window)
	}
	l.counts[ip]++
	return l.counts[ip] <= l.limit
}

func clientIP(r *http.Request) string {
	if cf := r.Header.Get("CF-Connecting-IP"); cf != "" {
		return cf
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}
	return r.RemoteAddr
}

func isCloudflareBot(r *http.Request) bool {
	return r.Header.Get("CF-Bot-Score") != "" &&
		r.Header.Get("CF-Bot-Score") < "30"
}
