package main

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
)

// runXMLStream decodes the LEI-CDF XML inside the given zip entry
// and batch-upserts into __global__. Honours --max-records by
// short-circuiting the parser with errStopIteration.
func runXMLStream(
	ctx context.Context, d deps, xmlFile *zip.File,
	batch int, dryRun bool, maxRecords int,
) (runStats, error) {
	var s runStats
	rc, err := xmlFile.Open()
	if err != nil {
		return s, fmt.Errorf("zip entry open: %w", err)
	}
	defer rc.Close()

	tid := domain.SystemTenantID()
	buf := make([]domain.Entity, 0, batch)

	flush := func() error {
		if len(buf) == 0 || dryRun {
			buf = buf[:0]
			return nil
		}
		if err := d.repo.BulkUpsert(ctx, tid, buf); err != nil {
			s.errors++
			return fmt.Errorf("upsert: %w", err)
		}
		s.batches++
		buf = buf[:0]
		return nil
	}
	emit := func(e domain.Entity) error {
		s.entities++
		buf = append(buf, e)
		if len(buf) >= batch {
			if err := flush(); err != nil {
				return err
			}
		}
		if s.entities%10000 == 0 {
			log.Printf("  progress: entities=%d batches=%d errors=%d",
				s.entities, s.batches, s.errors)
		}
		if maxRecords > 0 && s.entities >= maxRecords {
			return errStopIteration
		}
		return nil
	}
	if err := d.parser.ParseStream(rc, emit); err != nil {
		if !errors.Is(err, errStopIteration) {
			return s, fmt.Errorf("parse: %w", err)
		}
	}
	if err := flush(); err != nil {
		return s, err
	}
	return s, nil
}
