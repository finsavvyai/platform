package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"github.com/finsavvyai/pipewarden/internal/vault"
)

// handleVaultRotateSubcommand re-encrypts every credential the vault
// owns from the OLD master key to the NEW one. It is the operational
// answer to "we leaked PIPEWARDEN_VAULT_KEY" — without this, rotating
// the env var leaves every stored token undecryptable.
//
// Encrypted columns (current schema):
//
//	connections.token
//	connections.username
//	connections.app_password
//	webhook_configs.secret
//
// New tables that store vault-encrypted material should be added here
// before tagging a release that changes the schema.
func handleVaultRotateSubcommand(args []string) int {
	fs := flag.NewFlagSet("vault-rotate", flag.ContinueOnError)
	dbPath := fs.String("db", "pipewarden.db", "path to SQLite database")
	oldKey := fs.String("old-key", "", "existing master key (or set PIPEWARDEN_VAULT_KEY_OLD)")
	newKey := fs.String("new-key", "", "replacement master key (or set PIPEWARDEN_VAULT_KEY_NEW)")
	dryRun := fs.Bool("dry-run", false, "decrypt + re-encrypt in memory but write nothing back")
	force := fs.Bool("force", false, "skip the running-server check (NOT recommended)")
	port := fs.Int("port", 8080, "expected server port; abort if a process is listening on this port and --force is not set")
	timeout := fs.Duration("timeout", 60*time.Second, "transaction timeout")

	fs.Usage = func() {
		fmt.Fprintln(os.Stderr, "Usage: pipewarden vault-rotate [flags]")
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintln(os.Stderr, "Re-encrypts every PipeWarden-vault credential from OLD master key to NEW.")
		fmt.Fprintln(os.Stderr, "Stop the server before running. Always pass --dry-run first.")
		fmt.Fprintln(os.Stderr, "")
		fs.PrintDefaults()
	}
	if err := fs.Parse(args); err != nil {
		return 64
	}

	if *oldKey == "" {
		*oldKey = os.Getenv("PIPEWARDEN_VAULT_KEY_OLD")
	}
	if *newKey == "" {
		*newKey = os.Getenv("PIPEWARDEN_VAULT_KEY_NEW")
	}
	if *oldKey == "" || *newKey == "" {
		fmt.Fprintln(os.Stderr, "vault-rotate: both --old-key and --new-key are required (or PIPEWARDEN_VAULT_KEY_OLD / _NEW env vars)")
		return 64
	}
	if *oldKey == *newKey {
		fmt.Fprintln(os.Stderr, "vault-rotate: old and new keys are identical — nothing to do")
		return 64
	}
	if _, err := os.Stat(*dbPath); err != nil {
		fmt.Fprintf(os.Stderr, "vault-rotate: database %q not found: %v\n", *dbPath, err)
		return 66
	}

	if !*force {
		if err := refuseIfServerListening(*port); err != nil {
			fmt.Fprintf(os.Stderr, "vault-rotate: %v\n", err)
			fmt.Fprintln(os.Stderr, "Stop the server first, or pass --force to override.")
			return 65
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	report, err := rotateVault(ctx, *dbPath, *oldKey, *newKey, *dryRun)
	if err != nil {
		fmt.Fprintf(os.Stderr, "vault-rotate: %v\n", err)
		return 1
	}

	mode := "ROTATED"
	if *dryRun {
		mode = "DRY-RUN"
	}
	fmt.Printf("vault-rotate: %s — connections=%d webhooks=%d errors=%d duration=%s\n",
		mode, report.Connections, report.Webhooks, len(report.Errors), report.Elapsed)
	for _, e := range report.Errors {
		fmt.Fprintf(os.Stderr, "  ! %s\n", e)
	}
	if len(report.Errors) > 0 {
		return 2
	}
	if *dryRun {
		fmt.Println("vault-rotate: no changes written. Re-run without --dry-run to apply.")
	} else {
		fmt.Println("vault-rotate: update PIPEWARDEN_VAULT_KEY in your env to the NEW value, then restart the server.")
	}
	return 0
}

// rotateReport tells the caller what happened.
type rotateReport struct {
	Connections int
	Webhooks    int
	Errors      []string
	Elapsed     time.Duration
}

// rotateVault opens the DB, walks every encrypted column, and rewrites
// each value from the old key to the new key inside a single
// transaction. Per-row failures are collected; one bad row does not
// abort the others. Returns an error only when the DB itself is
// unusable (open / commit failed).
func rotateVault(ctx context.Context, dbPath, oldKeyHex, newKeyHex string, dryRun bool) (*rotateReport, error) {
	start := time.Now()
	rep := &rotateReport{}

	oldV, err := vault.New(oldKeyHex)
	if err != nil {
		return rep, fmt.Errorf("open OLD vault: %w", err)
	}
	newV, err := vault.New(newKeyHex)
	if err != nil {
		return rep, fmt.Errorf("open NEW vault: %w", err)
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return rep, fmt.Errorf("open db: %w", err)
	}
	defer func() { _ = db.Close() }()
	if err := db.PingContext(ctx); err != nil {
		return rep, fmt.Errorf("ping db: %w", err)
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return rep, fmt.Errorf("begin tx: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	if err := rotateConnections(ctx, tx, oldV, newV, dryRun, rep); err != nil {
		return rep, err
	}
	if err := rotateWebhooks(ctx, tx, oldV, newV, dryRun, rep); err != nil {
		return rep, err
	}

	if dryRun {
		_ = tx.Rollback()
		committed = true // mark so deferred rollback is a no-op
	} else {
		if err := tx.Commit(); err != nil {
			return rep, fmt.Errorf("commit: %w", err)
		}
		committed = true
	}
	rep.Elapsed = time.Since(start)
	return rep, nil
}

// rotateConnections walks the connections table re-encrypting token,
// username, and app_password. The username column doubles as a
// non-secret label on most providers; we still re-encrypt it whenever
// it has been encrypted (heuristic: non-empty AND decodable by the
// old vault).
func rotateConnections(ctx context.Context, tx *sql.Tx, oldV, newV *vault.Vault, dryRun bool, rep *rotateReport) error {
	rows, err := tx.QueryContext(ctx, `SELECT id, token, username, app_password FROM connections`)
	if err != nil {
		// Missing table => nothing to do, not an error.
		if isMissingTableErr(err, "connections") {
			return nil
		}
		return fmt.Errorf("select connections: %w", err)
	}
	type row struct {
		id              int64
		token, user, ap string
	}
	var all []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.id, &r.token, &r.user, &r.ap); err != nil {
			_ = rows.Close()
			return fmt.Errorf("scan connection: %w", err)
		}
		all = append(all, r)
	}
	if err := rows.Close(); err != nil {
		return err
	}

	for _, r := range all {
		newToken, errT := reencrypt(oldV, newV, r.token)
		newUser, errU := reencrypt(oldV, newV, r.user)
		newAP, errA := reencrypt(oldV, newV, r.ap)
		if errT != nil {
			rep.Errors = append(rep.Errors, fmt.Sprintf("connection %d token: %v", r.id, errT))
			continue
		}
		if errU != nil {
			rep.Errors = append(rep.Errors, fmt.Sprintf("connection %d username: %v", r.id, errU))
			continue
		}
		if errA != nil {
			rep.Errors = append(rep.Errors, fmt.Sprintf("connection %d app_password: %v", r.id, errA))
			continue
		}
		if !dryRun {
			if _, err := tx.ExecContext(ctx,
				`UPDATE connections SET token=?, username=?, app_password=? WHERE id=?`,
				newToken, newUser, newAP, r.id,
			); err != nil {
				return fmt.Errorf("update connection %d: %w", r.id, err)
			}
		}
		rep.Connections++
	}
	return nil
}

// rotateWebhooks does the same for webhook_configs.secret.
func rotateWebhooks(ctx context.Context, tx *sql.Tx, oldV, newV *vault.Vault, dryRun bool, rep *rotateReport) error {
	rows, err := tx.QueryContext(ctx, `SELECT name, secret FROM webhook_configs`)
	if err != nil {
		if isMissingTableErr(err, "webhook_configs") {
			return nil
		}
		return fmt.Errorf("select webhook_configs: %w", err)
	}
	type row struct {
		name, secret string
	}
	var all []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.name, &r.secret); err != nil {
			_ = rows.Close()
			return fmt.Errorf("scan webhook: %w", err)
		}
		all = append(all, r)
	}
	if err := rows.Close(); err != nil {
		return err
	}

	for _, r := range all {
		ns, err := reencrypt(oldV, newV, r.secret)
		if err != nil {
			rep.Errors = append(rep.Errors, fmt.Sprintf("webhook %q secret: %v", r.name, err))
			continue
		}
		if !dryRun {
			if _, err := tx.ExecContext(ctx,
				`UPDATE webhook_configs SET secret=? WHERE name=?`,
				ns, r.name,
			); err != nil {
				return fmt.Errorf("update webhook %q: %w", r.name, err)
			}
		}
		rep.Webhooks++
	}
	return nil
}

