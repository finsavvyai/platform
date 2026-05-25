// Package fingerprint builds stable, privacy-preserving device fingerprints
// from request signals. The fingerprint binds a session to the client device
// attributes visible at the HTTP layer so stolen tokens cannot be replayed
// from a different client without detection.
package fingerprint

import (
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"net/http"
	"sort"
	"strings"
)

// Signals holds the raw signals used to derive a fingerprint. Exposed so
// callers can record them for audit and drift analysis.
type Signals struct {
	IP             string
	UserAgent      string
	AcceptLanguage string
	AcceptEncoding string
	TLSVersion     uint16 // 0 when request is plaintext
	TLSCipherSuite uint16 // 0 when request is plaintext
	SecCHUA        string // Client Hints UA
	SecCHUAPlat    string // Client Hints Platform
}

// Extract pulls fingerprint signals from an HTTP request. The caller supplies
// the client IP because that lookup depends on trust-level of proxy headers,
// which is a policy decision the HTTP layer already made.
func Extract(r *http.Request, clientIP string) Signals {
	s := Signals{
		IP:             clientIP,
		UserAgent:      r.UserAgent(),
		AcceptLanguage: r.Header.Get("Accept-Language"),
		AcceptEncoding: r.Header.Get("Accept-Encoding"),
		SecCHUA:        r.Header.Get("Sec-CH-UA"),
		SecCHUAPlat:    r.Header.Get("Sec-CH-UA-Platform"),
	}
	if r.TLS != nil {
		s.TLSVersion = r.TLS.Version
		s.TLSCipherSuite = r.TLS.CipherSuite
	}
	return s
}

// Hash returns a hex-encoded SHA-256 fingerprint of the normalized signals.
// Empty signals are dropped so optional headers don't change the hash once
// a client starts sending them (or stops).
func (s Signals) Hash() string {
	parts := s.canonicalParts()
	joined := strings.Join(parts, "|")
	sum := sha256.Sum256([]byte(joined))
	return hex.EncodeToString(sum[:])
}

// Stable returns true when the fingerprint has enough signal to be reliable.
// A fingerprint with only an IP is not stable — mobile clients roam networks.
func (s Signals) Stable() bool {
	present := 0
	if s.UserAgent != "" {
		present++
	}
	if s.AcceptLanguage != "" {
		present++
	}
	if s.TLSVersion != 0 {
		present++
	}
	if s.SecCHUA != "" {
		present++
	}
	return present >= 2
}

// Matches reports whether two fingerprints agree exactly. Callers that need
// tolerant matching (e.g. IP roaming) should compare individual Signals
// fields rather than the hash.
func Matches(a, b string) bool {
	return a != "" && b != "" && a == b
}

// TLSName returns a stable label for the TLS version, used in audit logs.
func TLSName(v uint16) string {
	switch v {
	case tls.VersionTLS10:
		return "TLS1.0"
	case tls.VersionTLS11:
		return "TLS1.1"
	case tls.VersionTLS12:
		return "TLS1.2"
	case tls.VersionTLS13:
		return "TLS1.3"
	case 0:
		return "none"
	default:
		return "unknown"
	}
}

func (s Signals) canonicalParts() []string {
	var parts []string
	if s.UserAgent != "" {
		parts = append(parts, "ua="+s.UserAgent)
	}
	if s.AcceptLanguage != "" {
		parts = append(parts, "al="+normalizeHeader(s.AcceptLanguage))
	}
	if s.AcceptEncoding != "" {
		parts = append(parts, "ae="+normalizeHeader(s.AcceptEncoding))
	}
	if s.SecCHUA != "" {
		parts = append(parts, "chua="+s.SecCHUA)
	}
	if s.SecCHUAPlat != "" {
		parts = append(parts, "chup="+s.SecCHUAPlat)
	}
	if s.TLSVersion != 0 {
		parts = append(parts, "tls="+TLSName(s.TLSVersion))
	}
	if s.TLSCipherSuite != 0 {
		parts = append(parts, "cipher="+tls.CipherSuiteName(s.TLSCipherSuite))
	}
	// IP is deliberately last and low-weight: mobile clients roam.
	if s.IP != "" {
		parts = append(parts, "ip="+s.IP)
	}
	sort.Strings(parts)
	return parts
}

// normalizeHeader strips whitespace and lowercases comma-separated values to
// keep small cosmetic differences from rotating the hash.
func normalizeHeader(v string) string {
	items := strings.Split(v, ",")
	for i, it := range items {
		items[i] = strings.ToLower(strings.TrimSpace(it))
	}
	sort.Strings(items)
	return strings.Join(items, ",")
}
