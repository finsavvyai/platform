package debug

import "testing"

func TestContinueResumes(t *testing.T) {
	dr := NewDebugRunner()
	// Simulate: breakpoint signals pause, then continue resumes
	done := make(chan bool, 1)
	go func() {
		dr.WaitForPause()
		state := dr.Inspect()
		if !state.Paused {
			t.Error("expected paused state")
		}
		dr.Continue()
		done <- true
	}()

	// Simulate runner hitting breakpoint
	dr.state.Paused = true
	dr.pause <- struct{}{}
	<-dr.resume
	dr.state.Paused = false

	<-done
	if dr.Inspect().Paused {
		t.Error("should not be paused after continue")
	}
}

func TestDebugStateZeroValue(t *testing.T) {
	var s DebugState
	if s.Paused {
		t.Error("zero DebugState should not be paused")
	}
	if s.Current != "" {
		t.Error("zero DebugState.Current should be empty")
	}
	if s.Completed != nil {
		t.Error("zero DebugState.Completed should be nil")
	}
	if s.Env != nil {
		t.Error("zero DebugState.Env should be nil")
	}
}
