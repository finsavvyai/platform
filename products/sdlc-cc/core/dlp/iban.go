package dlp

import (
	"math/big"
	"regexp"
	"strings"
)

// piiIBANRE matches the IBAN shape: 2 letters + 2 digits + 11-30
// alphanumerics. Spaces are tolerated (most printed IBANs are
// space-separated every 4 chars) and stripped before mod-97.
var piiIBANRE = regexp.MustCompile(
	`\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b`)

// ibanValid runs the ISO 13616 mod-97 check. It rearranges the
// IBAN (move first 4 chars to the end), converts letters to digits
// (A=10..Z=35), then asserts the resulting big-int mod 97 == 1.
// Pure stdlib, no external dep.
func ibanValid(s string) bool {
	clean := strings.ToUpper(strings.ReplaceAll(s, " ", ""))
	if len(clean) < 15 || len(clean) > 34 {
		return false
	}
	rearranged := clean[4:] + clean[:4]
	var b strings.Builder
	for _, r := range rearranged {
		switch {
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r >= 'A' && r <= 'Z':
			n := int(r-'A') + 10
			if n < 10 || n > 35 {
				return false
			}
			b.WriteString(itoa2(n))
		default:
			return false
		}
	}
	bi, ok := new(big.Int).SetString(b.String(), 10)
	if !ok {
		return false
	}
	return new(big.Int).Mod(bi, big.NewInt(97)).Int64() == 1
}

// itoa2 returns "10".."35" without strconv to keep this file
// self-contained.
func itoa2(n int) string {
	return string(rune('0'+n/10)) + string(rune('0'+n%10))
}

// MaskIBAN redacts every mod-97-valid IBAN to country+check digits +
// asterisks + last 4. ("DE89 3704 0044 0532 0130 00" → "DE89****0000")
// Country prefix preserved so cross-border investigators still see
// "this was a German account" without the BBAN.
func MaskIBAN(s string) string {
	return piiIBANRE.ReplaceAllStringFunc(s, func(m string) string {
		if !ibanValid(m) {
			return m
		}
		clean := strings.ReplaceAll(m, " ", "")
		return clean[:4] + "****" + clean[len(clean)-4:]
	})
}
