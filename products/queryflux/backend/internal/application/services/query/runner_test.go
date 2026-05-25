package query

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// fakeAdapter is a minimal ExecuteAdapter / StreamAdapter for tests.
type fakeAdapter struct {
	result *types.QueryResult
	err    error
	delay  time.Duration

	stream func(ctx context.Context, sql string, params ...interface{}) (<-chan StreamRow, <-chan error)
}

func (f *fakeAdapter) ExecuteQuery(ctx context.Context, sql string, params ...interface{}) (*types.QueryResult, error) {
	if f.delay > 0 {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(f.delay):
		}
	}
	if f.err != nil {
		return nil, f.err
	}
	return f.result, nil
}

func (f *fakeAdapter) Stream(ctx context.Context, sql string, params ...interface{}) (<-chan StreamRow, <-chan error) {
	return f.stream(ctx, sql, params...)
}

func TestValidate_RejectsEmpty(t *testing.T) {
	cases := []string{"", "   ", "\n\t"}
	for _, c := range cases {
		if err := Validate(c, nil, QueryOptions{}); !errors.Is(err, types.ErrInvalidParam) {
			t.Fatalf("expected ErrInvalidParam for %q, got %v", c, err)
		}
	}
}

func TestValidate_RejectsMultiStatement(t *testing.T) {
	err := Validate("SELECT 1; DROP TABLE users", nil, QueryOptions{})
	if !errors.Is(err, types.ErrSyntax) {
		t.Fatalf("expected ErrSyntax, got %v", err)
	}
}

func TestValidate_AllowsTrailingSemicolon(t *testing.T) {
	if err := Validate("SELECT 1;", nil, QueryOptions{}); err != nil {
		t.Fatalf("trailing semicolon should be allowed, got %v", err)
	}
}

func TestValidate_PlaceholderCountMismatch(t *testing.T) {
	err := Validate("SELECT * FROM u WHERE id = $1 AND name = $2", []interface{}{1}, QueryOptions{})
	if !errors.Is(err, types.ErrInvalidParam) {
		t.Fatalf("expected ErrInvalidParam, got %v", err)
	}
}

func TestValidate_PlaceholderCountMatches(t *testing.T) {
	if err := Validate("SELECT * FROM u WHERE id = ? AND name = ?", []interface{}{1, "a"}, QueryOptions{}); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

func TestValidate_ReadOnlyRejectsDML(t *testing.T) {
	opts := QueryOptions{ReadOnly: true}
	for _, sql := range []string{"DELETE FROM u", "/* hi */ UPDATE u SET a=1", "  DROP TABLE x"} {
		err := Validate(sql, nil, opts)
		if !errors.Is(err, types.ErrPermission) {
			t.Fatalf("expected ErrPermission for %q, got %v", sql, err)
		}
	}
}

func TestValidate_IgnoresSemicolonInsideString(t *testing.T) {
	if err := Validate("SELECT 'a;b'", nil, QueryOptions{}); err != nil {
		t.Fatalf("string-literal semicolon should not trip validator, got %v", err)
	}
}

func TestRedactString_MasksPassword(t *testing.T) {
	in := "dial error: postgres://u:secret123@host/db?password=hunter2"
	out := RedactString(in)
	if strings.Contains(out, "secret123") || strings.Contains(out, "hunter2") {
		t.Fatalf("redaction failed: %s", out)
	}
}

func TestExecute_NilAdapter(t *testing.T) {
	r := NewSafeQueryRunner(nil)
	_, err := r.Execute(context.Background(), nil, "SELECT 1", nil, QueryOptions{})
	if !errors.Is(err, types.ErrInvalidParam) {
		t.Fatalf("expected ErrInvalidParam, got %v", err)
	}
}

func TestExecute_TruncatesAtMaxRows(t *testing.T) {
	rows := make([]map[string]interface{}, 50)
	for i := range rows {
		rows[i] = map[string]interface{}{"i": i}
	}
	adapter := &fakeAdapter{result: &types.QueryResult{Rows: rows, Count: 50}}
	audit := NewInMemoryAuditLogger()
	r := NewSafeQueryRunner(audit)

	res, err := r.Execute(context.Background(), adapter, "SELECT 1", nil, QueryOptions{MaxRows: 10})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if int64(len(res.Rows)) != 10 {
		t.Fatalf("expected 10 rows, got %d", len(res.Rows))
	}
	if !strings.Contains(res.Query, "[truncated]") {
		t.Fatalf("expected truncation marker, got %q", res.Query)
	}
	if audit.Len() != 1 {
		t.Fatalf("expected one audit entry, got %d", audit.Len())
	}
	if got := audit.Snapshot()[0]; got.RowCount != 10 {
		t.Fatalf("expected audit row count 10, got %d", got.RowCount)
	}
}

func TestExecute_TimeoutPropagates(t *testing.T) {
	adapter := &fakeAdapter{delay: 50 * time.Millisecond}
	r := NewSafeQueryRunner(nil)
	_, err := r.Execute(context.Background(), adapter, "SELECT 1", nil, QueryOptions{Timeout: 5 * time.Millisecond})
	if !errors.Is(err, types.ErrTimeout) {
		t.Fatalf("expected ErrTimeout, got %v", err)
	}
}

func TestExecute_AuditCapturesError(t *testing.T) {
	adapter := &fakeAdapter{err: errors.New("driver boom password=hunter2")}
	audit := NewInMemoryAuditLogger()
	r := NewSafeQueryRunner(audit)

	_, err := r.Execute(context.Background(), adapter, "SELECT 1", nil, QueryOptions{ConnectionID: "c1", UserID: "u1"})
	if err == nil {
		t.Fatal("expected error")
	}
	if strings.Contains(err.Error(), "hunter2") {
		t.Fatalf("password leaked through redaction: %s", err.Error())
	}
	entries := audit.Snapshot()
	if len(entries) != 1 {
		t.Fatalf("expected one entry, got %d", len(entries))
	}
	if entries[0].ConnectionID != "c1" || entries[0].UserID != "u1" {
		t.Fatalf("audit fields mismatch: %+v", entries[0])
	}
	if entries[0].QueryHash == "" {
		t.Fatal("expected query hash")
	}
}

func TestClassifyError(t *testing.T) {
	cases := map[error]string{
		nil:                 "",
		types.ErrTimeout:    "timeout",
		types.ErrAuthFail:   "auth",
		types.ErrSyntax:     "syntax",
		types.ErrPermission: "permission",
		errors.New("boom"):  "unknown",
	}
	for err, want := range cases {
		if got := classifyError(err); got != want {
			t.Fatalf("classifyError(%v) = %q, want %q", err, got, want)
		}
	}
}
