package saml

import (
	"crypto/rsa"
	"strings"
	"testing"
)

func TestGenerateAndLoadSPKeypair(t *testing.T) {
	keyPEM, certPEM, err := GenerateSPKeypair("https://aegis.cc/sso/tnt_abc")
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if !strings.Contains(string(keyPEM), "RSA PRIVATE KEY") {
		t.Errorf("keyPEM missing PRIVATE KEY block: %s", keyPEM)
	}
	if !strings.Contains(string(certPEM), "CERTIFICATE") {
		t.Errorf("certPEM missing CERTIFICATE block: %s", certPEM)
	}
	signer, leaf, err := LoadSPKeypair(keyPEM, certPEM)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if leaf.Subject.CommonName != "https://aegis.cc/sso/tnt_abc" {
		t.Errorf("CN drift: %q", leaf.Subject.CommonName)
	}
	if _, ok := signer.(*rsa.PrivateKey); !ok {
		t.Errorf("signer not RSA: %T", signer)
	}
}

func TestLoadSPKeypair_Garbage(t *testing.T) {
	if _, _, err := LoadSPKeypair([]byte("nope"), []byte("nope")); err == nil {
		t.Error("expected error on garbage PEM")
	}
}
