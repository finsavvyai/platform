package dlp

import (
	"regexp"
	"strconv"
	"strings"
)

// piiSSNRE matches the conventional US SSN shape: NNN-NN-NNNN with
// optional spaces, hyphens, or no separators (`123456789` also
// matches). Word-boundary anchors prevent matching the middle of a
// longer digit run (e.g. a credit-card number's 9-digit sub-string).
var piiSSNRE = regexp.MustCompile(`\b(\d{3}[- ]?\d{2}[- ]?\d{4})\b`)

// ssnValid runs SSA's documented invalid-issuance rules:
//
//	area     != "000", "666", and not in 900-999 (ITINs / never issued)
//	group    != "00"
//	serial   != "0000"
//
// These are the canonical SSA structure rules; the SSA's
// post-2011-randomisation policy means we can't go further (no
// state-by-area lookup), but rejecting these knocks out the bulk of
// false positives from random nine-digit runs.
func ssnValid(s string) bool {
	digits := stripNonDigits(s)
	if len(digits) != 9 {
		return false
	}
	area, _ := strconv.Atoi(digits[:3])
	group := digits[3:5]
	serial := digits[5:9]
	if area == 0 || area == 666 || area >= 900 {
		return false
	}
	if group == "00" {
		return false
	}
	if serial == "0000" {
		return false
	}
	return true
}

// MaskSSN redacts every SSA-valid SSN occurrence to last4 form
// ("***-**-1234"). Last-four matches the IRS's own redaction
// convention so support staff can still cross-reference without
// the unmasked digits persisting past the log line.
func MaskSSN(s string) string {
	return piiSSNRE.ReplaceAllStringFunc(s, func(m string) string {
		if !ssnValid(m) {
			return m
		}
		digits := stripNonDigits(m)
		return "***-**-" + digits[len(digits)-4:]
	})
}

// SSNLast4 is exposed for callers that want the redacted token
// shape directly (e.g. building synthetic test fixtures).
func SSNLast4(s string) string {
	digits := stripNonDigits(s)
	if len(digits) < 4 {
		return s
	}
	return "***-**-" + digits[len(digits)-4:]
}

// stripWhitespace is internal — used by the test suite to normalise
// formatted inputs before validation calls. Kept tight to avoid
// blurring with the broader strings.TrimSpace semantics.
func stripWhitespace(s string) string {
	return strings.NewReplacer(" ", "", "-", "").Replace(s)
}
