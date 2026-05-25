package dlp

import "regexp"

// piiBICRE matches ISO 9362 BIC/SWIFT codes: 4 letters (bank) +
// 2 letters (country) + 2 alphanumerics (location) + optional 3
// alphanumerics (branch). 8 or 11 chars total. \b boundaries keep
// us from chewing into adjacent identifiers.
var piiBICRE = regexp.MustCompile(
	`\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b`)

// MaskBIC redacts BIC/SWIFT codes to bank+country only ("DEUTDEFF" →
// "DEUT-DE-XX"). Bank + country preserved because that's what an AML
// analyst needs to assess country risk; the location/branch suffix
// identifies a specific cash-handling office and is the part to redact.
func MaskBIC(s string) string {
	return piiBICRE.ReplaceAllStringFunc(s, func(m string) string {
		if len(m) < 8 {
			return m
		}
		return m[:4] + "-" + m[4:6] + "-XX"
	})
}
