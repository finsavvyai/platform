package actions

import (
	"bufio"
	"io"
	"time"
)

// EventKind classifies a streamed log line. We do not try to enumerate
// every act event type — only the ones the dispatcher and UI care about.
type EventKind string

const (
	EventStepStart   EventKind = "step_start"
	EventStepSuccess EventKind = "step_success"
	EventStepFailure EventKind = "step_failure"
	EventStepSkipped EventKind = "step_skipped"
	EventLog         EventKind = "log"
	EventJobStart    EventKind = "job_start"
	EventJobComplete EventKind = "job_complete"
)

// Event is a single structured entry in the act stream. Raw is the
// original log line; consumers can fall back to it when Kind is EventLog.
type Event struct {
	Kind     EventKind `json:"kind"`
	Time     time.Time `json:"time,omitempty"`
	Job      string    `json:"job,omitempty"`
	Step     string    `json:"step,omitempty"`
	Message  string    `json:"message,omitempty"`
	Level    string    `json:"level,omitempty"`
	Stage    string    `json:"stage,omitempty"`
	Raw      string    `json:"raw,omitempty"`
	Duration string    `json:"duration,omitempty"`
}

// actJSONLine matches the shape act emits with --json. Fields we don't
// consume are decoded into a passthrough so json.Unmarshal stays lenient.
type actJSONLine struct {
	Time    string `json:"time"`
	Level   string `json:"level"`
	Msg     string `json:"msg"`
	JobID   string `json:"jobID"`
	JobName string `json:"jobResult"`
	Job     string `json:"job"`
	Step    string `json:"step"`
	StepID  string `json:"stepID"`
	Stage   string `json:"stage"`
	Raw     string `json:"raw_output"`
}

// ParseStream consumes a reader of act --json output and emits Events on
// the returned channel. The channel is closed when the reader hits EOF
// or returns an error. ParseStream never blocks the producer; it spins
// a goroutine and returns immediately so the caller can range the chan.
func ParseStream(r io.Reader) <-chan Event {
	ch := make(chan Event, 64)
	go func() {
		defer close(ch)
		sc := bufio.NewScanner(r)
		// act lines can be long when an action prints big buffers; bump
		// the scanner buffer well past the 64KB default.
		buf := make([]byte, 0, 1024*1024)
		sc.Buffer(buf, 8*1024*1024)
		for sc.Scan() {
			line := sc.Text()
			ch <- classify(line)
		}
	}()
	return ch
}

// classify, classifyMessage, firstNonEmpty live in output_classify.go.
