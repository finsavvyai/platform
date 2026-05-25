package observe

import (
	"bytes"
	"encoding/json"
	"testing"
	"time"
)

func TestNewTracer(t *testing.T) {
	tr := NewTracer()
	if tr == nil {
		t.Fatal("NewTracer returned nil")
	}
	if len(tr.Events()) != 0 {
		t.Error("new tracer should have no events")
	}
}

func TestBeginEnd(t *testing.T) {
	tr := NewTracer()
	tr.Begin("lint", "check", 1)
	time.Sleep(time.Millisecond)
	tr.End("lint", "check", 1)

	events := tr.Events()
	if len(events) != 2 {
		t.Fatalf("got %d events, want 2", len(events))
	}
	if events[0].Ph != "B" || events[1].Ph != "E" {
		t.Errorf("phases = %s/%s, want B/E", events[0].Ph, events[1].Ph)
	}
	if events[0].Name != "lint" {
		t.Errorf("name = %s, want lint", events[0].Name)
	}
	if events[1].Ts <= events[0].Ts {
		t.Error("end timestamp should be after begin")
	}
}

func TestComplete(t *testing.T) {
	tr := NewTracer()
	time.Sleep(2 * time.Millisecond)
	tr.Complete("test", "check", 1, 2*time.Millisecond)

	events := tr.Events()
	if len(events) != 1 {
		t.Fatalf("got %d events, want 1", len(events))
	}
	e := events[0]
	if e.Ph != "X" {
		t.Errorf("phase = %s, want X", e.Ph)
	}
	if e.Dur != 2000 {
		t.Errorf("dur = %d, want 2000 microseconds", e.Dur)
	}
	if e.Pid != 1 {
		t.Errorf("pid = %d, want 1", e.Pid)
	}
}

func TestExportJSON(t *testing.T) {
	tr := NewTracer()
	tr.Complete("build", "stage", 1, 5*time.Millisecond)

	var buf bytes.Buffer
	if err := tr.Export(&buf); err != nil {
		t.Fatalf("Export error: %v", err)
	}

	var events []TraceEvent
	if err := json.Unmarshal(buf.Bytes(), &events); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("got %d events, want 1", len(events))
	}
	if events[0].Name != "build" || events[0].Cat != "stage" {
		t.Error("exported event has wrong name/cat")
	}
}

func TestConcurrentAccess(t *testing.T) {
	tr := NewTracer()
	done := make(chan bool, 4)
	for i := 0; i < 4; i++ {
		go func(tid int) {
			tr.Begin("work", "test", tid)
			tr.End("work", "test", tid)
			done <- true
		}(i)
	}
	for i := 0; i < 4; i++ {
		<-done
	}
	if len(tr.Events()) != 8 {
		t.Errorf("got %d events, want 8", len(tr.Events()))
	}
}
