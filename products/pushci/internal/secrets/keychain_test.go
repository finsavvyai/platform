package secrets

import (
	"context"
	"errors"
	"os"
	"testing"
)

func newTestKeychain(t *testing.T) *KeychainResolver {
	t.Helper()
	tmp := t.TempDir()
	store, err := newUserStore(tmp)
	if err != nil {
		t.Fatalf("newUserStore: %v", err)
	}
	return &KeychainResolver{defaultAccount: "testuser", fallback: store}
}

// Tests use the fallback file as the OS keystore stand-in: by seeding
// the encrypted file directly and letting osKeyringGet fail with the
// not-found sentinel, the fallback path is exercised. This keeps the
// unit tests hermetic — they don't read or write the actual Keychain
// / Credential Manager / Secret Service on the developer's machine.

func TestKeychainResolveDefaultAccount(t *testing.T) {
	k := newTestKeychain(t)
	if err := k.fallback.Set(fallbackKey("npm-publish-token", "testuser"), "npm_abc"); err != nil {
		t.Fatalf("seed: %v", err)
	}
	got, err := k.Resolve(context.Background(), "keychain://npm-publish-token")
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if got != "npm_abc" {
		t.Errorf("got %q want npm_abc", got)
	}
}

func TestKeychainResolveExplicitAccount(t *testing.T) {
	k := newTestKeychain(t)
	_ = k.fallback.Set(fallbackKey("deploy-bot", "prod"), "prod-secret")
	got, _ := k.Resolve(context.Background(), "keychain://deploy-bot#prod")
	if got != "prod-secret" {
		t.Errorf("got %q want prod-secret", got)
	}
}

func TestKeychainRejectsNonScheme(t *testing.T) {
	k := newTestKeychain(t)
	if _, err := k.Resolve(context.Background(), "vault://x"); err == nil {
		t.Fatal("expected error for non-keychain ref")
	}
}

func TestKeychainNotFound(t *testing.T) {
	k := newTestKeychain(t)
	_, err := k.Resolve(context.Background(), "keychain://nonexistent")
	if err == nil {
		t.Fatal("expected error for missing entry")
	}
}

func TestKeychainSetGetRoundtrip(t *testing.T) {
	k := newTestKeychain(t)
	if err := k.Set("DEPLOY_KEY", "", "secret123"); err != nil {
		t.Fatalf("Set: %v", err)
	}
	got, err := k.Resolve(context.Background(), "keychain://DEPLOY_KEY")
	if err != nil {
		t.Fatalf("Resolve after Set: %v", err)
	}
	if got != "secret123" {
		t.Errorf("got %q want secret123", got)
	}
}

func TestKeychainDeleteIdempotent(t *testing.T) {
	k := newTestKeychain(t)
	if err := k.Delete("never-existed", ""); err != nil {
		t.Errorf("Delete of missing entry should be no-op, got %v", err)
	}
}

func TestIsKeyringUnavailable(t *testing.T) {
	if !isKeyringUnavailable(errKeychainNotFound) {
		t.Error("errKeychainNotFound should route to fallback")
	}
	if !isKeyringUnavailable(errors.New("dbus error: service not running")) {
		t.Error("dbus errors should route to fallback")
	}
	if isKeyringUnavailable(errors.New("invalid password")) {
		t.Error("invalid-password is not 'unavailable'")
	}
}

func TestNewKeychainResolverDefaultsToOSUser(t *testing.T) {
	_ = os.Setenv("USER", "fallbackname")
	k, err := NewKeychainResolver("")
	if err != nil {
		t.Fatalf("NewKeychainResolver: %v", err)
	}
	if k.defaultAccount == "" {
		t.Error("expected non-empty defaultAccount")
	}
}
