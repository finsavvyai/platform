package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

const sampleActionYaml = `name: 'Setup Node.js'
description: 'Install Node.js and optionally cache npm dependencies.'
inputs:
  node-version:
    description: 'Version spec of the node to install'
    required: false
    default: '20'
  cache:
    description: 'package manager cache'
    required: false
  always-auth:
    description: 'force auth'
    required: true
runs:
  using: 'node20'
`

func TestParseMarketplaceRef(t *testing.T) {
	cases := []struct {
		in                            string
		owner, repo, subpath, version string
		wantErr                       bool
	}{
		{"actions/setup-node@v4", "actions", "setup-node", "", "v4", false},
		{"actions/cache/save@v4", "actions", "cache", "save", "v4", false},
		{"actions/checkout@a5ac7e5", "actions", "checkout", "", "a5ac7e5", false},
		{"not-a-ref", "", "", "", "", true},
		{"", "", "", "", "", true},
	}
	for _, c := range cases {
		got, err := parseMarketplaceRef(c.in)
		if (err != nil) != c.wantErr {
			t.Fatalf("parseMarketplaceRef(%q) err=%v wantErr=%v", c.in, err, c.wantErr)
		}
		if c.wantErr {
			continue
		}
		if got.owner != c.owner || got.repo != c.repo || got.subpath != c.subpath || got.version != c.version {
			t.Errorf("parseMarketplaceRef(%q) = %+v, want owner=%s repo=%s subpath=%s version=%s", c.in, got, c.owner, c.repo, c.subpath, c.version)
		}
	}
}

func TestParseMarketplaceYaml(t *testing.T) {
	meta := parseMarketplaceYaml(sampleActionYaml)
	if meta.name != "Setup Node.js" {
		t.Errorf("name = %q, want Setup Node.js", meta.name)
	}
	if len(meta.inputs) != 3 {
		t.Fatalf("inputs count = %d, want 3", len(meta.inputs))
	}
	var nodeVersion, alwaysAuth *marketplaceInput
	for i := range meta.inputs {
		if meta.inputs[i].name == "node-version" {
			nodeVersion = &meta.inputs[i]
		}
		if meta.inputs[i].name == "always-auth" {
			alwaysAuth = &meta.inputs[i]
		}
	}
	if nodeVersion == nil || nodeVersion.def != "20" || nodeVersion.required {
		t.Errorf("node-version = %+v, want default=20 required=false", nodeVersion)
	}
	if alwaysAuth == nil || !alwaysAuth.required {
		t.Errorf("always-auth should be required")
	}
}

func TestParseMarketplaceYaml_EmptyInputsWarns(t *testing.T) {
	meta := parseMarketplaceYaml("name: 'x'\ndescription: 'y'\n")
	if len(meta.warnings) == 0 {
		t.Error("expected warning for action with no inputs")
	}
}

// TestFetchMarketplaceYaml_FromFixtureServer spins up a local HTTP
// server that mimics raw.githubusercontent.com and verifies the CLI
// can resolve + render a complete pushci stage end-to-end.
func TestFetchMarketplaceYaml_FromFixtureServer(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/action.yml") {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(sampleActionYaml))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	// Point the module-level client at our test server by rewriting
	// its Transport — the fetcher constructs full URLs against
	// raw.githubusercontent.com; intercept them here.
	u, _ := url.Parse(srv.URL)
	orig := marketplaceHTTP.Transport
	marketplaceHTTP.Transport = &rewriteTransport{host: u.Host, scheme: u.Scheme}
	defer func() { marketplaceHTTP.Transport = orig }()

	ref, err := parseMarketplaceRef("actions/setup-node@v4")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	yaml, gotURL, err := fetchMarketplaceYaml(context.Background(), ref)
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if !strings.Contains(yaml, "Setup Node.js") {
		t.Errorf("yaml missing expected content: %q", yaml)
	}
	if !strings.Contains(gotURL, "action.yml") {
		t.Errorf("gotURL = %q, want contains action.yml", gotURL)
	}

	meta := parseMarketplaceYaml(yaml)
	stage := renderMarketplaceStage(ref, meta.name, map[string]string{"node-version": "20"})
	if !strings.Contains(stage, "uses: actions/setup-node@v4") {
		t.Errorf("stage missing uses:\n%s", stage)
	}
	if !strings.Contains(stage, "node-version: '20'") {
		t.Errorf("stage missing input:\n%s", stage)
	}
}

type rewriteTransport struct {
	host, scheme string
}

func (t *rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req.URL.Host = t.host
	req.URL.Scheme = t.scheme
	return http.DefaultTransport.RoundTrip(req)
}

func TestMergeInputDefaults(t *testing.T) {
	inputs := []marketplaceInput{
		{name: "node-version", def: "20"},
		{name: "cache"},
		{name: "always-auth", required: true},
	}
	got := mergeInputDefaults(inputs, map[string]string{"cache": "npm"})
	if got["node-version"] != "20" {
		t.Errorf("expected default node-version=20, got %q", got["node-version"])
	}
	if got["cache"] != "npm" {
		t.Errorf("expected supplied cache=npm, got %q", got["cache"])
	}
	if _, present := got["always-auth"]; present {
		t.Errorf("required input with no default should be omitted, got %q", got["always-auth"])
	}
}

