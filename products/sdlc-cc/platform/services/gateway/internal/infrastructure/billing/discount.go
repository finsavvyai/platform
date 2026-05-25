// Volume discount tier model + the pure applyDiscount function.
//
// Tiers are evaluated against the SUBTOTAL (in USD cents) of an
// invoice. The HIGHEST tier whose threshold is <= subtotal wins;
// only one tier applies per invoice.
//
// Day 31 of the production-ready roadmap.
package billing

import (
	"sort"

	"github.com/google/uuid"
)

// Tier is one volume-discount step on a contract.
type Tier struct {
	ID                uuid.UUID
	ContractID        uuid.UUID
	ThresholdUSDCents int64 // inclusive lower bound that triggers this tier
	DiscountPct       int   // 0..100; whole percentage points
}

// applyDiscount is a pure function: given a subtotal in cents and a
// list of tiers, return the discounted total (also in cents).
//
// Rules:
//   - Tiers with ThresholdUSDCents <= subtotal qualify.
//   - The qualifying tier with the LARGEST threshold wins (highest
//     volume = best discount).
//   - DiscountPct outside [0,100] is clamped before being applied so
//     a misconfigured tier cannot produce a negative or absurd total.
//   - Result is rounded toward zero (integer cents).
func applyDiscount(usdCents int64, tiers []Tier) int64 {
	total, _ := applyDiscountWithTier(usdCents, tiers)
	return total
}

// applyDiscountWithTier returns the discounted total AND the tier that
// produced it (nil when no tier qualified).
func applyDiscountWithTier(usdCents int64, tiers []Tier) (int64, *Tier) {
	if usdCents <= 0 || len(tiers) == 0 {
		return usdCents, nil
	}
	// Sort a copy so we don't mutate caller's slice.
	sorted := make([]Tier, len(tiers))
	copy(sorted, tiers)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].ThresholdUSDCents > sorted[j].ThresholdUSDCents
	})
	for i := range sorted {
		t := sorted[i]
		if t.ThresholdUSDCents <= usdCents {
			pct := clampPct(t.DiscountPct)
			discount := (usdCents * int64(pct)) / 100
			return usdCents - discount, &t
		}
	}
	return usdCents, nil
}

func clampPct(p int) int {
	if p < 0 {
		return 0
	}
	if p > 100 {
		return 100
	}
	return p
}
