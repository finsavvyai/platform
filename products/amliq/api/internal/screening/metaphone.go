package screening

import "strings"

// metaphoneReplacer is pre-allocated (avoids alloc per call).
var metaphoneReplacer = strings.NewReplacer(
	"PH", "F", "CK", "K", "GH", "F",
	"KN", "N", "WR", "R", "AE", "E",
	"SH", "X", "TH", "0", "SCH", "SK",
)

// metaphoneCode computes a simplified Metaphone encoding.
func metaphoneCode(s string) string {
	if s == "" {
		return ""
	}
	s = strings.ToUpper(s)
	// Deduplicate consecutive characters in-place
	var b strings.Builder
	b.Grow(len(s))
	prev := rune(0)
	for _, r := range s {
		if r != prev {
			b.WriteRune(r)
		}
		prev = r
	}
	s = metaphoneReplacer.Replace(b.String())
	if len(s) <= 1 {
		return s
	}
	// Strip vowels except first char
	var out strings.Builder
	out.Grow(5)
	out.WriteByte(s[0])
	for i := 1; i < len(s); i++ {
		switch s[i] {
		case 'A', 'E', 'I', 'O', 'U':
			continue
		default:
			out.WriteByte(s[i])
		}
	}
	result := out.String()
	if len(result) > 4 {
		return result[:4]
	}
	return result
}
