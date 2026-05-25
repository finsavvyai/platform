package ai

import (
	"net/http"
	"strings"
	"testing"
	"time"
)

// TestSigV4_AuthHeaderShape verifies the signer produces the expected
// Authorization header structure. We don't reproduce the AWS reference
// vector here (that needs canonical-host setup); shape-checking
// catches the regressions a CI that doesn't hit AWS would actually
// see — missing Credential, missing SignedHeaders, missing Signature.
func TestSigV4_AuthHeaderShape(t *testing.T) {
	signer := &sigV4Signer{
		accessKey: "AKIAIOSFODNN7EXAMPLE",
		secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
		region:    "us-east-1",
		service:   "bedrock",
	}
	body := []byte(`{"x":1}`)
	req, _ := http.NewRequest("POST",
		"https://bedrock-runtime.us-east-1.amazonaws.com/model/foo/invoke",
		strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/json")
	t0 := time.Date(2026, 5, 3, 12, 0, 0, 0, time.UTC)

	signer.sign(req, body, t0)
	auth := req.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "AWS4-HMAC-SHA256 ") {
		t.Errorf("auth missing algorithm prefix: %q", auth)
	}
	for _, sub := range []string{"Credential=", "SignedHeaders=", "Signature="} {
		if !strings.Contains(auth, sub) {
			t.Errorf("auth missing %q: %q", sub, auth)
		}
	}
	if req.Header.Get("x-amz-date") != "20260503T120000Z" {
		t.Errorf("x-amz-date drift: %q", req.Header.Get("x-amz-date"))
	}
}

func TestSigV4_DeterministicAcrossRuns(t *testing.T) {
	signer := &sigV4Signer{
		accessKey: "AKIA", secretKey: "secret",
		region: "us-east-1", service: "bedrock",
	}
	body := []byte(`{"a":1}`)
	t0 := time.Date(2026, 5, 3, 12, 0, 0, 0, time.UTC)
	r1, _ := http.NewRequest("POST", "https://example.com/x", nil)
	r2, _ := http.NewRequest("POST", "https://example.com/x", nil)
	signer.sign(r1, body, t0)
	signer.sign(r2, body, t0)
	if r1.Header.Get("Authorization") != r2.Header.Get("Authorization") {
		t.Error("signature non-deterministic for same inputs")
	}
}
