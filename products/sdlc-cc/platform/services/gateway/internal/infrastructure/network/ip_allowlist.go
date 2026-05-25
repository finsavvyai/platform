// Per-tenant + per-API-key IP allowlist enforcement.
//
// Day 26 of the production-ready roadmap.
//
// Precedence: api-key-specific rule first, falling back to tenant-wide.
// CloudFlare-proxied requests honor `CF-Connecting-IP` over RemoteAddr.
package network

import (
	"net"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

// AllowList is the set of CIDRs configured for a tenant + (optional)
// API key. AllowList{nil, nil} means "no rule configured" — the
// caller decides allow vs deny based on tenant network_mode.
type AllowList struct {
	TenantWide []*net.IPNet
	PerKey     map[uuid.UUID][]*net.IPNet
}

// Permit returns true when the request IP is permitted under this
// allowlist. apiKeyID is uuid.Nil when the request was not API-key
// authenticated (e.g. session cookie).
func (a *AllowList) Permit(remoteIP net.IP, apiKeyID uuid.UUID) bool {
	if remoteIP == nil {
		return false
	}
	if apiKeyID != uuid.Nil {
		if rules, ok := a.PerKey[apiKeyID]; ok && len(rules) > 0 {
			return matchAny(remoteIP, rules)
		}
	}
	if len(a.TenantWide) == 0 {
		return false // no rule => deny when caller is in private_only mode
	}
	return matchAny(remoteIP, a.TenantWide)
}

func matchAny(ip net.IP, rules []*net.IPNet) bool {
	for _, c := range rules {
		if c.Contains(ip) {
			return true
		}
	}
	return false
}

// ClientIPFromRequest returns the request IP, honouring CloudFlare's
// `CF-Connecting-IP` when present. Falls back to RemoteAddr.
func ClientIPFromRequest(r *http.Request) net.IP {
	if cf := r.Header.Get("CF-Connecting-IP"); cf != "" {
		if ip := net.ParseIP(strings.TrimSpace(cf)); ip != nil {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return net.ParseIP(host)
}

// ParseCIDRs is a small helper that turns the DB-fetched strings into
// usable *net.IPNet values, skipping any malformed entries.
func ParseCIDRs(raw []string) []*net.IPNet {
	out := make([]*net.IPNet, 0, len(raw))
	for _, s := range raw {
		_, n, err := net.ParseCIDR(strings.TrimSpace(s))
		if err == nil {
			out = append(out, n)
		}
	}
	return out
}
