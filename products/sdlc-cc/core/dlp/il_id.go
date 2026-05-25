package dlp

import "regexp"

// piiILIDRE matches Israeli תעודת זהות (Teudat Zehut): 9 digits, no
// separators. Israeli ID space is shorter than typical PAN matchers,
// so we use \b boundaries and validate via the official mod-10
// checksum to keep false positives low.
var piiILIDRE = regexp.MustCompile(`\b\d{9}\b`)

// ilIDValid runs the Israeli ID checksum: each digit is multiplied
// by alternating 1, 2; if the product > 9, sum its digits; the total
// mod 10 must equal 0. This is the canonical algorithm used by the
// Population & Immigration Authority and every fintech screening
// stack that touches Israeli KYC.
func ilIDValid(s string) bool {
	if len(s) != 9 {
		return false
	}
	sum := 0
	for i := 0; i < 9; i++ {
		d := int(s[i] - '0')
		if d < 0 || d > 9 {
			return false
		}
		d *= (i%2 + 1)
		if d > 9 {
			d -= 9
		}
		sum += d
	}
	return sum%10 == 0
}

// MaskILID redacts every checksum-valid Israeli ID to last-2 form
// ("123456782" → "*******82"). Last-2 is enough for a compliance
// analyst to disambiguate two records during a review without
// learning the full identity.
func MaskILID(s string) string {
	return piiILIDRE.ReplaceAllStringFunc(s, func(m string) string {
		if !ilIDValid(m) {
			return m
		}
		return "*******" + m[7:]
	})
}
