package server

import (
	"testing"
	"time"

	"github.com/queryflux/backend/internal/application/services/query"
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Test that mapQueryResultToResponse correctly maps a runner result onto
// the wire-shape QueryResponse. This is the join-point that every HTTP
// success path traverses; regressions here silently break the frontend.
func TestMapQueryResultToResponse_RowsAndCount(t *testing.T) {
	result := &types.QueryResult{
		Rows: []map[string]interface{}{
			{"id": 1, "name": "alice"},
			{"id": 2, "name": "bob"},
		},
		Count:         2,
		ExecutionTime: 17,
	}

	got := mapQueryResultToResponse("conn-1", "SELECT 1", result, 25*time.Millisecond)

	if got.ConnectionID != "conn-1" {
		t.Fatalf("ConnectionID = %q, want conn-1", got.ConnectionID)
	}
	if got.RowCount != 2 {
		t.Fatalf("RowCount = %d, want 2", got.RowCount)
	}
	if got.Duration != 25 {
		t.Fatalf("Duration = %d, want 25", got.Duration)
	}
	if got.Status != entities.QueryStatusCompleted {
		t.Fatalf("Status = %q, want %q", got.Status, entities.QueryStatusCompleted)
	}
	if len(got.Results) != 2 {
		t.Fatalf("Results = %d rows, want 2", len(got.Results))
	}
}

// Test that mapQueryResultToResponse tolerates a nil result without
// panicking (sentinel-wrapped errors return nil result).
func TestMapQueryResultToResponse_NilResult(t *testing.T) {
	got := mapQueryResultToResponse("c", "S", nil, 0)
	if got.ConnectionID != "c" {
		t.Fatalf("ConnectionID = %q", got.ConnectionID)
	}
	if got.RowCount != 0 || len(got.Results) != 0 {
		t.Fatal("expected zero rows for nil result")
	}
}

// Test that a SafeQueryRunner is constructible with the in-memory audit
// logger used by the server bootstrap. This guards against accidental
// renaming/removal of the runner constructor exported symbol.
func TestRunner_ConstructibleWithInMemoryAudit(t *testing.T) {
	runner := query.NewSafeQueryRunner(query.NewInMemoryAuditLogger())
	if runner == nil {
		t.Fatal("NewSafeQueryRunner returned nil")
	}
}

// Test errCodeForStatus returns stable codes for the sentinel-mapped
// HTTP statuses defined in MapAdapterErrorToHTTP.
func TestErrCodeForStatus_Mapping(t *testing.T) {
	cases := map[int]string{
		400: ErrCodeInvalidInput,
		401: ErrCodeUnauthorized,
		403: ErrCodeForbidden,
		404: ErrCodeNotFound,
		503: ErrCodeServiceUnavailable,
		504: ErrCodeTimeout,
		500: ErrCodeInternalError,
	}
	for status, want := range cases {
		got := errCodeForStatus(status)
		if got != want {
			t.Errorf("errCodeForStatus(%d) = %q, want %q", status, got, want)
		}
	}
}
