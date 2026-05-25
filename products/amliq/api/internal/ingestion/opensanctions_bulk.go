package ingestion

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"

	"github.com/aegis-aml/aegis/internal/domain"
)

const BulkDataURL = "https://data.opensanctions.org/datasets/latest/default/targets.simple.csv"

// OpenSanctionsBulkParser parses the OpenSanctions simplified CSV
// with JSON properties column for 600K+ entities. Implements both
// Parser (buffered, legacy callers) and StreamParser (row-at-a-time,
// preferred by SyncService for memory-bounded ingest).
type OpenSanctionsBulkParser struct{}

func NewOpenSanctionsBulkParser() *OpenSanctionsBulkParser {
	return &OpenSanctionsBulkParser{}
}

// Parse buffers the whole slice — retained for tests and callers that
// pre-load the payload. Prefer ParseStream on the hot path.
func (p *OpenSanctionsBulkParser) Parse(
	data []byte,
) ([]domain.Entity, error) {
	var out []domain.Entity
	err := p.ParseStream(bytes.NewReader(data), func(e domain.Entity) error {
		out = append(out, e)
		return nil
	})
	return out, err
}

// ParseStream reads CSV rows incrementally from r and emits each
// resulting entity (primary + expanded aliases) through the callback.
// Memory footprint: one CSV record + one domain.Entity at a time.
func (p *OpenSanctionsBulkParser) ParseStream(
	r io.Reader, emit EntityEmitter,
) error {
	reader := csv.NewReader(r)
	headerRow, err := reader.Read()
	if err == io.EOF {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read header: %w", err)
	}
	hdr := buildHeaderIndex(headerRow)
	for {
		rec, err := reader.Read()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read row: %w", err)
		}
		if err := p.emitRow(rec, hdr, emit); err != nil {
			return err
		}
	}
}
