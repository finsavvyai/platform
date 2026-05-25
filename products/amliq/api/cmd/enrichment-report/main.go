// Command enrichment-report queries the live entities table and
// prints a per-list coverage table for the first-class enrichment
// columns (DOB, Nationalities, Addresses, Identifiers, Aliases, and
// the Tier 2+3 additions: pep_tier, position_title, place_of_birth,
// gender, designation_date).
//
// Meant for ad-hoc runs ("what does our enrichment look like today?"
// before/after a parser change or a reingest). Lives in cmd/ so it
// can be built into its own Render job on demand.
//
// Usage:
//
//	DATABASE_URL=... go run ./cmd/enrichment-report
//	DATABASE_URL=... go run ./cmd/enrichment-report --tenant tnt_xxx
//	DATABASE_URL=... go run ./cmd/enrichment-report --format json
package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	var (
		tenantID = flag.String("tenant", "", "optional tenant filter (e.g. tnt_xxx, __global__)")
		format   = flag.String("format", "text", "output format: text | json | md")
		minRows  = flag.Int("min-rows", 1, "skip lists with fewer rows than this")
	)
	flag.Parse()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("enrichment-report: DATABASE_URL required")
	}
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("open: %v", err)
	}
	defer db.Close()

	rows, err := queryCoverage(db, *tenantID, *minRows)
	if err != nil {
		log.Fatalf("query: %v", err)
	}
	if err := render(rows, *format); err != nil {
		log.Fatalf("render: %v", err)
	}
	fmt.Fprintf(os.Stderr, "\nenrichment-report: %d lists\n", len(rows))
}
