// Behavior tests for the D4 drift detector. The math (twoSigma
// deviation + evaluate) is covered first; then a stubbed Reader +
// Dispatcher prove the Tick loop fires webhooks at the right time.
package drift

import (
	"context"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestEvaluate_NormalTrafficNoAlert(t *testing.T) {
	id := uuid.New()
	window := []int{50, 52, 48, 55, 49, 51, 50, 50}
	v := evaluate(id, HourlyCounts{Latest: 50, Window: window}, 2.0)
	if v.Direction != "normal" {
		t.Errorf("normal traffic flagged %s; z=%f", v.Direction, v.ZScore)
	}
}

func TestEvaluate_TwoSigmaSpikeAlerts(t *testing.T) {
	id := uuid.New()
	// Stable baseline ~50, then a 200-detection spike.
	window := []int{50, 52, 48, 55, 49, 51, 50, 200}
	v := evaluate(id, HourlyCounts{Latest: 200, Window: window}, 2.0)
	if v.Direction != "spike" {
		t.Errorf("expected spike; got %s, z=%f", v.Direction, v.ZScore)
	}
	if v.ZScore < 2.0 {
		t.Errorf("z-score should be >= 2.0; got %f", v.ZScore)
	}
}

func TestEvaluate_TwoSigmaCollapseAlerts(t *testing.T) {
	id := uuid.New()
	window := []int{100, 105, 95, 102, 98, 101, 99, 0}
	v := evaluate(id, HourlyCounts{Latest: 0, Window: window}, 2.0)
	if v.Direction != "collapse" {
		t.Errorf("expected collapse; got %s, z=%f", v.Direction, v.ZScore)
	}
	if v.ZScore > -2.0 {
		t.Errorf("z-score should be <= -2.0; got %f", v.ZScore)
	}
}

func TestEvaluate_FlatBaselineWithSpike(t *testing.T) {
	id := uuid.New()
	window := []int{0, 0, 0, 0, 0, 0, 0, 5}
	v := evaluate(id, HourlyCounts{Latest: 5, Window: window}, 2.0)
	if v.Direction != "spike" {
		t.Errorf("expected spike on flat-zero baseline; got %s", v.Direction)
	}
	if !math.IsInf(v.ZScore, 1) {
		t.Errorf("z-score should be +Inf for spike on zero baseline; got %f", v.ZScore)
	}
}

func TestEvaluate_FlatBaselineNoSpike(t *testing.T) {
	id := uuid.New()
	window := []int{42, 42, 42, 42, 42, 42, 42, 42}
	v := evaluate(id, HourlyCounts{Latest: 42, Window: window}, 2.0)
	if v.Direction != "normal" {
		t.Errorf("flat constant baseline should be normal; got %s", v.Direction)
	}
}

// fakeReader provides scripted counts per tenant.
type fakeReader struct {
	tenants []uuid.UUID
	counts  map[uuid.UUID]HourlyCounts
	tickErr error
}

func (f *fakeReader) ActiveTenants(_ context.Context) ([]uuid.UUID, error) {
	if f.tickErr != nil {
		return nil, f.tickErr
	}
	return f.tenants, nil
}

func (f *fakeReader) HourlyCounts(_ context.Context, id uuid.UUID, _ time.Time) (HourlyCounts, error) {
	if c, ok := f.counts[id]; ok {
		return c, nil
	}
	return HourlyCounts{}, errors.New("unknown tenant")
}

// fakeDispatcher captures dispatched events.
type fakeDispatcher struct {
	calls []dispatchCall
}

type dispatchCall struct {
	tenantID uuid.UUID
	event    string
	payload  []byte
}

func (f *fakeDispatcher) Dispatch(_ context.Context, t uuid.UUID, ev string, p []byte) (int, error) {
	f.calls = append(f.calls, dispatchCall{t, ev, p})
	return 1, nil
}

func TestTick_FiresWebhookForSpike(t *testing.T) {
	t1 := uuid.New()
	t2 := uuid.New()
	reader := &fakeReader{
		tenants: []uuid.UUID{t1, t2},
		counts: map[uuid.UUID]HourlyCounts{
			t1: { // spike
				Latest: 200,
				Window: []int{50, 52, 48, 55, 49, 51, 50, 200},
			},
			t2: { // normal
				Latest: 50,
				Window: []int{50, 52, 48, 55, 49, 51, 50, 50},
			},
		},
	}
	disp := &fakeDispatcher{}
	d := NewDetector(reader, disp)
	d.Now = func() time.Time { return time.Date(2026, 5, 1, 12, 0, 0, 0, time.UTC) }

	verdicts, err := d.Tick(context.Background())
	if err != nil {
		t.Fatalf("Tick returned error: %v", err)
	}
	if len(verdicts) != 1 {
		t.Fatalf("expected 1 verdict, got %d", len(verdicts))
	}
	if verdicts[0].TenantID != t1 {
		t.Errorf("verdict tenant = %s, want %s", verdicts[0].TenantID, t1)
	}
	if len(disp.calls) != 1 {
		t.Fatalf("expected 1 webhook dispatch, got %d", len(disp.calls))
	}
	if disp.calls[0].event != "dlp.drift.alert" {
		t.Errorf("event = %q, want dlp.drift.alert", disp.calls[0].event)
	}
	if disp.calls[0].tenantID != t1 {
		t.Errorf("dispatch tenant = %s, want %s", disp.calls[0].tenantID, t1)
	}
}

func TestTick_NoDispatchForNormal(t *testing.T) {
	t1 := uuid.New()
	reader := &fakeReader{
		tenants: []uuid.UUID{t1},
		counts: map[uuid.UUID]HourlyCounts{
			t1: {Latest: 50, Window: []int{50, 50, 50, 50, 50, 50, 50, 50}},
		},
	}
	disp := &fakeDispatcher{}
	d := NewDetector(reader, disp)

	verdicts, _ := d.Tick(context.Background())
	if len(verdicts) != 0 {
		t.Errorf("expected zero verdicts for normal traffic, got %d", len(verdicts))
	}
	if len(disp.calls) != 0 {
		t.Errorf("expected zero dispatches, got %d", len(disp.calls))
	}
}

func TestTick_PropagatesActiveTenantsError(t *testing.T) {
	reader := &fakeReader{tickErr: errors.New("db down")}
	d := NewDetector(reader, &fakeDispatcher{})
	_, err := d.Tick(context.Background())
	if err == nil {
		t.Fatal("expected error when ActiveTenants fails")
	}
}

func TestTick_NilDispatcherIsNoop(t *testing.T) {
	// Dispatcher being nil shouldn't crash the detector — caller may
	// run drift detection in audit-only mode.
	t1 := uuid.New()
	reader := &fakeReader{
		tenants: []uuid.UUID{t1},
		counts: map[uuid.UUID]HourlyCounts{
			t1: {Latest: 200, Window: []int{50, 52, 48, 55, 49, 51, 50, 200}},
		},
	}
	d := NewDetector(reader, nil)
	verdicts, err := d.Tick(context.Background())
	if err != nil {
		t.Fatalf("nil dispatcher should not cause Tick error: %v", err)
	}
	if len(verdicts) != 1 {
		t.Errorf("verdict still returned even without dispatcher; got %d", len(verdicts))
	}
}
