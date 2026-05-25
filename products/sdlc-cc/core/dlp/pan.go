package dlp

import (
	"regexp"
	"strings"
)

// piiPANRE matches a 13-19 digit run with optional space/dash
// separators every 4 digits. Tighter than \d{13,19} so we don't
// mangle long invoice numbers; Luhn still gates the actual mask.
var piiPANRE = regexp.MustCompile(
	`\b(?:\d[ -]?){12,18}\d\b`)

// luhnValid runs the Luhn (mod-10) check used by every major card
// scheme. Defensive against non-digit input — a regex match should
// always be digits-with-separators, but we strip again here so a
// caller that passes raw text doesn't see a false positive on a
// number containing whitespace.
func luhnValid(s string) bool {
	digits := stripNonDigits(s)
	n := len(digits)
	if n < 13 || n > 19 {
		return false
	}
	sum := 0
	alt := false
	for i := n - 1; i >= 0; i-- {
		d := int(digits[i] - '0')
		if alt {
			d *= 2
			if d > 9 {
				d -= 9
			}
		}
		sum += d
		alt = !alt
	}
	return sum%10 == 0
}

// MaskPAN redacts every Luhn-valid PAN occurrence to last4 form
// ("4111-1111-1111-1111" → "************1111"). Last-four is the
// PCI-DSS-tolerated balance between fraud-investigation utility
// and storage scope: the unmasked digits never persist past the
// log line, but support staff can still tie a complaint to a card.
func MaskPAN(s string) string {
	return piiPANRE.ReplaceAllStringFunc(s, func(m string) string {
		if !luhnValid(m) {
			return m
		}
		digits := stripNonDigits(m)
		return strings.Repeat("*", len(digits)-4) +
			digits[len(digits)-4:]
	})
}
