package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"time"
)

func main() {
	inFile := flag.String("in", "/tmp/entities_export.csv", "Input CSV")
	outFile := flag.String("out", "/tmp/fingerprints.csv", "Output CSV")
	flag.Parse()

	start := time.Now()
	n, err := generateCSV(*inFile, *outFile)
	if err != nil {
		log.Fatalf("ERROR: %v", err)
	}
	log.Printf("Generated %d fingerprints in %v", n, time.Since(start))
}

func generateCSV(inPath, outPath string) (int, error) {
	in, err := os.Open(inPath)
	if err != nil {
		return 0, fmt.Errorf("open input: %w", err)
	}
	defer in.Close()

	out, err := os.Create(outPath)
	if err != nil {
		return 0, fmt.Errorf("create output: %w", err)
	}
	defer out.Close()

	return processEntities(in, out)
}
