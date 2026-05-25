package security

import (
	"net"
	"strings"
)

// IPPolicy defines per-tenant IP and country restrictions.
type IPPolicy struct {
	AllowedIPs       []string
	AllowedCountries []string
	BlockedCountries []string
}

// DefaultPolicy returns a policy that allows all access.
func DefaultPolicy() *IPPolicy {
	return &IPPolicy{}
}

// IsAllowed checks whether the given IP is permitted by the policy.
func IsAllowed(ip string, policy *IPPolicy) bool {
	if policy == nil {
		return true
	}
	ip = normalizeIP(ip)
	if len(policy.AllowedIPs) > 0 {
		return matchesAnyIP(ip, policy.AllowedIPs)
	}
	return true
}

// IsCountryAllowed checks country-based rules.
func IsCountryAllowed(country string, policy *IPPolicy) bool {
	if policy == nil {
		return true
	}
	country = strings.ToUpper(strings.TrimSpace(country))
	if len(policy.BlockedCountries) > 0 {
		for _, c := range policy.BlockedCountries {
			if strings.ToUpper(c) == country {
				return false
			}
		}
	}
	if len(policy.AllowedCountries) > 0 {
		for _, c := range policy.AllowedCountries {
			if strings.ToUpper(c) == country {
				return true
			}
		}
		return false
	}
	return true
}

func matchesAnyIP(ip string, allowList []string) bool {
	for _, allowed := range allowList {
		if strings.Contains(allowed, "/") {
			if matchesCIDR(ip, allowed) {
				return true
			}
		} else if normalizeIP(allowed) == ip {
			return true
		}
	}
	return false
}

func matchesCIDR(ip, cidr string) bool {
	_, network, err := net.ParseCIDR(cidr)
	if err != nil {
		return false
	}
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return false
	}
	return network.Contains(parsed)
}

func normalizeIP(ip string) string {
	host, _, err := net.SplitHostPort(ip)
	if err != nil {
		return strings.TrimSpace(ip)
	}
	return host
}
