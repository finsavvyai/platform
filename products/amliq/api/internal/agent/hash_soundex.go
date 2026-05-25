package agent

import "strings"

// simpleSoundex computes a Soundex code for phonetic hash matching.
func simpleSoundex(s string) string {
	if s == "" {
		return ""
	}
	s = strings.ToUpper(s)
	result := []byte{s[0]}
	codes := map[byte]byte{
		'B': '1', 'F': '1', 'P': '1', 'V': '1',
		'C': '2', 'G': '2', 'J': '2', 'K': '2',
		'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
		'D': '3', 'T': '3', 'L': '4',
		'M': '5', 'N': '5', 'R': '6',
	}
	prev := byte('0')
	for i := 1; i < len(s) && len(result) < 4; i++ {
		if c, ok := codes[s[i]]; ok && c != prev {
			result = append(result, c)
			prev = c
		} else if !ok {
			prev = '0'
		}
	}
	for len(result) < 4 {
		result = append(result, '0')
	}
	return string(result)
}
