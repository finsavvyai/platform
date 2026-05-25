package config

import "time"

// defaultTimeout is used when no timeout is configured. Five
// minutes prevents infinite hangs from broken commands (e.g.
// wrangler deploy on a misconfigured project).
const defaultTimeout = 5 * time.Minute

// ParseTimeout interprets a Go duration string ("30s", "5m") into
// a time.Duration. Returns defaultTimeout when empty or invalid.
func ParseTimeout(s string) time.Duration {
	if s == "" {
		return defaultTimeout
	}
	d, err := time.ParseDuration(s)
	if err != nil || d <= 0 {
		return defaultTimeout
	}
	return d
}
