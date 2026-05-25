// Package entitlement calls the PushCI API to check whether the signed-in
// user's plan covers a given feature. Used by commands that gate on paid
// tiers (pushci extend, pushci schedule, ...).
package entitlement

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"
)

const defaultAPIBase = "https://api.pushci.dev"

// Result mirrors api/src/entitlements.ts EntitlementResult.
type Result struct {
	Plan       string `json:"plan"`
	Feature    string `json:"feature"`
	Allowed    bool   `json:"allowed"`
	Used       int    `json:"used"`
	UpgradeTo  string `json:"upgrade_to,omitempty"`
	UpgradeURL string `json:"upgrade_url,omitempty"`
}

// Check asks the API whether the authenticated user can use feature. When
// token is empty the caller is treated as Free and feature is denied unless
// it's a freely available one.
func Check(ctx context.Context, token, feature string) (*Result, error) {
	if _, ok := validFeatures[feature]; !ok {
		return nil, fmt.Errorf("unknown feature %q", feature)
	}
	base := os.Getenv("PUSHCI_API_URL")
	if base == "" {
		base = defaultAPIBase
	}
	baseURL, err := url.Parse(base)
	if err != nil || (baseURL.Scheme != "http" && baseURL.Scheme != "https") || baseURL.Host == "" {
		return nil, fmt.Errorf("invalid PUSHCI_API_URL %q", base)
	}
	endpoint := baseURL.JoinPath("/api/me/entitlements/", feature).String()
	// #nosec G704 -- endpoint scheme/host validated above; feature in allowlist
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	cli := &http.Client{Timeout: 10 * time.Second}
	// #nosec G704 -- request URL validated above; no user-controlled body
	resp, err := cli.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized {
		return &Result{Plan: "free", Feature: feature, Allowed: false, UpgradeTo: "pro", UpgradeURL: "https://app.pushci.dev/billing"}, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("entitlement check: status %d", resp.StatusCode)
	}
	var r Result
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return nil, err
	}
	return &r, nil
}

// RequireErr returns a user-facing error when r denies the feature, or nil
// when access is granted. Safe to surface directly at the CLI.
func RequireErr(r *Result) error {
	if r == nil {
		return fmt.Errorf("entitlement check failed: nil result")
	}
	if r.Allowed {
		return nil
	}
	msg := fmt.Sprintf("this feature is not available on the %s plan", r.Plan)
	if r.UpgradeTo != "" {
		msg += fmt.Sprintf(" — upgrade to %s at %s", r.UpgradeTo, r.UpgradeURL)
	}
	return fmt.Errorf("%s", msg)
}
