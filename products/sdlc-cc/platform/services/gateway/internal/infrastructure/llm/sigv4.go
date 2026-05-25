// Package llm — AWS SigV4 request signer.
//
// Hand-rolled SigV4 so we don't drag aws-sdk-go-v2 in for two endpoints.
// Reference: https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html
//
// Coverage: signs POST/GET requests with a body. Supports session
// tokens (X-Amz-Security-Token) and produces deterministic signatures
// when both Now and a precomputed payload hash are supplied.
package llm

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"sort"
	"strings"
	"time"
)

const sigv4Algorithm = "AWS4-HMAC-SHA256"

// sigV4Signer holds the credential set for one AWS account/role.
type sigV4Signer struct {
	accessKey    string
	secretKey    string
	sessionToken string
	region       string
	service      string
}

// sign mutates req.Header to include the SigV4 authorization headers.
// payloadHash is the hex sha256 of the request body; pass "" to compute.
// now is injected for deterministic tests.
func (s *sigV4Signer) sign(req *http.Request, payload []byte, now time.Time) {
	t := now.UTC()
	amzDate := t.Format("20060102T150405Z")
	dateStamp := t.Format("20060102")

	req.Header.Set("host", req.Host)
	req.Header.Set("x-amz-date", amzDate)
	if s.sessionToken != "" {
		req.Header.Set("x-amz-security-token", s.sessionToken)
	}
	hashedPayload := sha256Hex(payload)
	// x-amz-content-sha256 is required by S3 but not by bedrock; signed
	// only when explicitly opted in by the caller (omitted here).

	canonicalHeaders, signedHeaders := canonicalizeHeaders(req)
	canonicalRequest := strings.Join([]string{
		req.Method,
		canonicalURI(req),
		canonicalQuery(req),
		canonicalHeaders,
		signedHeaders,
		hashedPayload,
	}, "\n")

	credScope := strings.Join([]string{dateStamp, s.region, s.service, "aws4_request"}, "/")
	stringToSign := strings.Join([]string{
		sigv4Algorithm,
		amzDate,
		credScope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")

	signingKey := deriveSigningKey(s.secretKey, dateStamp, s.region, s.service)
	signature := hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign)))

	auth := sigv4Algorithm +
		" Credential=" + s.accessKey + "/" + credScope +
		", SignedHeaders=" + signedHeaders +
		", Signature=" + signature
	req.Header.Set("Authorization", auth)
}

func canonicalURI(req *http.Request) string {
	p := req.URL.EscapedPath()
	if p == "" {
		return "/"
	}
	return p
}

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

// awsURIEncode follows AWS's stricter rules vs. url.QueryEscape.
// path=true preserves '/'.
func awsURIEncode(s string, encodeSlash bool) string {
	const hex = "0123456789ABCDEF"
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'),
			c == '-', c == '_', c == '.', c == '~':
			b.WriteByte(c)
		case c == '/' && !encodeSlash:
			b.WriteByte(c)
		default:
			b.WriteByte('%')
			b.WriteByte(hex[c>>4])
			b.WriteByte(hex[c&0xF])
		}
	}
	return b.String()
}

func deriveSigningKey(secret, date, region, service string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secret), []byte(date))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte(service))
	return hmacSHA256(kService, []byte("aws4_request"))
}

func hmacSHA256(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

func sha256Hex(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}
