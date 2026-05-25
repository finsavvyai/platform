package cloud

import (
	"testing"
	"time"
)

func TestQueueFIFOOrdering(t *testing.T) {
	q := NewQueue(10)
	ids := []string{"a", "b", "c"}
	for _, id := range ids {
		if err := q.Enqueue(Job{ID: id}); err != nil {
			t.Fatal(err)
		}
	}
	for _, want := range ids {
		got := q.Dequeue(nil, 100*time.Millisecond)
		if got == nil || got.ID != want {
			t.Errorf("got %v, want ID=%q", got, want)
		}
	}
}

func TestDequeueTimeoutReturnsNil(t *testing.T) {
	q := NewQueue(10)
	start := time.Now()
	got := q.Dequeue(nil, 100*time.Millisecond)
	elapsed := time.Since(start)
	if got != nil {
		t.Errorf("expected nil, got %+v", got)
	}
	if elapsed < 90*time.Millisecond {
		t.Errorf("returned too fast: %v", elapsed)
	}
}

func TestCancelRemovesJob(t *testing.T) {
	q := NewQueue(10)
	_ = q.Enqueue(Job{ID: "cancel-me"})
	q.Cancel("cancel-me")
	got := q.Dequeue(nil, 100*time.Millisecond)
	if got != nil {
		t.Errorf("cancelled job should not be dequeued, got %+v", got)
	}
}

func TestPendingCount(t *testing.T) {
	tests := []struct {
		enqueue int
		want    int
	}{
		{0, 0},
		{3, 3},
	}
	for _, tt := range tests {
		q := NewQueue(10)
		for i := 0; i < tt.enqueue; i++ {
			_ = q.Enqueue(Job{ID: string(rune('a' + i))})
		}
		if got := q.Pending(); got != tt.want {
			t.Errorf("enqueued %d: Pending()=%d, want %d", tt.enqueue, got, tt.want)
		}
	}
}

func TestCapacityLimit(t *testing.T) {
	q := NewQueue(2)
	if err := q.Enqueue(Job{ID: "1"}); err != nil {
		t.Fatal(err)
	}
	if err := q.Enqueue(Job{ID: "2"}); err != nil {
		t.Fatal(err)
	}
	err := q.Enqueue(Job{ID: "3"})
	if err == nil {
		t.Fatal("expected error when queue full")
	}
}

func TestDequeueAfterEnqueue(t *testing.T) {
	q := NewQueue(5)
	_ = q.Enqueue(Job{ID: "x", Labels: []string{"linux"}})
	got := q.Dequeue([]string{"linux"}, 50*time.Millisecond)
	if got == nil || got.ID != "x" {
		t.Errorf("expected job x, got %v", got)
	}
	if q.Pending() != 0 {
		t.Error("pending should be 0 after dequeue")
	}
}

func TestNewQueueCapacity(t *testing.T) {
	q := NewQueue(42)
	if q.capacity != 42 {
		t.Errorf("capacity = %d, want 42", q.capacity)
	}
}
