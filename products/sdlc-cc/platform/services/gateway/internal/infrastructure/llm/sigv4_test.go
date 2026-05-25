package llm

import (
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

// TestSigV4_KnownFixture verifies the signer against the canonical AWS
// sigv4_testsuite "get-vanilla" example. Reference:
// https://docs.aws.amazon.com/general/latest/gr/signature-v4-test-suite.html
//
// Inputs:
//
//	GET / HTTP/1.1
//	Host: example.amazonaws.com
//	X-Amz-Date: 20150830T123600Z
//	AccessKey: AKIDEXAMPLE
//	SecretKey: wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY
//	Region: us-east-1, Service: service, empty body
//
// Expected signature: 5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31
func TestSigV4_KnownFixture(t *testing.T) {
	u, _ := url.Parse("https://example.amazonaws.com/")
	req := &http.Request{
		Method: http.MethodGet,
		URL:    u,
		Host:   "example.amazonaws.com",
		Header: http.Header{},
	}
	s := &sigV4Signer{
		accessKey: "AKIDEXAMPLE",
		secretKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
		region:    "us-east-1",
		service:   "service",
	}
	fixed, _ := time.Parse("20060102T150405Z", "20150830T123600Z")
	s.sign(req, nil, fixed)

	auth := req.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "AWS4-HMAC-SHA256 ") {
		t.Fatalf("alg prefix: %q", auth)
	}
	const wantSig = "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31"
	if !strings.Contains(auth, wantSig) {
		t.Fatalf("signature mismatch.\n got: %s\nwant suffix: %s", auth, wantSig)
	}
}

func TestSigV4_DeterministicTwice(t *testing.T) {
	mk := func() *http.Request {
		u, _ := url.Parse("https://bedrock-runtime.us-east-1.amazonaws.com/model/x/invoke")
		return &http.Request{
			Method: http.MethodPost,
			URL:    u,
			Host:   "bedrock-runtime.us-east-1.amazonaws.com",
			Header: http.Header{"Content-Type": {"application/json"}},
		}
	}
	s := &sigV4Signer{
		accessKey: "AKID", secretKey: "SECRET",
		region: "us-east-1", service: "bedrock",
	}
	fixed := time.Unix(1700000000, 0).UTC()
	r1 := mk()
	r2 := mk()
	s.sign(r1, []byte(`{"a":1}`), fixed)
	s.sign(r2, []byte(`{"a":1}`), fixed)
	if r1.Header.Get("Authorization") != r2.Header.Get("Authorization") {
		t.Fatalf("signing not deterministic:\n%s\n%s", r1.Header.Get("Authorization"), r2.Header.Get("Authorization"))
	}
}

func TestSigV4_SessionToken_Included(t *testing.T) {
	u, _ := url.Parse("https://bedrock-runtime.us-east-1.amazonaws.com/model/x/invoke")
	req := &http.Request{
		Method: http.MethodPost,
		URL:    u,
		Host:   "bedrock-runtime.us-east-1.amazonaws.com",
		Header: http.Header{},
	}
	s := &sigV4Signer{
		accessKey: "AKID", secretKey: "SECRET", sessionToken: "SESSIONXYZ",
		region: "us-east-1", service: "bedrock",
	}
	s.sign(req, []byte(`{}`), time.Unix(1700000000, 0).UTC())
	if got := req.Header.Get("X-Amz-Security-Token"); got != "SESSIONXYZ" {
		t.Fatalf("session token header: %q", got)
	}
	auth := req.Header.Get("Authorization")
	if !strings.Contains(auth, "x-amz-security-token") {
		t.Fatalf("session token not in SignedHeaders: %s", auth)
	}
}
