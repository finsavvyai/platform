package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/aegis-aml/aegis/internal/ingestion"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet,
		ingestion.PEPFTMDataURL, nil)
	req.Header.Set("User-Agent", "amliq-ftm-smoke/1.0")
	resp, err := (&http.Client{Timeout: 9 * time.Minute}).Do(req)
	if err != nil {
		fmt.Println("fetch:", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("read:", err)
		os.Exit(1)
	}
	fmt.Printf("fetched %d bytes\n", len(data))

	parser := ingestion.NewOpenSanctionsPEPFTMParser()
	entities, err := parser.Parse(data)
	if err != nil {
		fmt.Println("parse:", err)
		os.Exit(1)
	}

	total := len(entities)
	withDOB := 0
	withNat := 0
	withPos := 0
	for _, e := range entities {
		if e.DOB != nil {
			withDOB++
		}
		if len(e.Nationalities) > 0 {
			withNat++
		}
		if e.PositionTitle != "" {
			withPos++
		}
	}
	fmt.Printf("entities=%d\n", total)
	if total > 0 {
		fmt.Printf("dob=%d (%.1f%%)\n", withDOB, 100*float64(withDOB)/float64(total))
		fmt.Printf("nationality=%d (%.1f%%)\n", withNat, 100*float64(withNat)/float64(total))
		fmt.Printf("position=%d (%.1f%%)\n", withPos, 100*float64(withPos)/float64(total))
	}
}
