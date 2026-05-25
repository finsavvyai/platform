package dlp

import (
	"strings"
	"testing"
)

func TestMaskCredentials_Anthropic(t *testing.T) {
	in := "key=sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA more text"
	out := MaskCredentials(in)
	if strings.Contains(out, "sk-ant-api03") {
		t.Errorf("Anthropic key leaked: %s", out)
	}
	if !strings.Contains(out, "[CRED:anthropic]") {
		t.Errorf("expected labelled redaction, got: %s", out)
	}
}

func TestMaskCredentials_AllProviders(t *testing.T) {
	cases := map[string]string{
		"AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE":               "aws_access_key",
		"GH_TOKEN=ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": "github_pat",
		"slack=xoxb-12345-67890-abcdefghijklmnopqr":         "slack_xoxb",
		"stripe=sk_live_AAAAAAAAAAAAAAAAAAAAAAAA":           "stripe_live",
		"google=AIzaSyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA":  "google_api",
	}
	for in, label := range cases {
		out := MaskCredentials(in)
		want := "[CRED:" + label + "]"
		if !strings.Contains(out, want) {
			t.Errorf("input %q expected %q in output, got: %s", in, want, out)
		}
	}
}

func TestMaskCredentials_JWT(t *testing.T) {
	jwt := "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
	out := MaskCredentials("Authorization: Bearer " + jwt)
	if strings.Contains(out, jwt) {
		t.Errorf("JWT leaked")
	}
	if !strings.Contains(out, "[CRED:jwt]") {
		t.Errorf("expected JWT redaction, got: %s", out)
	}
}

func TestMaskCredentials_PrivateKeyBlock(t *testing.T) {
	in := `Found this in config:
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAvNuQ...
-----END RSA PRIVATE KEY-----
end of file`
	out := MaskCredentials(in)
	if strings.Contains(out, "MIIEowIBAAKCAQEA") {
		t.Errorf("private key body leaked")
	}
	if !strings.Contains(out, "[CRED:private_key_block]") {
		t.Errorf("expected key-block redaction, got: %s", out)
	}
}

func TestCountCredentials(t *testing.T) {
	in := "AWS_KEY=AKIAIOSFODNN7EXAMPLE GH=ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if n := countCredentials(in); n != 2 {
		t.Errorf("expected 2 matches, got %d", n)
	}
}
