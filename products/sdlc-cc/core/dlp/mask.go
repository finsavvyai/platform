package dlp

import (
	"regexp"
	"strings"
)

// piiEmailRE matches a conservative subset of RFC 5322. Good enough for
// log-line redaction; not a validator. Intentional: a regex used in
// audit pipes must never reject valid input as a hard error.
var piiEmailRE = regexp.MustCompile(
	`([A-Za-z0-9._%+\-]+)@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})`)

// piiPhoneRE matches loose international phone shapes: optional +,
// 8–15 digits, separators tolerated. Designed for redaction, not
// dial-plan validation.
var piiPhoneRE = regexp.MustCompile(
	`\+?\d[\d\s().\-]{6,}\d`)

// MaskEmail rewrites every email occurrence so only the first and
// last char of the local part survive ("john.doe@example.com" →
// "j*****e@example.com"). Domain is preserved so an auditor can
// still see *which provider* sent traffic without learning the user.
func MaskEmail(s string) string {
	return piiEmailRE.ReplaceAllStringFunc(s, func(m string) string {
		i := strings.LastIndex(m, "@")
		if i < 2 {
			return "***@" + m[i+1:]
		}
		local := m[:i]
		domain := m[i+1:]
		return local[:1] + strings.Repeat("*", len(local)-2) +
			local[len(local)-1:] + "@" + domain
	})
}

// MaskPhone replaces every phone-shaped run of digits with the last
// four digits prefixed by '*'. Last-four is the standard balance
// between auditability ("which device flagged?") and privacy.
func MaskPhone(s string) string {
	return piiPhoneRE.ReplaceAllStringFunc(s, func(m string) string {
		digits := stripNonDigits(m)
		if len(digits) < 4 {
			return strings.Repeat("*", len(m))
		}
		return "***" + digits[len(digits)-4:]
	})
}

// MaskPII applies email + phone redaction in one pass. Use this on
// any free-text field about to be persisted in audit_entries or
// emitted to a structured logger.
func MaskPII(s string) string {
	return MaskPhone(MaskEmail(s))
}

func stripNonDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
