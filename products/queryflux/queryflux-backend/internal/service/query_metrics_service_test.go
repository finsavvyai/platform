package service

import (
	"testing"
)

func TestQueryMetricsService_EmptySnapshot(t *testing.T) {
	svc := NewQueryMetricsService(0)
	snap := svc.Snapshot()

	if snap.TotalQueries != 0 {
		t.Errorf("expected 0 total queries, got %d", snap.TotalQueries)
	}
	if snap.P95Ms != 0 {
		t.Errorf("expected 0 P95, got %f", snap.P95Ms)
	}
}

func TestQueryMetricsService_RecordAndSnapshot(t *testing.T) {
	svc := NewQueryMetricsService(100)
	for _, ms := range []float64{10, 20, 30, 40, 50, 60, 70, 80, 90, 100} {
		svc.RecordQuery(ms, false)
	}

	snap := svc.Snapshot()

	if snap.TotalQueries != 10 {
		t.Errorf("expected 10 total queries, got %d", snap.TotalQueries)
	}
	if snap.TotalErrors != 0 {
		t.Errorf("expected 0 errors, got %d", snap.TotalErrors)
	}
	if snap.MaxMs != 100 {
		t.Errorf("expected max 100ms, got %f", snap.MaxMs)
	}
	if snap.AvgMs != 55 {
		t.Errorf("expected avg 55ms, got %f", snap.AvgMs)
	}
}

func TestQueryMetricsService_ErrorTracking(t *testing.T) {
	svc := NewQueryMetricsService(0)
	svc.RecordQuery(50, false)
	svc.RecordQuery(0, true)
	svc.RecordQuery(0, true)

	snap := svc.Snapshot()

	if snap.TotalQueries != 3 {
		t.Errorf("expected 3 total, got %d", snap.TotalQueries)
	}
	if snap.TotalErrors != 2 {
		t.Errorf("expected 2 errors, got %d", snap.TotalErrors)
	}
}

func TestQueryMetricsService_P95(t *testing.T) {
	svc := NewQueryMetricsService(200)
	// Insert 100 samples: 1ms, 2ms, ..., 100ms
	for i := 1; i <= 100; i++ {
		svc.RecordQuery(float64(i), false)
	}

	snap := svc.Snapshot()

	// P95 of 1..100 = index 94 in 0-based sorted array = 95ms
	if snap.P95Ms < 94 || snap.P95Ms > 96 {
		t.Errorf("expected P95 near 95ms, got %f", snap.P95Ms)
	}
}

func TestQueryMetricsService_P99(t *testing.T) {
	svc := NewQueryMetricsService(200)
	for i := 1; i <= 100; i++ {
		svc.RecordQuery(float64(i), false)
	}

	snap := svc.Snapshot()

	// P99 of 1..100 = index 98 = 99ms
	if snap.P99Ms < 98 || snap.P99Ms > 100 {
		t.Errorf("expected P99 near 99ms, got %f", snap.P99Ms)
	}
}

func TestQueryMetricsService_RingBufferWraps(t *testing.T) {
	cap := 10
	svc := NewQueryMetricsService(cap)

	// Fill beyond capacity
	for i := 1; i <= 20; i++ {
		svc.RecordQuery(float64(i), false)
	}

	snap := svc.Snapshot()

	// Ring buffer should hold last `cap` samples
	if snap.SampleCount != cap {
		t.Errorf("expected sample count %d, got %d", cap, snap.SampleCount)
	}
	if snap.TotalQueries != 20 {
		t.Errorf("expected total 20 queries, got %d", snap.TotalQueries)
	}
}

func TestQueryMetricsService_Reset(t *testing.T) {
	svc := NewQueryMetricsService(0)
	svc.RecordQuery(100, false)
	svc.RecordQuery(200, true)

	svc.Reset()
	snap := svc.Snapshot()

	if snap.TotalQueries != 0 {
		t.Errorf("expected 0 after reset, got %d", snap.TotalQueries)
	}
	if snap.SampleCount != 0 {
		t.Errorf("expected 0 samples after reset, got %d", snap.SampleCount)
	}
}

func TestQueryMetricsService_UptimePositive(t *testing.T) {
	svc := NewQueryMetricsService(0)
	snap := svc.Snapshot()

	if snap.UptimeSeconds < 0 {
		t.Errorf("expected non-negative uptime, got %f", snap.UptimeSeconds)
	}
}
