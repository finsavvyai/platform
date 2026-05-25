package handlers

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// ScanProgressRegistry
// ---------------------------------------------------------------------------

func TestScanProgressRegistry_RegisterAndPublish(t *testing.T) {
	reg := NewScanProgressRegistry()

	ch := reg.Register("run-1")
	require.NotNil(t, ch)

	event := ProgressEvent{Stage: "scanning", Percent: 50, Message: "halfway"}
	reg.Publish("run-1", event)

	select {
	case got := <-ch:
		assert.Equal(t, "scanning", got.Stage)
		assert.Equal(t, 50, got.Percent)
	case <-time.After(100 * time.Millisecond):
		t.Fatal("expected event within timeout")
	}
}

func TestScanProgressRegistry_Complete_ClosesChannel(t *testing.T) {
	reg := NewScanProgressRegistry()
	ch := reg.Register("run-2")

	reg.Complete("run-2")

	// Channel should be closed — reading from it should return immediately.
	select {
	case _, open := <-ch:
		assert.False(t, open, "channel should be closed after Complete")
	case <-time.After(100 * time.Millisecond):
		t.Fatal("expected closed channel within timeout")
	}
}

func TestScanProgressRegistry_Complete_UnknownRunID_Noop(t *testing.T) {
	reg := NewScanProgressRegistry()
	// Completing a non-existent runID must not panic.
	require.NotPanics(t, func() {
		reg.Complete("does-not-exist")
	})
}

func TestScanProgressRegistry_Publish_Unregistered_Noop(t *testing.T) {
	reg := NewScanProgressRegistry()
	// Publishing to an unregistered runID must not panic or block.
	require.NotPanics(t, func() {
		reg.Publish("ghost", ProgressEvent{Stage: "complete"})
	})
}

func TestScanProgressRegistry_PublishFull_DropsEvent(t *testing.T) {
	reg := NewScanProgressRegistry()
	ch := reg.Register("run-full")

	// Fill the channel buffer (capacity is 16).
	for i := 0; i < 20; i++ {
		reg.Publish("run-full", ProgressEvent{Stage: "scanning", Percent: i})
	}

	// Should not block — excess events are silently dropped.
	count := 0
	done := make(chan struct{})
	go func() {
		for range ch {
			count++
		}
		close(done)
	}()

	reg.Complete("run-full")
	<-done

	// At most 16 events should have been received (buffer capacity).
	assert.LessOrEqual(t, count, 16)
}

func TestScanProgressRegistry_MultipleRuns(t *testing.T) {
	reg := NewScanProgressRegistry()

	ch1 := reg.Register("run-a")
	ch2 := reg.Register("run-b")

	reg.Publish("run-a", ProgressEvent{Stage: "done", Percent: 100})
	reg.Publish("run-b", ProgressEvent{Stage: "error", Percent: 0, Error: "timeout"})

	evt1 := <-ch1
	evt2 := <-ch2

	assert.Equal(t, "done", evt1.Stage)
	assert.Equal(t, "error", evt2.Stage)
	assert.Equal(t, "timeout", evt2.Error)
}
