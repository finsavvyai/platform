package security

import (
	"strings"
	"testing"
)

func TestGenerateAPIKeyFormat(t *testing.T) {
	plaintext, hash, err := GenerateAPIKey()
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name string
		ok   bool
	}{
		{"has prefix", strings.HasPrefix(plaintext, APIKeyPrefix)},
		{"correct length", len(plaintext) == len(APIKeyPrefix)+keyRandomBytes*2},
		{"hash has salt separator", strings.Contains(hash, "$")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !tt.ok {
				t.Error("check failed")
			}
		})
	}
}

func TestVerifyCorrectKey(t *testing.T) {
	plaintext, hash, err := GenerateAPIKey()
	if err != nil {
		t.Fatal(err)
	}
	if !VerifyAPIKey(plaintext, hash) {
		t.Error("expected valid key to verify")
	}
}

func TestVerifyWrongKeyFails(t *testing.T) {
	_, hash, err := GenerateAPIKey()
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name string
		key  string
	}{
		{"wrong key", "amliq_sk_0000000000000000000000000000000f"},
		{"empty key", ""},
		{"random string", "not_a_key"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if VerifyAPIKey(tt.key, hash) {
				t.Error("expected wrong key to fail verification")
			}
		})
	}
}

func TestVerifyInvalidHashFormat(t *testing.T) {
	if VerifyAPIKey("amliq_sk_test", "nodolorinseparator") {
		t.Error("expected invalid hash format to fail")
	}
}

func TestHashIsSalted(t *testing.T) {
	key := "amliq_sk_abcdef0123456789abcdef0123456789"
	hash1, err := HashAPIKey(key)
	if err != nil {
		t.Fatal(err)
	}
	hash2, err := HashAPIKey(key)
	if err != nil {
		t.Fatal(err)
	}
	if hash1 == hash2 {
		t.Error("expected different salts to produce different hashes")
	}
	if !VerifyAPIKey(key, hash1) || !VerifyAPIKey(key, hash2) {
		t.Error("both hashes should verify against same key")
	}
}
