// Command keytool is the operator CLI for managing per-tenant API
// keys for sdlc.cc.
//
//	keytool issue --tenant tnt_acme --label "ci-runner"
//	keytool list   --tenant tnt_acme
//	keytool revoke --id 42
//
// Connects to DATABASE_URL. Plaintext is printed once on issue and
// never again — operator must capture it at that moment.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/finsavvyai/sdlc-cc/internal/auth"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}

	pool, err := connect()
	if err != nil {
		fmt.Fprintf(os.Stderr, "connect: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()
	store := auth.NewStore(pool)

	switch os.Args[1] {
	case "issue":
		runIssue(store, os.Args[2:])
	case "list":
		runList(store, os.Args[2:])
	case "revoke":
		runRevoke(store, os.Args[2:])
	default:
		usage()
		os.Exit(2)
	}
}

func runIssue(store *auth.Store, args []string) {
	fs := flag.NewFlagSet("issue", flag.ExitOnError)
	tenant := fs.String("tenant", "", "tenant_id (required)")
	label := fs.String("label", "", "human-readable label (e.g. ci-runner)")
	by := fs.String("by", "ops", "operator who issued this key (audit trail)")
	_ = fs.Parse(args)
	if *tenant == "" {
		fs.Usage()
		os.Exit(2)
	}

	k, err := store.Issue(context.Background(), *tenant, *label, *by, nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "issue: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("⚠ Capture this key NOW — it cannot be recovered after this command exits.")
	fmt.Printf("  id:        %d\n", k.ID)
	fmt.Printf("  tenant:    %s\n", k.TenantID)
	fmt.Printf("  label:     %s\n", k.Label)
	fmt.Printf("  prefix:    %s\n", k.Prefix)
	fmt.Printf("  plaintext: %s\n", k.Plaintext)
}

func runList(store *auth.Store, args []string) {
	fs := flag.NewFlagSet("list", flag.ExitOnError)
	tenant := fs.String("tenant", "", "tenant_id (required)")
	_ = fs.Parse(args)
	if *tenant == "" {
		fs.Usage()
		os.Exit(2)
	}
	keys, err := store.List(context.Background(), *tenant)
	if err != nil {
		fmt.Fprintf(os.Stderr, "list: %v\n", err)
		os.Exit(1)
	}
	if len(keys) == 0 {
		fmt.Println("(no keys)")
		return
	}
	fmt.Printf("%-6s  %-14s  %-30s  %-10s  %s\n",
		"ID", "PREFIX", "LABEL", "STATUS", "CREATED")
	for _, k := range keys {
		status := "active"
		if k.RevokedAt != nil {
			status = "revoked"
		}
		fmt.Printf("%-6d  %-14s  %-30s  %-10s  %s\n",
			k.ID, k.Prefix, truncate(k.Label, 30), status,
			k.CreatedAt.Format(time.RFC3339))
	}
}

func runRevoke(store *auth.Store, args []string) {
	fs := flag.NewFlagSet("revoke", flag.ExitOnError)
	id := fs.Int64("id", 0, "key id to revoke (required)")
	_ = fs.Parse(args)
	if *id == 0 {
		fs.Usage()
		os.Exit(2)
	}
	if err := store.Revoke(context.Background(), *id); err != nil {
		fmt.Fprintf(os.Stderr, "revoke: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("revoked id=%d\n", *id)
}

func usage() {
	fmt.Fprintln(os.Stderr, strings.TrimSpace(`
Usage:
  keytool issue   --tenant <tnt_*> [--label <text>] [--by <operator>]
  keytool list    --tenant <tnt_*>
  keytool revoke  --id <id>

Reads DATABASE_URL from env.
`))
}

func connect() (*pgxpool.Pool, error) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return pgxpool.New(ctx, url)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}
