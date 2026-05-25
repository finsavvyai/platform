// Package tenant resolves a request to a tenant_id. In transparent-
// proxy mode the request has no Authorization we issued — it carries
// the customer's own Anthropic key — so we attribute by source IP
// against tenant_network_map (one row per registered CIDR).
package tenant

import (
	"net"
	"net/netip"
	"sort"
)

// Resolver maps a remote IP to a tenant_id. The empty string means
// no match found; callers should treat that as "anonymous transparent
// traffic" and either bill to a default tenant or refuse.
type Resolver interface {
	ResolveByIP(ip netip.Addr) string
}

// NetworkMap is the in-process resolver. The pgx-backed loader feeds
// it once at boot + on a slow refresh ticker; lookups stay in-process
// because the Anthropic SSE path can't tolerate a DB round-trip per
// request.
type NetworkMap struct {
	rules []rule
}

type rule struct {
	prefix   netip.Prefix
	tenantID string
}

func NewNetworkMap(rows []Row) *NetworkMap {
	rules := make([]rule, 0, len(rows))
	for _, row := range rows {
		p, err := netip.ParsePrefix(row.CIDR)
		if err != nil {
			continue
		}
		rules = append(rules, rule{prefix: p, tenantID: row.TenantID})
	}
	// Most-specific match wins: sort by descending mask bits so the
	// first containing prefix in iteration order is the right one.
	sort.Slice(rules, func(i, j int) bool {
		return rules[i].prefix.Bits() > rules[j].prefix.Bits()
	})
	return &NetworkMap{rules: rules}
}

func (m *NetworkMap) ResolveByIP(ip netip.Addr) string {
	for _, r := range m.rules {
		if r.prefix.Contains(ip) {
			return r.tenantID
		}
	}
	return ""
}

// Row is the on-disk representation; the loader fills these from
// tenant_network_map. CIDR is the textual form ("10.0.0.0/8") because
// netip.ParsePrefix is the source of truth for parsing in Go.
type Row struct {
	CIDR     string
	TenantID string
}

// ParseRemoteAddr extracts the IP from an http.Request RemoteAddr
// (host:port). Returns the zero netip.Addr if the input doesn't
// parse so callers can do a single zero check.
func ParseRemoteAddr(remoteAddr string) netip.Addr {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	addr, err := netip.ParseAddr(host)
	if err != nil {
		return netip.Addr{}
	}
	return addr
}
