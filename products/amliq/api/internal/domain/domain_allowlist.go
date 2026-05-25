package domain

import (
	"fmt"
	"strings"
)

type DomainAllowlist struct {
	ID             string
	TenantID       string
	AllowedDomains []string
	MaxDomains     int
}

func NewDomainAllowlist(tenantID string, maxDomains int) (DomainAllowlist, error) {
	if tenantID == "" || maxDomains <= 0 {
		return DomainAllowlist{}, fmt.Errorf("invalid domain allowlist parameters")
	}
	return DomainAllowlist{
		ID:             generateID(),
		TenantID:       tenantID,
		AllowedDomains: []string{},
		MaxDomains:     maxDomains,
	}, nil
}

func (da *DomainAllowlist) AddDomain(domain string) error {
	if len(da.AllowedDomains) >= da.MaxDomains {
		return fmt.Errorf("max domains (%d) reached", da.MaxDomains)
	}
	domain = strings.TrimSpace(strings.ToLower(domain))
	if domain == "" {
		return fmt.Errorf("domain cannot be empty")
	}
	for _, d := range da.AllowedDomains {
		if d == domain {
			return fmt.Errorf("domain already allowed")
		}
	}
	da.AllowedDomains = append(da.AllowedDomains, domain)
	return nil
}

func (da *DomainAllowlist) RemoveDomain(domain string) {
	domain = strings.ToLower(domain)
	for i, d := range da.AllowedDomains {
		if d == domain {
			da.AllowedDomains = append(da.AllowedDomains[:i], da.AllowedDomains[i+1:]...)
			return
		}
	}
}

func (da DomainAllowlist) IsAllowed(origin string) bool {
	origin = strings.ToLower(origin)
	for _, d := range da.AllowedDomains {
		if d == origin || strings.HasSuffix(origin, "."+d) {
			return true
		}
	}
	return false
}
