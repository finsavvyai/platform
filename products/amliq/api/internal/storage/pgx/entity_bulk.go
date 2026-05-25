package pgx

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

var nonAlpha = regexp.MustCompile(`[^a-zA-Z ]`)

// Batch + parallelism tuned for the starter Postgres plan (1 shared
// CPU, 1GB RAM). Prior values (2000/4 then 500/2) put the DB into
// recovery mode when reingesting lists over ~10K entities. Pinned
// serial for now; bump to 2000/4 when the plan is upgraded.
const (
	batchSize       = 200
	bulkParallelism = 1
	// interBatchPause keeps sustained write load off the starter
	// Postgres plan. Without it lists over ~20K entities trip the
	// plan's OOM ceiling and the DB goes into recovery mid-reingest.
	// Remove when the plan is upgraded.
	interBatchPause = 40 * time.Millisecond
)

// BulkUpsert inserts or updates entities in parallel batches. Each
// batch is an independent INSERT ... ON CONFLICT statement, so this
// trades raw throughput for a small amount of redundant index work
// on overlapping id sets (which BulkUpsert doesn't produce in
// practice — callers pass unique ids).
func (r *EntityRepository) BulkUpsert(
	ctx context.Context,
	tenantID domain.TenantID,
	entities []domain.Entity,
) error {
	if len(entities) == 0 {
		return nil
	}
	// For small slices the goroutine overhead isn't worth it.
	if len(entities) <= batchSize {
		return r.upsertBatch(ctx, tenantID, entities)
	}
	return r.bulkUpsertParallel(ctx, tenantID, entities)
}

func (r *EntityRepository) bulkUpsertParallel(
	ctx context.Context,
	tenantID domain.TenantID,
	entities []domain.Entity,
) error {
	jobs := make(chan []domain.Entity)
	errs := make(chan error, bulkParallelism)
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var wg sync.WaitGroup
	for w := 0; w < bulkParallelism; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for batch := range jobs {
				if err := r.upsertBatch(ctx, tenantID, batch); err != nil {
					errs <- err
					cancel()
					return
				}
			}
		}()
	}

	for i := 0; i < len(entities); i += batchSize {
		end := i + batchSize
		if end > len(entities) {
			end = len(entities)
		}
		if i > 0 && interBatchPause > 0 {
			select {
			case <-ctx.Done():
				close(jobs)
				wg.Wait()
				if err := firstErr(errs); err != nil {
					return err
				}
				return ctx.Err()
			case <-time.After(interBatchPause):
			}
		}
		select {
		case <-ctx.Done():
			close(jobs)
			wg.Wait()
			if err := firstErr(errs); err != nil {
				return err
			}
			return ctx.Err()
		case jobs <- entities[i:end]:
		}
	}
	close(jobs)
	wg.Wait()
	return firstErr(errs)
}

func firstErr(errs chan error) error {
	select {
	case err := <-errs:
		return fmt.Errorf("parallel upsert: %w", err)
	default:
		return nil
	}
}

func (r *EntityRepository) upsertBatch(
	ctx context.Context,
	tenantID domain.TenantID,
	batch []domain.Entity,
) error {
	if len(batch) == 0 {
		return nil
	}
	batch = dedupeByID(batch)
	var sb strings.Builder
	sb.WriteString(bulkInsertHeader)
	cols := bulkEntityCols
	args := make([]interface{}, 0, len(batch)*cols)
	for i, ent := range batch {
		if i > 0 {
			sb.WriteByte(',')
		}
		sb.WriteString(placeholders(i*cols, cols))
		args = append(args, entityArgs(ent, tenantID)...)
	}
	sb.WriteString(bulkOnConflictClause)
	_, err := r.db.ExecContext(ctx, sb.String(), args...)
	return err
}

// dedupeByID lives in entity_bulk_dedupe.go to keep this file under
// the 100-line project rule.
