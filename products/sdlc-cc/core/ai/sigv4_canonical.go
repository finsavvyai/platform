package ai

import (
	"net/http"
	"sort"
	"strings"
)

// canonicalURI returns the URL path or "/" if empty (AWS spec).
func canonicalURI(req *http.Request) string {
	p := req.URL.EscapedPath()
	if p == "" {
		return "/"
	}
	return p
}

// canonicalQuery sorts and AWS-encodes the query string per spec.
// Multiple values for the same key are sorted by value.
func canonicalQuery(req *http.Request) string {
	q := req.URL.Query()
	keys := make([]string, 0, len(q))
	for k := range q {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var parts []string
	for _, k := range keys {
		vs := q[k]
		sort.Strings(vs)
		for _, v := range vs {
			parts = append(parts, awsURIEncode(k, true)+"="+awsURIEncode(v, true))
		}
	}
	return strings.Join(parts, "&")
}

// canonicalizeHeaders returns the canonical-header block + the
// signed-header list, both lowercased + sorted per AWS spec.
func canonicalizeHeaders(req *http.Request) (string, string) {
	keys := make([]string, 0, len(req.Header))
	for k := range req.Header {
		keys = append(keys, strings.ToLower(k))
	}
	sort.Strings(keys)
	var canon strings.Builder
	for _, k := range keys {
		canon.WriteString(k)
		canon.WriteByte(':')
		v := strings.Join(req.Header.Values(k), ",")
		canon.WriteString(strings.TrimSpace(collapseWS(v)))
		canon.WriteByte('\n')
	}
	return canon.String(), strings.Join(keys, ";")
}

// collapseWS replaces runs of spaces/tabs with a single space.
func collapseWS(s string) string {
	out := make([]byte, 0, len(s))
	prevSpace := false
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c == ' ' || c == '\t' {
			if !prevSpace {
				out = append(out, ' ')
				prevSpace = true
			}
			continue
		}
		out = append(out, c)
		prevSpace = false
	}
	return string(out)
}

// awsURIEncode follows AWS's stricter rules vs url.QueryEscape.
// path=true preserves '/'.
func awsURIEncode(s string, encodeSlash bool) string {
	const hexC = "0123456789ABCDEF"
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
			(c >= '0' && c <= '9'),
			c == '-', c == '_', c == '.', c == '~':
			b.WriteByte(c)
		case c == '/' && !encodeSlash:
			b.WriteByte(c)
		default:
			b.WriteByte('%')
			b.WriteByte(hexC[c>>4])
			b.WriteByte(hexC[c&0xF])
		}
	}
	return b.String()
}
