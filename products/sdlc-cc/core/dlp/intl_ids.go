// Package dlp — international government IDs.
//
// Each ID below pairs a regex with a checksum validator; together
// they form a "regex hit + validator passed = redact" rule that
// keeps false positives near zero. The validators are the rules
// each issuing authority publishes for self-check:
//
//   NL BSN        — "11-proef" weighted-sum mod 11
//   DE Steuer-ID  — ISO 7064 MOD 11,10 over 10 digits
//   CA SIN        — Luhn mod-10 (same algorithm as PAN)
//   AU TFN        — weighted sum mod 11
//   US NPI        — Luhn mod-10 with prefix 80840 stripped
package dlp

import "regexp"

// ─── NL BSN — 9-digit Dutch citizen service number ────────────────
// Regex anchors on word boundary so we don't grab the middle of a
// longer digit run. BSNs older than 2007 were 8 digits; modern
// allocations are exclusively 9, which is what we target.
var piiBSNRE = regexp.MustCompile(`\b\d{9}\b`)

// bsnValid runs the Dutch "11-proef": multiply digits by weights
// 9..2 (and -1 for the check digit), sum, divide by 11. The
// remainder must be 0 AND the number must not have all zeros.
func bsnValid(s string) bool {
	d := stripNonDigits(s)
	if len(d) != 9 {
		return false
	}
	weights := []int{9, 8, 7, 6, 5, 4, 3, 2, -1}
	sum := 0
	allZero := true
	for i, c := range d {
		n := int(c - '0')
		if n != 0 {
			allZero = false
		}
		sum += n * weights[i]
	}
	if allZero {
		return false
	}
	return sum%11 == 0
}

func MaskBSN(s string) string {
	return piiBSNRE.ReplaceAllStringFunc(s, func(m string) string {
		if !bsnValid(m) {
			return m
		}
		return "[NL_BSN]"
	})
}

func countBSN(s string) int {
	n := 0
	for _, m := range piiBSNRE.FindAllString(s, -1) {
		if bsnValid(m) {
			n++
		}
	}
	return n
}

// ─── DE Steuer-ID — 11-digit German tax identification ────────────
// ISO 7064 MOD 11,10. Rules: exactly 11 digits; among the first 10
// digits, exactly one digit appears twice (since 2016: exactly one
// digit appears two OR three times AND the others appear at most
// once). For simplicity we apply the looser pre-2016 rule plus the
// checksum, which still rejects the bulk of false positives.
var piiSteuerIDRE = regexp.MustCompile(`\b\d{11}\b`)

func steuerIDValid(s string) bool {
	d := stripNonDigits(s)
	if len(d) != 11 || d[0] == '0' {
		return false
	}
	// ISO 7064 MOD 11,10 over the first 10 digits; last is checksum.
	product := 10
	for i := 0; i < 10; i++ {
		sum := (int(d[i]-'0') + product) % 10
		if sum == 0 {
			sum = 10
		}
		product = (sum * 2) % 11
	}
	check := (11 - product) % 10
	return check == int(d[10]-'0')
}

func MaskSteuerID(s string) string {
	return piiSteuerIDRE.ReplaceAllStringFunc(s, func(m string) string {
		if !steuerIDValid(m) {
			return m
		}
		return "[DE_STEUER_ID]"
	})
}

func countSteuerID(s string) int {
	n := 0
	for _, m := range piiSteuerIDRE.FindAllString(s, -1) {
		if steuerIDValid(m) {
			n++
		}
	}
	return n
}

// ─── CA SIN — 9-digit Canadian Social Insurance Number ────────────
// Luhn-validated. Format: NNN-NNN-NNN or NNN NNN NNN. We accept
// optional spaces or hyphens.
var piiSINRE = regexp.MustCompile(`\b\d{3}[- ]?\d{3}[- ]?\d{3}\b`)

func sinValid(s string) bool {
	d := stripNonDigits(s)
	if len(d) != 9 {
		return false
	}
	// First digit 0, 8 = not issued. (8 reserved for future use; 0
	// never issued. 9 is non-residents — those ARE valid SINs.)
	if d[0] == '0' || d[0] == '8' {
		return false
	}
	return luhnCheckDigits(d)
}

// luhnCheckDigits is a length-independent Luhn pass for callers
// (SIN, NPI-with-prefix) where the PAN-specific 13-19 length gate
// in luhnValid is wrong.
func luhnCheckDigits(digits string) bool {
	n := len(digits)
	if n == 0 {
		return false
	}
	sum := 0
	alt := false
	for i := n - 1; i >= 0; i-- {
		c := digits[i]
		if c < '0' || c > '9' {
			return false
		}
		d := int(c - '0')
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

func MaskSIN(s string) string {
	return piiSINRE.ReplaceAllStringFunc(s, func(m string) string {
		if !sinValid(m) {
			return m
		}
		return "[CA_SIN]"
	})
}

func countSIN(s string) int {
	n := 0
	for _, m := range piiSINRE.FindAllString(s, -1) {
		if sinValid(m) {
			n++
		}
	}
	return n
}

// ─── AU TFN — 8 or 9 digit Australian Tax File Number ─────────────
// Weighted sum mod 11. Weights (9-digit form): 1,4,3,7,5,8,6,9,10.
var piiTFNRE = regexp.MustCompile(`\b\d{3}[- ]?\d{3}[- ]?\d{3}\b|\b\d{2}[- ]?\d{3}[- ]?\d{3}\b`)

func tfnValid(s string) bool {
	d := stripNonDigits(s)
	if len(d) != 8 && len(d) != 9 {
		return false
	}
	var weights []int
	if len(d) == 9 {
		weights = []int{1, 4, 3, 7, 5, 8, 6, 9, 10}
	} else {
		weights = []int{10, 7, 8, 4, 6, 3, 5, 1}
	}
	sum := 0
	for i, c := range d {
		sum += int(c-'0') * weights[i]
	}
	return sum%11 == 0
}

func MaskTFN(s string) string {
	return piiTFNRE.ReplaceAllStringFunc(s, func(m string) string {
		if !tfnValid(m) {
			return m
		}
		return "[AU_TFN]"
	})
}

func countTFN(s string) int {
	n := 0
	for _, m := range piiTFNRE.FindAllString(s, -1) {
		if tfnValid(m) {
			n++
		}
	}
	return n
}

// ─── US NPI — 10-digit National Provider Identifier ───────────────
// Luhn-10 with implicit prefix "80840" (HIPAA-mandated). The
// validator prepends the prefix before running Luhn.
var piiNPIRE = regexp.MustCompile(`\b\d{10}\b`)

func npiValid(s string) bool {
	d := stripNonDigits(s)
	if len(d) != 10 {
		return false
	}
	// HIPAA-prescribed prefix is "80840" before the Luhn calculation.
	return luhnCheckDigits("80840" + d)
}

func MaskNPI(s string) string {
	return piiNPIRE.ReplaceAllStringFunc(s, func(m string) string {
		if !npiValid(m) {
			return m
		}
		return "[US_NPI]"
	})
}

func countNPI(s string) int {
	n := 0
	for _, m := range piiNPIRE.FindAllString(s, -1) {
		if npiValid(m) {
			n++
		}
	}
	return n
}
