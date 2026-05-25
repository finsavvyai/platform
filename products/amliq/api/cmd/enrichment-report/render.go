package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// render writes the coverage rows in the requested format.
func render(rows []coverageRow, format string) error {
	switch strings.ToLower(format) {
	case "json":
		return json.NewEncoder(os.Stdout).Encode(rows)
	case "md":
		return renderMarkdown(rows)
	default:
		return renderText(rows)
	}
}

func renderText(rows []coverageRow) error {
	fmt.Printf("%-26s %8s  %-27s  %-27s\n",
		"LIST", "N", "CORE (dob/nat/addr/ids/ali)", "TIER2+3 (tier/pos/pob/gen/dt)")
	fmt.Println(strings.Repeat("-", 96))
	for _, r := range rows {
		fmt.Printf("%-26s %8d  %s  %s\n",
			trunc(r.ListID, 26), r.Total,
			coreBar(r), tierBar(r))
	}
	return nil
}

func renderMarkdown(rows []coverageRow) error {
	fmt.Println("| List | N | DOB | Nat | Addr | IDs | Aliases | Tier | Pos | PoB | Gen | DesigDate |")
	fmt.Println("|------|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
	for _, r := range rows {
		fmt.Printf("| %s | %d | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s |\n",
			r.ListID, r.Total,
			pct(r.DOB, r.Total), pct(r.Nat, r.Total), pct(r.Addr, r.Total),
			pct(r.IDs, r.Total), pct(r.Aliases, r.Total), pct(r.PEPTier, r.Total),
			pct(r.PositionTitle, r.Total), pct(r.PlaceOfBirth, r.Total),
			pct(r.Gender, r.Total), pct(r.Designation, r.Total))
	}
	return nil
}

func coreBar(r coverageRow) string {
	return fmt.Sprintf("%3s/%3s/%3s/%3s/%3s",
		pct(r.DOB, r.Total), pct(r.Nat, r.Total),
		pct(r.Addr, r.Total), pct(r.IDs, r.Total),
		pct(r.Aliases, r.Total))
}

func tierBar(r coverageRow) string {
	return fmt.Sprintf("%3s/%3s/%3s/%3s/%3s",
		pct(r.PEPTier, r.Total), pct(r.PositionTitle, r.Total),
		pct(r.PlaceOfBirth, r.Total), pct(r.Gender, r.Total),
		pct(r.Designation, r.Total))
}

func pct(n, total int) string {
	if total == 0 {
		return "-"
	}
	p := (n * 100) / total
	return fmt.Sprintf("%d%%", p)
}

func trunc(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "..."
}
