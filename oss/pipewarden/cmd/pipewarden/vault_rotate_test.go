package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"net"
	"path/filepath"
	"strings"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"github.com/finsavvyai/pipewarden/internal/vault"
)

func mustKey(t *testing.T) string {
	t.Helper()
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		t.Fatalf("rand: %v", err)
	}
	return hex.EncodeToString(b)
}

// seedFixture builds an in-tempdir SQLite DB with the minimum schema
// the rotation code touches and inserts a connections + webhook row
// encrypted under `oldKey`. Returns the absolute db path and the
// plaintext map so tests can verify post-rotation decryptability.
func seedFixture(t *testing.T, oldKey string) (string, map[string]string) {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "pw.db")
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer func() { _ = db.Close() }()

	stmts := []string{
		`CREATE TABLE connections (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			token TEXT NOT NULL DEFAULT '',
			username TEXT NOT NULL DEFAULT '',
			app_password TEXT NOT NULL DEFAULT ''
		)`,
		`CREATE TABLE webhook_configs (
			name TEXT PRIMARY KEY,
			secret TEXT NOT NULL DEFAULT ''
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			t.Fatalf("ddl: %v", err)
		}
	}

	v, err := vault.New(oldKey)
	if err != nil {
		t.Fatalf("vault: %v", err)
	}

	plaintexts := map[string]string{
		"token":    "ghp_realtokenAAAAAAAAAAAAAAAAAAAAAAAAAA",
		"username": "alice",
		"appPass":  "bitbucket-app-password",
		"hookSec":  "hmac-signing-secret",
		"plainTok": "second-conn-token",
	}
	mustEnc := func(s string) string {
		out, err := v.Encrypt(s)
		if err != nil {
			t.Fatalf("encrypt: %v", err)
		}
		return out
	}
	if _, err := db.Exec(`INSERT INTO connections (name, token, username, app_password) VALUES (?, ?, ?, ?)`,
		"github-prod", mustEnc(plaintexts["token"]), mustEnc(plaintexts["username"]), mustEnc(plaintexts["appPass"])); err != nil {
		t.Fatalf("seed conn1: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO connections (name, token) VALUES (?, ?)`,
		"gitlab-staging", mustEnc(plaintexts["plainTok"])); err != nil {
		t.Fatalf("seed conn2: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO webhook_configs (name, secret) VALUES (?, ?)`,
		"opensre", mustEnc(plaintexts["hookSec"])); err != nil {
		t.Fatalf("seed hook: %v", err)
	}
	return dbPath, plaintexts
}

func TestRotateVaultHappyPath(t *testing.T) {
	oldK := mustKey(t)
	newK := mustKey(t)
	dbPath, pt := seedFixture(t, oldK)

	rep, err := rotateVault(context.Background(), dbPath, oldK, newK, false)
	if err != nil {
		t.Fatalf("rotate: %v", err)
	}
	if rep.Connections != 2 {
		t.Errorf("connections rotated = %d, want 2", rep.Connections)
	}
	if rep.Webhooks != 1 {
		t.Errorf("webhooks rotated = %d, want 1", rep.Webhooks)
	}
	if len(rep.Errors) != 0 {
		t.Errorf("unexpected errors: %v", rep.Errors)
	}

	// Re-open under NEW key and verify decryption succeeds.
	newV, err := vault.New(newK)
	if err != nil {
		t.Fatalf("new vault: %v", err)
	}
	db, _ := sql.Open("sqlite3", dbPath)
	defer func() { _ = db.Close() }()

	var tok, user, ap string
	if err := db.QueryRow(`SELECT token, username, app_password FROM connections WHERE name='github-prod'`).
		Scan(&tok, &user, &ap); err != nil {
		t.Fatalf("read back: %v", err)
	}
	check := func(label, ciphertext, want string) {
		got, err := newV.Decrypt(ciphertext)
		if err != nil {
			t.Errorf("decrypt %s with new key: %v", label, err)
			return
		}
		if got != want {
			t.Errorf("%s round-trip: got %q want %q", label, got, want)
		}
	}
	check("token", tok, pt["token"])
	check("username", user, pt["username"])
	check("app_password", ap, pt["appPass"])

	var hookSec string
	if err := db.QueryRow(`SELECT secret FROM webhook_configs WHERE name='opensre'`).Scan(&hookSec); err != nil {
		t.Fatalf("read webhook: %v", err)
	}
	check("hook.secret", hookSec, pt["hookSec"])

	// OLD key must no longer decrypt the now-rotated rows.
	oldV, _ := vault.New(oldK)
	if _, err := oldV.Decrypt(tok); err == nil {
		t.Error("old key still decrypts new ciphertext — rotation didn't actually run")
	}
}