func TestRenderMarketplaceStage_NoInputs(t *testing.T) {
	stage := renderMarketplaceStage(
		marketplaceRef{owner: "actions", repo: "checkout", version: "v4"},
		"Checkout", map[string]string{},
	)
	if strings.Contains(stage, "with:") {
		t.Errorf("stage should not contain with: when no values:\n%s", stage)
	}
}

// TestParseMarketplaceRef_M001 locks in rejection of every path-traversal
// variant enumerated in the v1.6.6 audit. Positive controls verify that
// standard refs still parse cleanly.
func TestParseMarketplaceRef_M001(t *testing.T) {
	good := []string{
		"actions/checkout@v4",
		"actions/setup-node@v4.0.1",
		"actions/cache/save@v4",
		"a/b@v1",
		"actions/checkout@a5ac7e51b41094c92402da3b24376905380afc29",
	}
	for _, in := range good {
		if _, err := parseMarketplaceRef(in); err != nil {
			t.Errorf("good ref %q rejected: %v", in, err)
		}
	}
	bad := []string{
		"actions/checkout@../../evil/main",
		"actions/checkout@..%2Fevil",
		"actions/checkout@%2e%2e%2fevil",
		"actions/../../evil@v4",
		"actions/checkout@v4 && curl attacker.com",
		"actions/checkout@-rf",
		"actions/checkout@main/branch",
		"./actions@v4",
		"",
		"аctions/checkout@v4", // cyrillic а (U+0430)
	}
	for _, in := range bad {
		if _, err := parseMarketplaceRef(in); err == nil {
			t.Errorf("attack ref %q was accepted — should be rejected", in)
		}
	}
}

func TestCanonicalRawURL(t *testing.T) {
	ok := []string{
		"https://raw.githubusercontent.com/actions/checkout/v4/action.yml",
		"https://raw.githubusercontent.com/a/b/v1/nested/x.yml",
	}
	for _, u := range ok {
		if out, got := canonicalRawURL(u); !got || out != u {
			t.Errorf("good url %q -> (%q,%v), want unchanged, ok=true", u, out, got)
		}
	}
	bad := []string{
		"http://raw.githubusercontent.com/a/b/v1/x.yml",       // scheme
		"https://evil.com/a/b/v1/x.yml",                       // host
		"https://raw.githubusercontent.com/a/b/../c/x.yml",    // /../ traversal
		"https://raw.githubusercontent.com//a/b/v1/x.yml",     // //
		"https://raw.githubusercontent.com/a/b/./c/x.yml",     // /./
		"https://raw.githubusercontent.com/a/b/v1/x.yml?x=1",  // query
		"https://raw.githubusercontent.com/a/b/v1/x.yml#frag", // fragment
		"https://raw.githubusercontent.com/a/b/%2e%2e/x.yml",  // encoded traversal
		"https://raw.githubusercontent.com/a/b v1/x.yml",      // whitespace
	}
	for _, u := range bad {
		if _, got := canonicalRawURL(u); got {
			t.Errorf("bad url %q was accepted", u)
		}
	}
}

func TestValidators(t *testing.T) {
	// owner
	for _, ok := range []string{"a", "finsavvyai", "my-org-123"} {
		if !validateOwner(ok) {
			t.Errorf("validateOwner(%q) = false, want true", ok)
		}
	}
	for _, bad := range []string{"", "..", "-lead", "trail-", "a/b", "a..b"} {
		if validateOwner(bad) {
			t.Errorf("validateOwner(%q) = true, want false", bad)
		}
	}
	// ref
	for _, ok := range []string{"v4", "v4.0.1", "a5ac7e5", "release_2024"} {
		if !validateRef(ok) {
			t.Errorf("validateRef(%q) = false, want true", ok)
		}
	}
	for _, bad := range []string{"", "..", "v..x", "v4/x", "-rf", "v 4", "%2e%2e"} {
		if validateRef(bad) {
			t.Errorf("validateRef(%q) = true, want false", bad)
		}
	}
	// subpath
	for _, ok := range []string{"", "save", "a/b/c"} {
		if !validateSubpath(ok) {
			t.Errorf("validateSubpath(%q) = false, want true", ok)
		}
	}
	for _, bad := range []string{"..", "save/../evil", "a//b", "/save"} {
		if validateSubpath(bad) {
			t.Errorf("validateSubpath(%q) = true, want false", bad)
		}
	}
}

func TestMarketplaceCacheKey(t *testing.T) {
	a := marketplaceCacheKey("https://raw.githubusercontent.com/a/b/v1/action.yml")
	b := marketplaceCacheKey("https://raw.githubusercontent.com/a/b/v1/action.yml")
	if a != b {
		t.Errorf("cache key not stable: %q vs %q", a, b)
	}
	if len(a) != 64 {
		t.Errorf("cache key len = %d, want 64 (sha256 hex)", len(a))
	}
	c := marketplaceCacheKey("https://raw.githubusercontent.com/evil/b/v1/action.yml")
	if a == c {
		t.Errorf("cache keys collide across different URLs")
	}
}
