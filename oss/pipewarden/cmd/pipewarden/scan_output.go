package main

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"
)

// severityRank returns a numeric rank for a severity string.
// critical=4, high=3, medium=2, low=1, info/unknown=0.
func severityRank(s string) int {
	switch s {
	case "critical":
		return 4
	case "high":
		return 3
	case "medium":
		return 2
	case "low":
		return 1
	default:
		return 0
	}
}

// meetsThreshold returns true if finding severity is >= the threshold severity.
func meetsThreshold(severity, threshold string) bool {
	if threshold == "all" {
		return true
	}
	return severityRank(severity) >= severityRank(threshold)
}

// printFindingsText prints findings as a formatted table to stdout.
func printFindingsText(findings []interface{}) {
	if len(findings) == 0 {
		fmt.Println("No findings.")
		return
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	_, _ = fmt.Fprintln(w, "SEVERITY\tCATEGORY\tTITLE\tCONNECTION")
	_, _ = fmt.Fprintln(w, "--------\t--------\t-----\t----------")

	for _, raw := range findings {
		m, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}

		severity := stringField(m, "severity")
		category := stringField(m, "category")
		title := stringField(m, "title")
		conn := stringField(m, "connection_name")

		// Truncate long titles for readability
		const maxTitle = 60
		if len(title) > maxTitle {
			title = title[:maxTitle-3] + "..."
		}

		_, _ = fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", severity, category, title, conn)
	}

	_ = w.Flush()
}

// printFindingsJSON prints findings as a pretty-printed JSON array to stdout.
func printFindingsJSON(findings []interface{}) {
	b, err := json.MarshalIndent(findings, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error marshaling findings: %v\n", err)
		return
	}
	fmt.Println(string(b))
}

// stringField safely extracts a string value from a map.
func stringField(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok {
		return ""
	}
	s, _ := v.(string)
	return s
}
