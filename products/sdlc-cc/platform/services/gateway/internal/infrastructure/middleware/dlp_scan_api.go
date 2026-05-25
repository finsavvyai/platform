// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Standalone scan entry point exposed to handlers that need DLP
// outside the middleware chain — e.g. the POST /v1/redact endpoint
// used by the privacy-gateway browser extension. Reuses the same
// per-tenant policy lookup, custom patterns, and legal preset
// resolution as the inbound chain so the standalone endpoint and the
// middleware path cannot diverge.

package middleware

import (
	"context"
	"errors"
)

// ScanResult is the outcome of a standalone DLP scan.
type ScanResult struct {
	Rewritten   string
	Matches     []Match
	Action      Action
	Blocked     bool
	BlockReason string
}

// Scan applies the per-tenant DLP policy to text without touching
// any HTTP request/response body. Use this from handlers that need
// to redact prompts directly (e.g. /v1/redact for the browser
// extension). Empty tenant resolves to ActionAllow.
//
// When the resolved action is ActionBlock and detections fire, the
// returned ScanResult has Blocked=true, Rewritten="", and
// BlockReason populated with the detected categories.
//
// When the resolved action is ActionTokenize, Scan falls back to
// ActionRedact for the standalone path — tokenize is a round-trip
// contract that requires the corresponding outbound leg to
// detokenize, and a one-shot scan has no outbound leg.
func (d *DLP) Scan(ctx context.Context, text, tenant string) ScanResult {
	action := d.action(ctx, tenant)
	if action == ActionTokenize {
		action = ActionRedact
	}
	extra := d.extraPatterns(ctx, tenant)
	rewritten, matches, err := d.Detector.ApplyWith(text, action, extra)
	if errors.Is(err, ErrBlocked) {
		return ScanResult{
			Rewritten:   "",
			Matches:     matches,
			Action:      action,
			Blocked:     true,
			BlockReason: joinTypes(matches),
		}
	}
	return ScanResult{
		Rewritten: rewritten,
		Matches:   matches,
		Action:    action,
		Blocked:   false,
	}
}

func joinTypes(matches []Match) string {
	names := typeNames(matches)
	if len(names) == 0 {
		return "policy violation"
	}
	out := names[0]
	for _, n := range names[1:] {
		out += ", " + n
	}
	return out
}
