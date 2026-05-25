package main

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
)

// errStopIteration short-circuits the streaming parser when
// --max-records is hit. Distinguished from real errors at the
// call site so smoke-test returns exit 0.
var errStopIteration = errors.New("stop iteration: max-records reached")

// runGolden downloads the Golden Copy ZIP, locates the XML entry,
// and streams it through the parser. Upserts are batched under
// __global__ so peak heap stays bounded by `batch * entity_size`.
func runGolden(
	ctx context.Context, d deps, url string, batch int, dryRun bool,
	maxRecords int,
) (runStats, error) {
	var s runStats
	log.Printf("fetching Golden Copy: %s", url)
	path, _, err := d.fetcher.FetchToDisk(url)
	if err != nil {
		return s, fmt.Errorf("fetch: %w", err)
	}
	defer os.Remove(path)
	info, err := os.Stat(path)
	if err != nil {
		return s, fmt.Errorf("stat: %w", err)
	}
	log.Printf("downloaded %d bytes", info.Size())

	zr, err := zip.OpenReader(path)
	if err != nil {
		return s, fmt.Errorf("zip open: %w", err)
	}
	defer zr.Close()

	var xmlFile *zip.File
	for _, f := range zr.File {
		if strings.HasSuffix(strings.ToLower(f.Name), ".xml") {
			xmlFile = f
			break
		}
	}
	if xmlFile == nil {
		return s, fmt.Errorf("no .xml entry in zip")
	}
	log.Printf("extracting %s (%d bytes uncompressed)",
		xmlFile.Name, xmlFile.UncompressedSize64)

	return runXMLStream(ctx, d, xmlFile, batch, dryRun, maxRecords)
}