// reencrypt decrypts a ciphertext under oldV and re-encrypts it under
// newV. Empty input is passed through unchanged so we don't write a
// random nonce over a column that was never used.
func reencrypt(oldV, newV *vault.Vault, ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}
	pt, err := oldV.Decrypt(ciphertext)
	if err != nil {
		return "", fmt.Errorf("decrypt: %w", err)
	}
	out, err := newV.Encrypt(pt)
	if err != nil {
		return "", fmt.Errorf("re-encrypt: %w", err)
	}
	return out, nil
}

// refuseIfServerListening dials 127.0.0.1:<port> with a short timeout.
// If something is on that port we treat it as "server still up" and
// abort — rotating while the server is reading/writing the DB is the
// fastest way to wedge connections mid-flight.
func refuseIfServerListening(port int) error {
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	conn, err := net.DialTimeout("tcp", addr, 250*time.Millisecond)
	if err != nil {
		return nil
	}
	_ = conn.Close()
	return fmt.Errorf("a process is listening on %s — looks like the server is still running", addr)
}

func isMissingTableErr(err error, table string) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "no such table") && strings.Contains(msg, strings.ToLower(table))
}

// resolveAbsoluteDB makes test fixtures less surprising when the
// caller passes a relative path that happens to escape its tmpdir.
func resolveAbsoluteDB(p string) string {
	if filepath.IsAbs(p) {
		return p
	}
	abs, err := filepath.Abs(p)
	if err != nil {
		return p
	}
	return abs
}

// keep the unused-import guard from removing the helper when nothing
// calls it directly in production today — it's used by tests.
var _ = resolveAbsoluteDB
