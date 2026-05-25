package handlers

import "testing"

func TestLooksLikeKEK(t *testing.T) {
	cases := map[string]bool{
		"arn:aws:kms:us-east-1:111:key/abc":                              true,
		"projects/my-proj/locations/us/keyRings/r/cryptoKeys/k":          true,
		"https://my-vault.vault.azure.net/keys/my-key":                   true,
		"https://my-vault.vault.azure.net/keys/my-key/abc123":            true,
		"":                              false,
		"random-string":                 false,
		"arn:aws:s3:::my-bucket":        false, // not KMS
		"projects/my-proj":              false, // missing /cryptoKeys/
		"https://example.com":           false, // not vault.azure.net
	}
	for in, want := range cases {
		if got := looksLikeKEK(in); got != want {
			t.Errorf("looksLikeKEK(%q) = %v, want %v", in, got, want)
		}
	}
}
