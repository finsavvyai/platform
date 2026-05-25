package actions

import (
	"strings"
	"testing"
)

func TestClassify_NonJSONLineFallsThroughAsLog(t *testing.T) {
	ev := classify("plain log line without JSON")
	if ev.Kind != EventLog {
		t.Errorf("expected EventLog, got %s", ev.Kind)
	}
	if ev.Message != "plain log line without JSON" {
		t.Errorf("message should preserve original, got %q", ev.Message)
	}
}

func TestClassify_MalformedJSONFallsThroughAsLog(t *testing.T) {
	ev := classify(`{"this is not": valid json`)
	if ev.Kind != EventLog {
		t.Errorf("expected EventLog for malformed JSON, got %s", ev.Kind)
	}
}

func TestClassify_StepSuccessFromEmoji(t *testing.T) {
	line := `{"time":"2026-04-11T00:00:00Z","level":"info","msg":"  ✅  Success - Main actions/checkout@v4 [10ms]","jobID":"build","stepID":"checkout","stage":"Main"}`
	ev := classify(line)
	if ev.Kind != EventStepSuccess {
		t.Errorf("expected EventStepSuccess, got %s (msg=%q)", ev.Kind, ev.Message)
	}
	if ev.Job != "build" {
		t.Errorf("expected job=build, got %q", ev.Job)
	}
}

func TestClassify_StepFailureFromEmoji(t *testing.T) {
	line := `{"level":"error","msg":"  ❌  Failure - Main npm test","jobID":"test","stepID":"test"}`
	ev := classify(line)
	if ev.Kind != EventStepFailure {
		t.Errorf("expected EventStepFailure, got %s", ev.Kind)
	}
}

func TestClassify_JobCompleteFromMessage(t *testing.T) {
	line := `{"level":"info","msg":"Job succeeded"}`
	ev := classify(line)
	if ev.Kind != EventJobComplete {
		t.Errorf("expected EventJobComplete, got %s", ev.Kind)
	}
}

func TestClassify_StepStartFromStar(t *testing.T) {
	line := `{"level":"info","msg":"⭐ Run Main actions/checkout@v4","jobID":"build","stepID":"checkout"}`
	ev := classify(line)
	if ev.Kind != EventStepStart {
		t.Errorf("expected EventStepStart, got %s", ev.Kind)
	}
}

func TestParseStream_EmitsAllLines(t *testing.T) {
	input := strings.Join([]string{
		"raw human line",
		`{"level":"info","msg":"⭐ Run Main step1","jobID":"build"}`,
		`{"level":"info","msg":"  ✅  Success - Main step1","jobID":"build"}`,
		`{"level":"info","msg":"Job succeeded"}`,
	}, "\n")
	ch := ParseStream(strings.NewReader(input))

	var got []Event
	for ev := range ch {
		got = append(got, ev)
	}
	if len(got) != 4 {
		t.Fatalf("expected 4 events, got %d", len(got))
	}
	if got[0].Kind != EventLog {
		t.Errorf("first event should be raw log, got %s", got[0].Kind)
	}
	if got[1].Kind != EventStepStart {
		t.Errorf("second event should be StepStart, got %s", got[1].Kind)
	}
	if got[2].Kind != EventStepSuccess {
		t.Errorf("third event should be StepSuccess, got %s", got[2].Kind)
	}
	if got[3].Kind != EventJobComplete {
		t.Errorf("fourth event should be JobComplete, got %s", got[3].Kind)
	}
}

func TestParseStream_HandlesEmptyInput(t *testing.T) {
	ch := ParseStream(strings.NewReader(""))
	count := 0
	for range ch {
		count++
	}
	if count != 0 {
		t.Errorf("empty input should yield zero events, got %d", count)
	}
}

func TestFirstNonEmpty(t *testing.T) {
	if firstNonEmpty("", "", "found") != "found" {
		t.Error("should skip empties")
	}
	if firstNonEmpty("first", "second") != "first" {
		t.Error("should return first non-empty")
	}
	if firstNonEmpty("", "", "") != "" {
		t.Error("all empty should return empty")
	}
}
