package actions

import (
	"encoding/json"
	"strings"
	"time"
)

// classify converts a single raw line into an Event. JSON lines are
// parsed; non-JSON lines fall through as EventLog.
func classify(line string) Event {
	trim := strings.TrimSpace(line)
	if !strings.HasPrefix(trim, "{") {
		return Event{Kind: EventLog, Raw: line, Message: line}
	}
	var j actJSONLine
	if err := json.Unmarshal([]byte(trim), &j); err != nil {
		return Event{Kind: EventLog, Raw: line, Message: line}
	}
	ts, _ := time.Parse(time.RFC3339Nano, j.Time)
	step := firstNonEmpty(j.Step, j.StepID)
	job := firstNonEmpty(j.Job, j.JobID)
	msg := j.Msg
	if j.Raw != "" {
		msg = j.Raw
	}
	kind := classifyMessage(msg, j.Stage)
	return Event{
		Kind:    kind,
		Time:    ts,
		Job:     job,
		Step:    step,
		Stage:   j.Stage,
		Level:   j.Level,
		Message: msg,
		Raw:     line,
	}
}

// classifyMessage uses act's well-known prefix vocabulary to map a log
// line into a structured event kind.
func classifyMessage(msg, stage string) EventKind {
	low := strings.ToLower(msg)
	switch {
	case strings.Contains(msg, "✅") || strings.Contains(low, "success - "):
		return EventStepSuccess
	case strings.Contains(msg, "❌") || strings.Contains(low, "failure - "):
		return EventStepFailure
	case strings.Contains(msg, "⏭") || strings.Contains(low, "skipped"):
		return EventStepSkipped
	case strings.Contains(msg, "⭐") || strings.Contains(low, "run "):
		return EventStepStart
	case strings.Contains(low, "job succeeded") || strings.Contains(low, "job failed"):
		return EventJobComplete
	case stage == "Pre" || stage == "Main" || stage == "Post":
		return EventLog
	}
	return EventLog
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
