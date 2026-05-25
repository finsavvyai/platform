package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/aegis-aml/aegis/internal/ingestion"
)

type target struct {
	id     string
	url    string
	parser string
}

func main() {
	targets := []target{
		{"uk_ofsi", "https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv", "uk_ofsi"},
		{"us-bis-denied", "https://data.opensanctions.org/datasets/latest/us_bis_denied/targets.simple.csv", "opensanctions_bulk"},
		{"worldbank-debar", "https://data.opensanctions.org/datasets/latest/worldbank_debarred/targets.simple.csv", "opensanctions_bulk"},
		{"us-sam-exclusions", "https://data.opensanctions.org/datasets/latest/us_sam_exclusions/targets.simple.csv", "opensanctions_bulk"},
		{"au-dfat-direct", "https://data.opensanctions.org/datasets/latest/au_dfat_sanctions/targets.simple.csv", "opensanctions_bulk"},
		{"fbi_most_wanted", "https://api.fbi.gov/@wanted?pageSize=50", "fbi_wanted"},
	}
	tr := ingestion.NewTypeRegistry()
	ingestion.RegisterBulkParsers(tr)
	ingestion.RegisterExtendedParsers(tr)

	client := &http.Client{Timeout: 60 * time.Second}
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	fail := 0
	for _, t := range targets {
		n, err := smoke(ctx, client, tr, t)
		if err != nil {
			fmt.Printf("FAIL %s: %v\n", t.id, err)
			fail++
			continue
		}
		status := "OK"
		if n == 0 {
			status = "WARN (0 entities)"
			fail++
		}
		fmt.Printf("%s %s -> %d entities\n", status, t.id, n)
	}
	if fail > 0 {
		os.Exit(1)
	}
}
