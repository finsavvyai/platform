package dlp

import (
	"regexp"
	"strings"
)

// piiUKNIRE matches the canonical UK National Insurance number:
// two letters, six digits, one letter (final letter optional in
// some legacy contexts but we require it to keep false positives
// down). Spaces between groups are allowed and common.
var piiUKNIRE = regexp.MustCompile(`\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z] ?\d{2} ?\d{2} ?\d{2} ?[A-D]\b`)

// disallowed prefixes per HMRC: not used for issuance, treat as
// non-NI even if shape matches.
var ukNIBadPrefixes = map[string]bool{
	"BG": true, "GB": true, "KN": true, "NK": true, "NT": true,
	"TN": true, "ZZ": true,
}

// niValid applies HMRC's structural rules. Note: NI numbers don't
// have a checksum digit, so this is shape + prefix-blacklist only.
// Shorter than the BIC validator but the upstream regex is more
// restrictive on letters, which carries most of the precision.
func niValid(s string) bool {
	clean := strings.ToUpper(strings.ReplaceAll(s, " ", ""))
	if len(clean) != 9 {
		return false
	}
	prefix := clean[:2]
	if ukNIBadPrefixes[prefix] {
		return false
	}
	return true
}

// MaskUKNI redacts UK NI numbers to "[UKNI]". HMRC doesn't have an
// established last-N convention so a flat token is cleaner than
// inventing one.
func MaskUKNI(s string) string {
	return piiUKNIRE.ReplaceAllStringFunc(s, func(m string) string {
		if !niValid(m) {
			return m
		}
		return "[UKNI]"
	})
}

// countUKNI is the validator-aware tally for the Counts struct.
func countUKNI(s string) int {
	n := 0
	for _, m := range piiUKNIRE.FindAllString(s, -1) {
		if niValid(m) {
			n++
		}
	}
	return n
}
