// Package osv is a thin client for the public OSV.dev vulnerability
// database (https://osv.dev/docs/). It is intentionally read-only and
// stateless so the scanner can call it inline during a dependency scan
// without booting a database.
package osv

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// DefaultEndpoint is the OSV.dev query endpoint. Override via
// NewClient if you run your own OSV mirror.
const DefaultEndpoint = "https://api.osv.dev/v1/query"

// Ecosystem is one of OSV's supported ecosystem names.
// See https://ossf.github.io/osv-schema/#ecosystem-field.
type Ecosystem string

const (
	EcoNPM       Ecosystem = "npm"
	EcoPyPI      Ecosystem = "PyPI"
	EcoGo        Ecosystem = "Go"
	EcoMaven     Ecosystem = "Maven"
	EcoCrates    Ecosystem = "crates.io"
	EcoRubyGems  Ecosystem = "RubyGems"
	EcoPackagist Ecosystem = "Packagist"
	EcoNuGet     Ecosystem = "NuGet"
)

// Client queries OSV.dev for known vulnerabilities affecting a
// specific package version.
type Client struct {
	endpoint string
	http     *http.Client
}

// NewClient returns a client pointed at the default endpoint. Pass a
// custom http.Client (e.g. with retries / proxy) when needed.
func NewClient(opts ...Option) *Client {
	c := &Client{
		endpoint: DefaultEndpoint,
		http:     &http.Client{Timeout: 10 * time.Second},
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// Option configures the OSV client.
type Option func(*Client)

// WithEndpoint overrides the OSV query URL. Useful for self-hosted mirrors.
func WithEndpoint(url string) Option { return func(c *Client) { c.endpoint = url } }

// WithHTTPClient swaps the underlying http.Client.
func WithHTTPClient(h *http.Client) Option { return func(c *Client) { c.http = h } }

// Vulnerability is the subset of an OSV record the scanner cares about.
// The full schema has many more fields; we surface only what feeds into
// a PipeWarden finding.
type Vulnerability struct {
	ID       string   `json:"id"`
	Summary  string   `json:"summary,omitempty"`
	Details  string   `json:"details,omitempty"`
	Aliases  []string `json:"aliases,omitempty"`
	Modified string   `json:"modified,omitempty"`
	// Severity is OSV's optional CVSS slot. Empty when OSV has no
	// numeric score for this advisory.
	Severity []Severity `json:"severity,omitempty"`
	// References point to advisories, fixes, or web pages.
	References []Reference `json:"references,omitempty"`
	// Affected carries version range metadata (including fixed versions).
	Affected []Affected `json:"affected,omitempty"`
}

// Affected is an OSV affected-package entry.
type Affected struct {
	Ranges []Range `json:"ranges,omitempty"`
}

// Range is a version range within an affected entry.
type Range struct {
	Events []RangeEvent `json:"events,omitempty"`
}

// RangeEvent marks a boundary in a version range (e.g. fixed version).
type RangeEvent struct {
	Fixed string `json:"fixed,omitempty"`
}

// Severity is an OSV severity entry — typically a CVSS_V3 score string.
type Severity struct {
	Type  string `json:"type"`
	Score string `json:"score"`
}

// Reference is a URL associated with the advisory.
type Reference struct {
	Type string `json:"type,omitempty"`
	URL  string `json:"url"`
}

// Query looks up vulnerabilities for a package version. Returns an
// empty slice when OSV has no record (which is the common path —
// most dependencies are clean).
func (c *Client) Query(
	ctx context.Context,
	ecosystem Ecosystem,
	name string,
	version string,
) ([]Vulnerability, error) {
	if name == "" {
		return nil, errors.New("osv: package name required")
	}
	body := map[string]any{
		"package": map[string]string{
			"ecosystem": string(ecosystem),
			"name":      name,
		},
	}
	if version != "" {
		body["version"] = version
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("osv: marshal: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("osv: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("osv: http: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		excerpt, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("osv: status %d: %s", resp.StatusCode, string(excerpt))
	}
	var out struct {
		Vulns []Vulnerability `json:"vulns"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("osv: decode: %w", err)
	}
	return out.Vulns, nil
}

// HighestSeverity returns the most-severe CVSS string in the slice, or
// the empty string when no severities are present. Useful for tagging
// the resulting PipeWarden finding (critical / high / etc).
func HighestSeverity(vs []Vulnerability) string {
	best := ""
	for _, v := range vs {
		for _, s := range v.Severity {
			if s.Score > best {
				best = s.Score
			}
		}
	}
	return best
}