func TestRotateVaultDryRunWritesNothing(t *testing.T) {
	oldK := mustKey(t)
	newK := mustKey(t)
	dbPath, _ := seedFixture(t, oldK)

	rep, err := rotateVault(context.Background(), dbPath, oldK, newK, true /*dryRun*/)
	if err != nil {
		t.Fatalf("rotate: %v", err)
	}
	if rep.Connections != 2 || rep.Webhooks != 1 {
		t.Errorf("dry-run counts off: %+v", rep)
	}

	// OLD key MUST still decrypt because nothing changed on disk.
	oldV, _ := vault.New(oldK)
	db, _ := sql.Open("sqlite3", dbPath)
	defer func() { _ = db.Close() }()
	var tok string
	_ = db.QueryRow(`SELECT token FROM connections WHERE name='github-prod'`).Scan(&tok)
	if _, err := oldV.Decrypt(tok); err != nil {
		t.Errorf("dry-run wrote to disk: %v", err)
	}
}

func TestRotateVaultCollectsPerRowErrors(t *testing.T) {
	oldK := mustKey(t)
	newK := mustKey(t)
	dbPath, _ := seedFixture(t, oldK)

	// Corrupt one row's ciphertext so the OLD key can't decrypt it.
	db, _ := sql.Open("sqlite3", dbPath)
	if _, err := db.Exec(`UPDATE connections SET token='not-a-real-ciphertext' WHERE name='gitlab-staging'`); err != nil {
		t.Fatalf("corrupt: %v", err)
	}
	_ = db.Close()

	rep, err := rotateVault(context.Background(), dbPath, oldK, newK, false)
	if err != nil {
		t.Fatalf("rotate: %v", err)
	}
	if len(rep.Errors) == 0 {
		t.Fatal("expected at least one per-row error")
	}
	if !strings.Contains(rep.Errors[0], "gitlab-staging") &&
		!strings.Contains(rep.Errors[0], "connection 2") {
		t.Errorf("error should mention the offending row, got %q", rep.Errors[0])
	}
	// The OTHER connection should still have rotated.
	if rep.Connections != 1 {
		t.Errorf("expected 1 successful rotation, got %d", rep.Connections)
	}
}

func TestRotateVaultIdenticalKeysRejected(t *testing.T) {
	exit := handleVaultRotateSubcommand([]string{
		"--db", "/tmp/never-opened.db",
		"--old-key", "AAAA",
		"--new-key", "AAAA",
	})
	if exit != 64 {
		t.Errorf("expected exit 64 for identical keys, got %d", exit)
	}
}

func TestRotateVaultMissingKeysRejected(t *testing.T) {
	t.Setenv("PIPEWARDEN_VAULT_KEY_OLD", "")
	t.Setenv("PIPEWARDEN_VAULT_KEY_NEW", "")
	exit := handleVaultRotateSubcommand([]string{"--db", "/tmp/never-opened.db"})
	if exit != 64 {
		t.Errorf("expected exit 64 for missing keys, got %d", exit)
	}
}

func TestRefuseIfServerListening(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer func() { _ = ln.Close() }()
	port := ln.Addr().(*net.TCPAddr).Port

	if err := refuseIfServerListening(port); err == nil {
		t.Error("expected refusal when port is open")
	}
}

func TestRefuseIfServerListeningClosedPort(t *testing.T) {
	if err := refuseIfServerListening(1); err != nil {
		t.Errorf("port 1 should be closed, got %v", err)
	}
}

func TestIsMissingTableErr(t *testing.T) {
	_, err := sql.Open("sqlite3", filepath.Join(t.TempDir(), "x.db"))
	_ = err
	dummy := errStringer("no such table: webhook_configs")
	if !isMissingTableErr(dummy, "webhook_configs") {
		t.Error("expected match")
	}
	if isMissingTableErr(dummy, "connections") {
		t.Error("wrong table name should not match")
	}
	if isMissingTableErr(nil, "anything") {
		t.Error("nil err should not match")
	}
}

type errStringer string

func (e errStringer) Error() string { return string(e) }

// Smoke: rotate against an EMPTY db (no tables) should succeed with
// zero counts.
func TestRotateVaultEmptyDB(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "empty.db")
	db, _ := sql.Open("sqlite3", dbPath)
	_ = db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rep, err := rotateVault(ctx, dbPath, mustKey(t), mustKey(t), false)
	if err != nil {
		t.Fatalf("rotate: %v", err)
	}
	if rep.Connections != 0 || rep.Webhooks != 0 || len(rep.Errors) != 0 {
		t.Errorf("empty DB rotation unexpected report: %+v", rep)
	}
}
