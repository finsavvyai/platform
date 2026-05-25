package detect

import (
	"regexp"
	"strings"
)

var kvRe = regexp.MustCompile(`([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"((?:[^"\\]|\\.)*)"`)

type hclBlock struct {
	Header []string
	Body   string
}

// findBlocks returns the (header-match, body) pairs for every
// top-level block whose header matches `headerRe`. Body is the text
// between the opening `{` and its balanced `}`.
func findBlocks(src string, headerRe *regexp.Regexp) []hclBlock {
	out := []hclBlock{}
	for _, m := range headerRe.FindAllStringSubmatchIndex(src, -1) {
		brace := strings.Index(src[m[1]-1:], "{")
		if brace < 0 {
			continue
		}
		start := m[1] - 1 + brace
		end, ok := matchBrace(src, start)
		if !ok {
			continue
		}
		out = append(out, hclBlock{Header: headerSlices(src, m), Body: src[start+1 : end]})
	}
	return out
}

func headerSlices(src string, m []int) []string {
	header := make([]string, 0, (len(m)-2)/2)
	for k := 0; k < len(m); k += 2 {
		if m[k] < 0 {
			header = append(header, "")
		} else {
			header = append(header, src[m[k]:m[k+1]])
		}
	}
	return header
}

func matchBrace(src string, openIdx int) (int, bool) {
	depth := 1
	i := openIdx + 1
	for i < len(src) && depth > 0 {
		switch src[i] {
		case '{':
			depth++
		case '}':
			depth--
		}
		i++
	}
	if depth != 0 {
		return 0, false
	}
	return i - 1, true
}

func kvPairs(body string) map[string]string {
	out := map[string]string{}
	for _, m := range kvRe.FindAllStringSubmatch(body, -1) {
		out[m[1]] = m[2]
	}
	return out
}
