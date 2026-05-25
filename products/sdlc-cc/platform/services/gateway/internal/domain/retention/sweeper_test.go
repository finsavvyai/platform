package retention

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

type fakePurger struct {
	calls   []callRec
	purged  int
	failOn  string
}

type callRec struct {
	tenantID uuid.UUID
	dataType string
	before   time.Time
}

func (f *fakePurger) PurgeBefore(_ context.Context, tID uuid.UUID, dt string, before time.Time) (int, error) {
	f.calls = append(f.calls, callRec{tID, dt, before})
	if dt == f.failOn {
		return 0, errors.New("boom")
	}
	return f.purged, nil
}

func TestSweep_PurgesPastRetention(t *testing.T) {
	tID := uuid.New()
	policies := []Policy{
		{TenantID: tID, DataType: "chat_history", Days: 30},
	}
	purger := &fakePurger{purged: 7}
	s := NewSweeper(func(_ context.Context) ([]Policy, error) { return policies, nil }, purger)
	now := time.Now()
	s.now = func() time.Time { return now }

	n, err := s.Sweep(context.Background())
	if err != nil {
		t.Fatalf("Sweep: %v", err)
	}
	if n != 7 || len(purger.calls) != 1 {
		t.Fatalf("expected 7 rows + 1 call, got n=%d calls=%d", n, len(purger.calls))
	}
	want := now.Add(-30 * 24 * time.Hour)
	if !purger.calls[0].before.Equal(want) {
		t.Fatalf("before window mismatch: %v vs %v", purger.calls[0].before, want)
	}
}

func TestSweep_RespectsLegalHold(t *testing.T) {
	tID := uuid.New()
	hold := time.Now().Add(7 * 24 * time.Hour)
	policies := []Policy{
		{TenantID: tID, DataType: "audit_logs", Days: 365, HoldUntil: &hold},
	}
	purger := &fakePurger{}
	s := NewSweeper(func(_ context.Context) ([]Policy, error) { return policies, nil }, purger)
	if _, err := s.Sweep(context.Background()); err != nil {
		t.Fatalf("Sweep: %v", err)
	}
	if len(purger.calls) != 0 {
		t.Fatalf("legal hold must skip purge, calls=%d", len(purger.calls))
	}
}

func TestSweep_ContinuesPastError(t *testing.T) {
	policies := []Policy{
		{TenantID: uuid.New(), DataType: "chat_history", Days: 30},
		{TenantID: uuid.New(), DataType: "documents", Days: 365},
	}
	purger := &fakePurger{failOn: "chat_history", purged: 5}
	s := NewSweeper(func(_ context.Context) ([]Policy, error) { return policies, nil }, purger)

	n, err := s.Sweep(context.Background())
	if err == nil {
		t.Fatal("error from one purge must surface (joined)")
	}
	if n != 5 {
		t.Fatalf("documents must still purge despite chat_history failure, got %d", n)
	}
}
