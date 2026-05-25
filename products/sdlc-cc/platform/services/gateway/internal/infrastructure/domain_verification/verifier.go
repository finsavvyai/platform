// Package domain_verification verifies tenant-claimed domains via DNS
// TXT record OR HTTP `.well-known/sdlc-cc-verification`. Once
// verified, logins for that domain auto-redirect to the tenant SSO.
//
// Day 25 of the production-ready roadmap.
package domain_verification

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

// VerifyMethod is one of the two supported verification mechanisms.
type VerifyMethod string

const (
	MethodDNS  VerifyMethod = "dns"
	MethodHTTP VerifyMethod = "http"
)

// Token is the random string the tenant publishes. We expect to see
// either `sdlc-cc-verification=<token>` in a DNS TXT or the raw token
// at the well-known HTTP path.
type Token string

// Resolver abstracts net.LookupTXT so tests don't hit real DNS.
type Resolver interface {
	LookupTXT(ctx context.Context, name string) ([]string, error)
}

type netResolver struct{}

func (netResolver) LookupTXT(ctx context.Context, name string) ([]string, error) {
	return net.DefaultResolver.LookupTXT(ctx, name)
}

// HTTPClient abstracts http.Get so tests don't hit the live internet.
type HTTPClient interface {
	Get(ctx context.Context, url string) ([]byte, int, error)
}

type netHTTPClient struct{ c *http.Client }

func (n netHTTPClient) Get(ctx context.Context, url string) ([]byte, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	resp, err := n.c.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return nil, resp.StatusCode, err
	}
	return body, resp.StatusCode, nil
}

// Verifier wraps the resolver + HTTP client.
type Verifier struct {
	Res    Resolver
	HTTP   HTTPClient
	Now    func() time.Time
	Window time.Duration
}

// NewVerifier with sensible defaults.
func NewVerifier() *Verifier {
	return &Verifier{
		Res:    netResolver{},
		HTTP:   netHTTPClient{c: &http.Client{Timeout: 5 * time.Second}},
		Now:    time.Now,
		Window: 90 * 24 * time.Hour, // re-verify quarterly
	}
}

// Verify checks the token via the requested method. Returns nil on
// success; ErrTokenNotFound when the record doesn't carry the token;
// other errors for network / DNS failures.
func (v *Verifier) Verify(ctx context.Context, method VerifyMethod, domain string, token Token) error {
	switch method {
	case MethodDNS:
		return v.verifyDNS(ctx, domain, token)
	case MethodHTTP:
		return v.verifyHTTP(ctx, domain, token)
	default:
		return fmt.Errorf("domain_verification: unknown method %q", method)
	}
}

func (v *Verifier) verifyDNS(ctx context.Context, domain string, token Token) error {
	records, err := v.Res.LookupTXT(ctx, domain)
	if err != nil {
		return err
	}
	want := "sdlc-cc-verification=" + string(token)
	for _, r := range records {
		if strings.TrimSpace(r) == want {
			return nil
		}
	}
	return ErrTokenNotFound
}

func (v *Verifier) verifyHTTP(ctx context.Context, domain string, token Token) error {
	url := "https://" + domain + "/.well-known/sdlc-cc-verification"
	body, status, err := v.HTTP.Get(ctx, url)
	if err != nil {
		return err
	}
	if status != http.StatusOK {
		return fmt.Errorf("domain_verification: %s -> %d", url, status)
	}
	if strings.TrimSpace(string(body)) != string(token) {
		return ErrTokenNotFound
	}
	return nil
}

// ErrTokenNotFound signals the resource was reachable but did not
// contain the expected token.
var ErrTokenNotFound = errors.New("domain_verification: token not found")
