// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Optional capabilities a PolicyLookup may implement so that
// finance + healthcare DLP presets can be enabled per tenant. The
// legal preset uses the same shape — declared in dlp_middleware.go
// for historical reasons. Kept in a separate file from the main
// middleware to honour the portfolio 200-line cap.

package middleware

import "context"

// FinancePresetLookup is an optional capability a PolicyLookup may
// implement. When present and the per-tenant boolean is true, the
// middleware appends the finance-vertical preset (IBAN / BIC /
// Israeli-ID / aba_routing) to the pattern set. See dlp_finance.go
// for the preset itself. Activated by migration 033.
type FinancePresetLookup interface {
	FinancePreset(ctx context.Context, tenantID string) (bool, error)
}

// HealthcarePresetLookup is an optional capability a PolicyLookup
// may implement. When present and the per-tenant boolean is true,
// the middleware appends the healthcare-vertical preset (NPI / DEA
// / ICD-10 / PHI marker) to the pattern set. See
// dlp_healthcare.go for the preset itself. Activated by migration
// 033.
type HealthcarePresetLookup interface {
	HealthcarePreset(ctx context.Context, tenantID string) (bool, error)
}

// financePatterns returns the finance-vertical preset when the
// PolicyLookup implements FinancePresetLookup and the tenant has
// opted in. nil result = preset off or capability absent. Mirrors
// (*DLP).legalPatterns.
func (d *DLP) financePatterns(ctx context.Context, tenant string) []pattern {
	if d.Policy == nil || tenant == "" {
		return nil
	}
	fp, ok := d.Policy.(FinancePresetLookup)
	if !ok {
		return nil
	}
	on, err := fp.FinancePreset(ctx, tenant)
	if err != nil || !on {
		return nil
	}
	return FinancePatterns()
}

// healthcarePatterns returns the healthcare-vertical preset when
// the PolicyLookup implements HealthcarePresetLookup and the
// tenant has opted in. nil result = preset off or capability
// absent.
func (d *DLP) healthcarePatterns(ctx context.Context, tenant string) []pattern {
	if d.Policy == nil || tenant == "" {
		return nil
	}
	hp, ok := d.Policy.(HealthcarePresetLookup)
	if !ok {
		return nil
	}
	on, err := hp.HealthcarePreset(ctx, tenant)
	if err != nil || !on {
		return nil
	}
	return HealthcarePatterns()
}
