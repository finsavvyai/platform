package screening

import "strings"

// DoubleMetaphone returns primary and secondary phonetic codes.
func DoubleMetaphone(name string) (string, string) {
	s := strings.ToUpper(strings.TrimSpace(name))
	if s == "" {
		return "", ""
	}
	var pri, sec strings.Builder
	i := 0
	last := len(s) - 1

	// Skip initial silent letters
	if len(s) >= 2 && hasPrefix(s, "GN", "KN", "PN", "AE", "WR") {
		i = 1
	}
	// Handle initial NG (Vietnamese): primary=N, secondary=K
	if len(s) >= 2 && s[0] == 'N' && s[1] == 'G' {
		pri.WriteByte('N')
		sec.WriteByte('K')
		i = 2
	}

	for i <= last && pri.Len() < 6 {
		c := s[i]
		switch c {
		case 'A', 'E', 'I', 'O', 'U':
			if i == 0 {
				pri.WriteByte('A')
				sec.WriteByte('A')
			}
			i++
		case 'B':
			pri.WriteByte('P')
			sec.WriteByte('P')
			i += skipDouble(s, i)
		case 'C':
			i += dmHandleC(s, i, last, &pri, &sec)
		case 'D':
			i += dmHandleD(s, i, last, &pri, &sec)
		case 'F':
			pri.WriteByte('F')
			sec.WriteByte('F')
			i += skipDouble(s, i)
		case 'G':
			i += dmHandleG(s, i, last, &pri, &sec)
		case 'H':
			if i < last && isVowel(s[i+1]) && (i == 0 || isVowel(s[i-1])) {
				pri.WriteByte('H')
				sec.WriteByte('H')
			}
			i++
		case 'J', 'K', 'L', 'M', 'N':
			pri.WriteByte(c)
			sec.WriteByte(c)
			i += skipDouble(s, i)
		case 'P':
			i += dmHandleP(s, i, &pri, &sec)
		case 'Q':
			pri.WriteByte('K')
			sec.WriteByte('K')
			i += skipDouble(s, i)
		case 'R':
			pri.WriteByte('R')
			sec.WriteByte('R')
			i += skipDouble(s, i)
		case 'S':
			i += dmHandleS(s, i, last, &pri, &sec)
		case 'T':
			i += dmHandleT(s, i, last, &pri, &sec)
		case 'V':
			pri.WriteByte('F')
			sec.WriteByte('F')
			i += skipDouble(s, i)
		case 'W':
			if i < last && isVowel(s[i+1]) {
				pri.WriteByte('A')
				sec.WriteByte('A')
			}
			i++
		case 'X':
			pri.WriteString("KS")
			sec.WriteString("KS")
			i += skipDouble(s, i)
		case 'Z':
			pri.WriteByte('S')
			sec.WriteByte('S')
			i += skipDouble(s, i)
		default:
			i++
		}
	}
	return pri.String(), sec.String()
}
