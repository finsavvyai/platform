package dlp

import (
	"net"
	"regexp"
)

// piiIPv4RE matches IPv4 in standard dotted-quad form. Length-bound
// in the regex so things like "999.999.999.999" don't pass; net.ParseIP
// at validation time gates the actual numeric range.
var piiIPv4RE = regexp.MustCompile(`\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`)

// piiIPv6RE matches both fully-expanded IPv6 (`a:b:c:d:e:f:g:h`)
// and the compressed `::` form (`2001:db8::1`). net.ParseIP is the
// final truth gate; the regex's job is to short-list candidates
// without false-matching every colon in the document. The leading
// negative-lookbehind would be ideal but Go's RE2 doesn't support
// lookbehinds; the `\b` boundary plus net.ParseIP catches the
// common false-positive cases.
var piiIPv6RE = regexp.MustCompile(`\b(?:[0-9a-fA-F]{1,4}:){1,7}(?::[0-9a-fA-F]{1,4}){1,7}\b|\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b`)

// MaskIP redacts every parseable IP (v4 or v6) to a flat token.
// Earlier versions emitted /24-style partials (203.0.113.x) but the
// resulting digit run tripped the phone regex downstream and got
// double-masked. A flat token is unambiguous in the chain; the
// audit log already records the request's tenant_id so per-IP
// granularity wasn't useful anyway.
//
// GDPR-aligned regardless: full IPs never persist past the gateway.
func MaskIP(s string) string {
	s = piiIPv4RE.ReplaceAllStringFunc(s, func(m string) string {
		if ip := net.ParseIP(m); ip != nil && ip.To4() != nil {
			return "[IPv4]"
		}
		return m
	})
	s = piiIPv6RE.ReplaceAllStringFunc(s, func(m string) string {
		if ip := net.ParseIP(m); ip != nil && ip.To4() == nil {
			return "[IPv6]"
		}
		return m
	})
	return s
}

// countIPs reports how many IPs (v4+v6) the masker would redact.
// Used by Counts to populate the IP field without re-scanning the
// masked output.
func countIPs(s string) int {
	n := 0
	for _, m := range piiIPv4RE.FindAllString(s, -1) {
		if ip := net.ParseIP(m); ip != nil && ip.To4() != nil {
			n++
		}
	}
	for _, m := range piiIPv6RE.FindAllString(s, -1) {
		if ip := net.ParseIP(m); ip != nil && ip.To4() == nil {
			n++
		}
	}
	return n
}
