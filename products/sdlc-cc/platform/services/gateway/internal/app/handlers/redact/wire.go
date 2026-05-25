// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Wire adapter from the middleware.(*DLP).Scan method (which uses
// the middleware package's own ScanResult / Match types) to the
// handler-package Scanner interface. Kept in a dedicated file so
// handler.go and handler_test.go don't import the middleware
// package.

package redact

import (
	"context"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/middleware"
)

// FromDLP wraps a *middleware.DLP so it satisfies Scanner. Returns
// nil when dlp is nil so the wiring layer can pass that nil straight
// to Handler (which 503s with "scanner not configured").
func FromDLP(dlp *middleware.DLP) Scanner {
	if dlp == nil {
		return nil
	}
	return dlpAdapter{dlp: dlp}
}

type dlpAdapter struct {
	dlp *middleware.DLP
}

func (a dlpAdapter) Scan(ctx context.Context, text, tenant string) ScanResult {
	res := a.dlp.Scan(ctx, text, tenant)
	dets := make([]Detection, 0, len(res.Matches))
	for _, m := range res.Matches {
		dets = append(dets, Detection{
			Type:   m.Type,
			Preset: presetOf(m.Type),
			Action: string(res.Action),
			Start:  m.Start,
			End:    m.End,
		})
	}
	return ScanResult{
		Rewritten:   res.Rewritten,
		Matches:     dets,
		Action:      string(res.Action),
		Blocked:     res.Blocked,
		BlockReason: res.BlockReason,
	}
}

// presetOf maps the detector's match type to the logical preset the
// match came from. The detector itself doesn't tag matches with a
// preset, so this is a best-effort categorisation for API clients
// (browser extension UI uses it for the per-preset toggle).
func presetOf(matchType string) string {
	switch matchType {
	case "ssn", "credit_card", "itin", "mrn", "email", "account_number":
		return "pii_default"
	case "aws_access_key", "aws_secret_key", "github_token", "openai_key",
		"anthropic_key", "stripe_key", "gcp_key", "azure_key", "jwt",
		"private_key", "generic_api_key", "slack_token":
		return "secrets"
	case "privilege_marker", "work_product", "docket_number", "case_number",
		"client_identifier", "nda_marker":
		return "legal"
	case "iban", "bic", "pan", "israeli_id", "aba_routing":
		return "finance"
	case "icd10", "phi_marker", "npi", "dea":
		return "healthcare"
	default:
		return "custom"
	}
}
