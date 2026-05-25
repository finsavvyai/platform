package domain_verification

import (
	"context"
	"errors"
	"strings"
	"time"
)

// SSORedirector decides whether a login email should be sent to a tenant's
// configured SSO based on verified domain ownership.
type SSORedirector struct {
	Store  Store
	SSOURL SSOURLFunc
	Now    func() time.Time
}

// NewSSORedirector returns a SSORedirector with a real-time clock.
func NewSSORedirector(store Store, ssoURL SSOURLFunc) *SSORedirector {
	return &SSORedirector{Store: store, SSOURL: ssoURL, Now: time.Now}
}

// RedirectURL returns the tenant's SSO start URL when the email's domain is
// verified and not expired. Returns ("", nil) when no redirect is required.
func (r *SSORedirector) RedirectURL(ctx context.Context, email string) (string, error) {
	domain := emailDomain(email)
	if domain == "" {
		return "", nil
	}
	rec, err := r.Store.FindVerifiedByDomain(ctx, domain)
	if errors.Is(err, ErrNotFound) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if rec.IsExpired(r.Now()) {
		rec.Status = StatusExpired
		_ = r.Store.Save(ctx, rec)
		return "", nil
	}
	return r.SSOURL(ctx, rec.TenantID)
}

func emailDomain(email string) string {
	at := strings.LastIndex(email, "@")
	if at < 0 || at == len(email)-1 {
		return ""
	}
	return strings.ToLower(email[at+1:])
}
