package main

import (
	"context"
	"flag"
	"log"
	"os"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
)

// Reingest CLI: force a full re-fetch + re-upsert of sanctions lists
// so already-ingested entities pick up newly extracted fields
// (passport, position, dataset, programs, first_seen, last_change, ...).
//
// Usage:
//
//	reingest                         # all tenants, all enabled lists
//	reingest --list ofac-sdn         # one list across all tenants
//	reingest --tenant tnt_abc123... --list un
//	reingest --dry-run               # parse only, skip DB writes
func main() {
	listID := flag.String("list", "",
		"Reingest only this list ID (default: all enabled lists)")
	tenantArg := flag.String("tenant", "",
		"Reingest only for this tenant ID (default: all non-suspended tenants)")
	dryRun := flag.Bool("dry-run", false,
		"Parse but do not write to the database")
	flag.Parse()

	ctx := context.Background()
	deps, err := buildReingestDeps()
	if err != nil {
		log.Fatalf("reingest: setup: %v", err)
	}
	defer deps.close()

	opts := ingestion.ReingestOptions{
		ListID: *listID,
		DryRun: *dryRun,
	}
	if *tenantArg != "" {
		tid, err := domain.NewTenantID(*tenantArg)
		if err != nil {
			log.Fatalf("reingest: invalid tenant id: %v", err)
		}
		opts.TenantID = tid
	}

	n, err := deps.refreshSvc.ReingestAll(ctx, opts)
	if err != nil {
		log.Printf("reingest: completed with errors: %v", err)
		os.Exit(1)
	}
	log.Printf("reingest: done, %d entities re-parsed", n)
}
