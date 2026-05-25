package api

import "os"

// DefaultUpgradeCheckoutURL is the LemonSqueezy-backed checkout link
// rendered in 402 paywall responses when no override is configured.
// Pre-fills the API Starter plan since that's the natural step up
// from the free tier.
const DefaultUpgradeCheckoutURL = "https://amliq.com/billing/checkout?plan=api_starter"

// UpgradeCheckoutURL returns the URL surfaced to free-tier users
// when they hit a 402. Env override (UPGRADE_CHECKOUT_URL) lets
// staging / preview branches point at a non-prod LemonSqueezy URL
// without a code change.
func UpgradeCheckoutURL() string {
	if v := os.Getenv("UPGRADE_CHECKOUT_URL"); v != "" {
		return v
	}
	return DefaultUpgradeCheckoutURL
}
