package screening

import "strings"

func dmHandleC(s string, i, last int, pri, sec *strings.Builder) int {
	if i+1 <= last && substr(s, i, 2) == "CH" {
		pri.WriteByte('X')
		sec.WriteByte('X')
		return 2
	}
	if i+1 <= last && (substr(s, i, 2) == "CI" ||
		substr(s, i, 2) == "CE" || substr(s, i, 2) == "CY") {
		pri.WriteByte('S')
		sec.WriteByte('S')
		return 2
	}
	pri.WriteByte('K')
	sec.WriteByte('K')
	return skipDouble(s, i)
}

func dmHandleD(s string, i, last int, pri, sec *strings.Builder) int {
	if i+1 <= last && substr(s, i, 2) == "DG" {
		if i+2 <= last && (s[i+2] == 'I' || s[i+2] == 'E' || s[i+2] == 'Y') {
			pri.WriteByte('J')
			sec.WriteByte('J')
			return 3
		}
		pri.WriteString("TK")
		sec.WriteString("TK")
		return 2
	}
	// DT collapses to single T
	if i+1 <= last && s[i+1] == 'T' {
		pri.WriteByte('T')
		sec.WriteByte('T')
		return 2
	}
	pri.WriteByte('T')
	sec.WriteByte('T')
	return skipDouble(s, i)
}

func dmHandleG(s string, i, last int, pri, sec *strings.Builder) int {
	if i+1 <= last && substr(s, i, 2) == "GH" {
		if i+2 <= last && isVowel(s[i+2]) {
			pri.WriteByte('K')
			sec.WriteByte('K')
			return 2
		}
		return 2 // silent GH
	}
	if i+1 <= last && (s[i+1] == 'E' || s[i+1] == 'I' || s[i+1] == 'Y') {
		pri.WriteByte('J')
		sec.WriteByte('K')
		return 2
	}
	if i+1 <= last && s[i+1] == 'N' {
		pri.WriteByte('N')
		sec.WriteByte('K')
		return 2
	}
	pri.WriteByte('K')
	sec.WriteByte('K')
	return skipDouble(s, i)
}

func dmHandleP(s string, i int, pri, sec *strings.Builder) int {
	if i+1 < len(s) && s[i+1] == 'H' {
		pri.WriteByte('F')
		sec.WriteByte('F')
		return 2
	}
	pri.WriteByte('P')
	sec.WriteByte('P')
	return skipDouble(s, i)
}

