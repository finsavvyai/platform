// Package halludep verifies that newly-introduced package dependencies
// actually exist on their upstream registry.
//
// Hallucinated dependencies are the AI-coding-era successor to
// typosquatting: an LLM invents a plausible-looking package name
// (`lodahs` for `lodash`, `requestz` for `requests`) and a developer
// copy-pastes it into package.json / requirements.txt / go.mod. When
// an attacker later registers that name with malicious code, every
// install pulls it.
//
// This package is intentionally registry-API-only: HEAD checks against
// each registry's metadata endpoint. No code is downloaded.
package halludep

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Ecosystem is the package ecosystem being checked.
type Ecosystem string

const (
	EcoNPM   Ecosystem = "npm"
	EcoPyPI  Ecosystem = "pypi"
	EcoGo    Ecosystem = "go"
	EcoCargo Ecosystem = "cargo"
)

// Result reports whether a single dependency exists upstream.
type Result struct {
	Ecosystem Ecosystem
	Name      string
	Exists    bool
	// Status is the HTTP status code observed on the registry probe.
	// Useful for triage when Exists=false (404 → likely hallucinated;
	// 5xx → registry transient, retry; 401 → private package, not a
	// hallucination).
	Status int
	// Error is non-nil only on transport-level failures (DNS, TLS,
	// timeout). A 404 from the registry is encoded as Exists=false
	// with Error=nil so callers can distinguish "doesn't exist" from
	// "couldn't ask".
	Error error
}

// Checker probes registries. Construct with NewChecker; the zero value
// is not ready to use because it has no http.Client.
type Checker struct {
	http *http.Client
}

// NewChecker returns a Checker with a 10s HTTP timeout. Pass options
// to override (e.g. for tests with a stub).
func NewChecker(opts ...Option) *Checker {
	c := &Checker{
		http: &http.Client{Timeout: 10 * time.Second},
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// Option configures the Checker.
type Option func(*Checker)

// WithHTTPClient overrides the underlying http.Client. Used in tests
// to point the Checker at an httptest.Server.
func WithHTTPClient(h *http.Client) Option { return func(c *Checker) { c.http = h } }

// Check probes a single package. Always returns a non-nil Result; the
// caller inspects Exists and Error to decide what to do.
func (c *Checker) Check(ctx context.Context, eco Ecosystem, name string) Result {
	r := Result{Ecosystem: eco, Name: name}
	name = strings.TrimSpace(name)
	if name == "" {
		r.Error = errors.New("halludep: package name required")
		return r
	}
	endpoint, err := registryURL(eco, name)
	if err != nil {
		r.Error = err
		return r
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		r.Error = fmt.Errorf("halludep: build request: %w", err)
		return r
	}
	req.Header.Set("Accept", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		r.Error = fmt.Errorf("halludep: %s: %w", eco, err)
		return r
	}
	defer func() { _ = resp.Body.Close() }()
	r.Status = resp.StatusCode
	r.Exists = resp.StatusCode >= 200 && resp.StatusCode < 300
	return r
}

// CheckMany runs Check for each (eco,name) pair concurrently and
// returns results in the order they were requested. Bounded by the
// http.Client's connection pool — no extra goroutine throttling.
func (c *Checker) CheckMany(ctx context.Context, items []Item) []Result {
	out := make([]Result, len(items))
	type done struct {
		i int
		r Result
	}
	ch := make(chan done, len(items))
	for i, it := range items {
		go func(i int, it Item) {
			ch <- done{i: i, r: c.Check(ctx, it.Ecosystem, it.Name)}
		}(i, it)
	}
	for range items {
		d := <-ch
		out[d.i] = d.r
	}
	return out
}

// Item is one (ecosystem, name) pair for CheckMany.
type Item struct {
	Ecosystem Ecosystem
	Name      string
}

// IsHallucinated is a convenience for "the registry said 404 and we
// got a clean response". 5xx / network errors are treated as unknown,
// not hallucinated, so the caller does not raise a false-positive
// finding during a registry outage.
func IsHallucinated(r Result) bool {
	return r.Error == nil && r.Status == http.StatusNotFound
}

func registryURL(eco Ecosystem, name string) (string, error) {
	switch eco {
	case EcoNPM:
		// npm package names can contain @scope/, which must stay
		// unescaped beyond the leading @. Use PathEscape on the
		// pieces.
		if strings.HasPrefix(name, "@") {
			parts := strings.SplitN(name, "/", 2)
			if len(parts) != 2 {
				return "", fmt.Errorf("halludep: malformed npm scoped name: %q", name)
			}
			scope := url.PathEscape(parts[0])
			pkg := url.PathEscape(parts[1])
			return "https://registry.npmjs.org/" + scope + "/" + pkg, nil
		}
		return "https://registry.npmjs.org/" + url.PathEscape(name), nil
	case EcoPyPI:
		return "https://pypi.org/pypi/" + url.PathEscape(name) + "/json", nil
	case EcoGo:
		// Go module proxy: latest version metadata is at
		// proxy.golang.org/<module>/@latest
		return "https://proxy.golang.org/" + name + "/@latest", nil
	case EcoCargo:
		return "https://crates.io/api/v1/crates/" + url.PathEscape(name), nil
	default:
		return "", fmt.Errorf("halludep: unsupported ecosystem %q", eco)
	}
}
