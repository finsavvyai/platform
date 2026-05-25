package ai

import (
	"net/http"
	"strings"
	"testing"
	"time"
)

// TestSigV4_QueryStringEncoding exercises the canonicalQuery + awsURIEncode
// branches that the body-only Bedrock requests don't hit. Bedrock itself
// never uses query strings, but the SigV4 implementation must remain
// correct for any future endpoint (Titan embeddings, knowledge-base
// retrieval, agent invocations) that does.
func TestSigV4_QueryStringEncoding(t *testing.T) {
	tests := []struct {
		name string
		raw  string
	}{
		{"simple", "?foo=bar"},
		{"multi-value sorted", "?b=2&a=1"},
		{"special chars in value", "?path=/api/v1&name=Smith%20%26%20Co"},
		{"unicode", "?q=שלום"},
	}
	signer := &sigV4Signer{
		accessKey: "AKIA", secretKey: "secret",
		region: "us-east-1", service: "bedrock",
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := http.NewRequest("GET",
				"https://bedrock-runtime.us-east-1.amazonaws.com/x"+tt.raw, nil)
			if err != nil {
				t.Fatalf("req: %v", err)
			}
			signer.sign(req, nil,
				time.Date(2026, 5, 4, 12, 0, 0, 0, time.UTC))
			auth := req.Header.Get("Authorization")
			if !strings.HasPrefix(auth, "AWS4-HMAC-SHA256 ") {
				t.Errorf("auth missing prefix: %q", auth)
			}
		})
	}
}

// TestAWSURIEncode_PreservesSlashWhenAsked locks in the path-vs-query
// distinction. canonicalURI calls awsURIEncode(path, false) so /api/v1
// stays /api/v1 in the canonical request; canonicalQuery calls it with
// true so / becomes %2F.
func TestAWSURIEncode_PreservesSlashWhenAsked(t *testing.T) {
	tests := []struct {
		input       string
		encodeSlash bool
		want        string
	}{
		{"/api/v1", false, "/api/v1"},
		{"/api/v1", true, "%2Fapi%2Fv1"},
		{"hello world", true, "hello%20world"},
		{"safe-._~chars", true, "safe-._~chars"},
	}
	for _, tt := range tests {
		got := awsURIEncode(tt.input, tt.encodeSlash)
		if got != tt.want {
			t.Errorf("awsURIEncode(%q, %v) = %q, want %q",
				tt.input, tt.encodeSlash, got, tt.want)
		}
	}
}
