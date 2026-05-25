package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type marketplaceRef struct{ owner, repo, subpath, version string }
type marketplaceInput struct {
	name     string
	required bool
	def      string
}
type marketplaceMeta struct {
	name     string
	inputs   []marketplaceInput
	warnings []string
}

var marketplaceHTTP = &http.Client{Timeout: 10 * time.Second}

// parseMarketplaceRef splits on the last `@`, then runs every part
// through the M-001 validators (cmd_migrate_marketplace_validate.go).
// Rejects traversal, URL-encoded traversal, whitespace, leading-dash,
// slash-in-ref — see the TS mirror in marketplace-action.ts.
func parseMarketplaceRef(s string) (marketplaceRef, error) {
	t := strings.TrimSpace(s)
	if t == "" || strings.ContainsAny(t, " \t\n\r") {
		return marketplaceRef{}, fmt.Errorf("unrecognized action ref %q — expected owner/repo@ref", s)
	}
	at := strings.LastIndexByte(t, '@')
	if at <= 0 || at == len(t)-1 {
		return marketplaceRef{}, fmt.Errorf("unrecognized action ref %q — expected owner/repo@ref", s)
	}
	path, version := t[:at], t[at+1:]
	segs := strings.Split(path, "/")
	if len(segs) < 2 {
		return marketplaceRef{}, fmt.Errorf("unrecognized action ref %q — expected owner/repo@ref", s)
	}
	r := marketplaceRef{owner: segs[0], repo: segs[1], subpath: strings.Join(segs[2:], "/"), version: version}
	if !validateMarketplaceRef(r) {
		return marketplaceRef{}, fmt.Errorf("rejected action ref %q — invalid characters or traversal", s)
	}
	return r, nil
}

// fetchMarketplaceYaml tries action.yml then action.yaml. Re-validates
// every candidate URL with canonicalRawURL before the network call
// fires so a bypass of parseMarketplaceRef can't reach an arbitrary host.
func fetchMarketplaceYaml(ctx context.Context, r marketplaceRef) (string, string, error) {
	for _, name := range []string{"action.yml", "action.yaml"} {
		path := name
		if r.subpath != "" {
			path = r.subpath + "/" + name
		}
		raw := fmt.Sprintf("https://raw.githubusercontent.com/%s/%s/%s/%s", r.owner, r.repo, r.version, path)
		canonical, ok := canonicalRawURL(raw)
		if !ok {
			return "", "", fmt.Errorf("refused non-canonical URL for %s/%s", r.owner, r.repo)
		}
		req, _ := http.NewRequestWithContext(ctx, "GET", canonical, nil)
		res, err := marketplaceHTTP.Do(req)
		if err != nil {
			return "", "", err
		}
		body, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if res.StatusCode == http.StatusOK {
			return string(body), canonical, nil
		}
	}
	return "", "", fmt.Errorf("no action.yml at %s/%s@%s", r.owner, r.repo, r.version)
}
