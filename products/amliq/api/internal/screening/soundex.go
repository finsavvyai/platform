package screening

import (
	"strings"
	"unicode"
)

// soundexLookup is a pre-computed array-based lookup (avoids map alloc per call).
// Index by uppercase ASCII letter (A=65..Z=90), value 0 means no code.
var soundexLookup [91]byte

func init() {
	m := map[byte]byte{
		'B': '1', 'F': '1', 'P': '1', 'V': '1',
		'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
		'D': '3', 'T': '3',
		'L': '4',
		'M': '5', 'N': '5',
		'R': '6',
	}
	for k, v := range m {
		soundexLookup[k] = v
	}
}

func soundexCode(s string) string {
	if s == "" {
		return ""
	}
	s = strings.ToUpper(s)
	first := s[0]

	var buf [4]byte
	buf[0] = first
	pos := 1
	var prevCode byte

	for i := 1; i < len(s) && pos < 4; i++ {
		ch := s[i]
		if !unicode.IsLetter(rune(ch)) {
			continue
		}
		if ch > 90 {
			prevCode = 0
			continue
		}
		code := soundexLookup[ch]
		if code == 0 {
			prevCode = 0
			continue
		}
		if code != prevCode {
			buf[pos] = code
			pos++
		}
		prevCode = code
	}
	for pos < 4 {
		buf[pos] = '0'
		pos++
	}
	return string(buf[:])
}
