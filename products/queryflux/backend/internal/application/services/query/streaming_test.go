package query

import (
	"context"
	"errors"
	"testing"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

func TestStream_ChunksAndCaps(t *testing.T) {
	adapter := &fakeAdapter{
		stream: func(ctx context.Context, sql string, _ ...interface{}) (<-chan StreamRow, <-chan error) {
			rows := make(chan StreamRow, 20)
			errs := make(chan error, 1)
			go func() {
				defer close(rows)
				defer close(errs)
				for i := 0; i < 20; i++ {
					rows <- StreamRow{Columns: []string{"i"}, Values: []interface{}{i}, Index: int64(i)}
				}
				errs <- nil
			}()
			return rows, errs
		},
	}
	r := NewSafeQueryRunner(nil)
	chunks, errs := r.Stream(context.Background(), adapter, "SELECT 1", nil, QueryOptions{BatchSize: 5, MaxRows: 12})

	total := 0
	final := false
	for c := range chunks {
		total += len(c.Rows)
		if c.Final {
			final = true
		}
	}
	if err := <-errs; err != nil && !errors.Is(err, types.ErrMaxRows) {
		t.Fatalf("expected nil or ErrMaxRows, got %v", err)
	}
	if total > 12 {
		t.Fatalf("expected at most 12 rows, got %d", total)
	}
	if !final {
		t.Fatal("expected a final chunk")
	}
}

func TestStream_ValidationRejects(t *testing.T) {
	adapter := &fakeAdapter{stream: func(context.Context, string, ...interface{}) (<-chan StreamRow, <-chan error) {
		t.Fatal("adapter.Stream should not be called on invalid input")
		return nil, nil
	}}
	r := NewSafeQueryRunner(nil)
	chunks, errs := r.Stream(context.Background(), adapter, "", nil, QueryOptions{})
	if _, ok := <-chunks; ok {
		t.Fatal("expected closed chunks channel")
	}
	if err := <-errs; !errors.Is(err, types.ErrInvalidParam) {
		t.Fatalf("expected ErrInvalidParam, got %v", err)
	}
}
