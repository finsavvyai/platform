package actions

import "testing"

func TestClassifyMessage_AllBranches(t *testing.T) {
	cases := []struct {
		name  string
		msg   string
		stage string
		want  EventKind
	}{
		{"checkmark success", "✅ Success - Main step", "Main", EventStepSuccess},
		{"text success", "Success - Main step", "", EventStepSuccess},
		{"cross failure", "❌ Failure - Main step", "Main", EventStepFailure},
		{"text failure", "Failure - Main npm test", "", EventStepFailure},
		{"skip emoji", "⏭ skip step", "", EventStepSkipped},
		{"text skipped", "step was skipped", "", EventStepSkipped},
		{"star start", "⭐ Run Main step", "", EventStepStart},
		{"text run", "Run Main step", "", EventStepStart},
		{"job succeeded", "Job succeeded", "", EventJobComplete},
		{"job failed", "Job failed", "", EventJobComplete},
		{"pre stage", "configuring", "Pre", EventLog},
		{"main stage", "doing work", "Main", EventLog},
		{"post stage", "cleaning up", "Post", EventLog},
		{"unknown", "boring info", "", EventLog},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := classifyMessage(tc.msg, tc.stage); got != tc.want {
				t.Errorf("classifyMessage(%q, %q) = %s, want %s", tc.msg, tc.stage, got, tc.want)
			}
		})
	}
}

func TestClassify_DecodesTimestamp(t *testing.T) {
	line := `{"time":"2026-04-11T00:00:00Z","level":"info","msg":"plain"}`
	ev := classify(line)
	if ev.Time.IsZero() {
		t.Error("expected non-zero parsed timestamp")
	}
}

func TestClassify_PrefersRawOverMsg(t *testing.T) {
	line := `{"level":"info","msg":"short","raw_output":"this is the raw output"}`
	ev := classify(line)
	if ev.Message != "this is the raw output" {
		t.Errorf("expected raw_output to win, got %q", ev.Message)
	}
}
