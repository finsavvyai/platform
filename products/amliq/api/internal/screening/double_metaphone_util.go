package screening

import "strings"

func isVowel(c byte) bool {
	return c == 'A' || c == 'E' || c == 'I' || c == 'O' || c == 'U'
}

func hasPrefix(s string, prefixes ...string) bool {
	for _, p := range prefixes {
		if strings.HasPrefix(s, p) {
			return true
		}
	}
	return false
}

func skipDouble(s string, i int) int {
	if i+1 < len(s) && s[i+1] == s[i] {
		return 2
	}
	return 1
}

func substr(s string, start, length int) string {
	end := start + length
	if end > len(s) {
		end = len(s)
	}
	return s[start:end]
}

func dmHandleS(s string, i, last int, pri, sec *strings.Builder) int {
	if i+1 <= last && substr(s, i, 2) == "SH" {
		pri.WriteByte('X')
		sec.WriteByte('X')
		return 2
	}
	if i+2 <= last && substr(s, i, 3) == "SCH" {
		pri.WriteByte('X')
		sec.WriteString("SK")
		return 3
	}
	pri.WriteByte('S')
	sec.WriteByte('S')
	return skipDouble(s, i)
}

func dmHandleT(s string, i, last int, pri, sec *strings.Builder) int {
	if i+1 <= last && substr(s, i, 2) == "TH" {
		pri.WriteByte('0')
		sec.WriteByte('T')
		return 2
	}
	if i+2 <= last && substr(s, i, 3) == "TCH" {
		pri.WriteByte('X')
		sec.WriteByte('X')
		return 3
	}
	pri.WriteByte('T')
	sec.WriteByte('T')
	return skipDouble(s, i)
}
