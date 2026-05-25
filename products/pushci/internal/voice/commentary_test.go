package voice

import (
	"context"
	"errors"
	"strings"
	"testing"
)

type fakeAI struct {
	configured bool
	reply      string
	err        error
}

func (f *fakeAI) IsConfigured() bool { return f.configured }
func (f *fakeAI) AskWithSystem(_ context.Context, _, _ string) (string, error) {
	return f.reply, f.err
}

func TestAICommentary_NotConfigured_ReturnsEmpty(t *testing.T) {
	got := AICommentary(context.Background(), &fakeAI{configured: false}, larryDavid, EventStart, "")
	if got != "" {
		t.Fatalf("expected empty when AI unconfigured; got %q", got)
	}
}

func TestAICommentary_Error_ReturnsEmpty(t *testing.T) {
	f := &fakeAI{configured: true, err: errors.New("boom")}
	if got := AICommentary(context.Background(), f, gilfoyle, EventFail, ""); got != "" {
		t.Fatalf("expected empty on error; got %q", got)
	}
}

func TestAICommentary_ReturnsCleanedLine(t *testing.T) {
	f := &fakeAI{configured: true, reply: `  "Pretty pretty good."  `}
	got := AICommentary(context.Background(), f, larryDavid, EventPass, "")
	if got != "Pretty pretty good." {
		t.Fatalf("expected trimmed/unquoted line; got %q", got)
	}
}

func TestAICommentary_RejectsLongOrMultilineReply(t *testing.T) {
	f := &fakeAI{configured: true, reply: strings.Repeat("x", 500)}
	if got := AICommentary(context.Background(), f, gilfoyle, EventFail, ""); got != "" {
		t.Fatalf("expected reject on >280 chars; got %q", got)
	}
	f.reply = "line one\nline two\nline three"
	if got := AICommentary(context.Background(), f, gilfoyle, EventFail, ""); got != "" {
		t.Fatalf("expected reject on multi-paragraph; got %q", got)
	}
}

func TestNarrator_FallsBackToCannedOnAIEmpty(t *testing.T) {
	n := NewNarrator("larry-david")
	n.Speaker = &captureSpeaker{}
	n.AI = &fakeAI{configured: true, reply: ""} // empty triggers fallback
	n.Event(context.Background(), EventStart)
	got := n.Speaker.(*captureSpeaker).last
	if got == "" {
		t.Fatalf("expected canned-phrase fallback when AI returns empty")
	}
}

type captureSpeaker struct{ last string }

func (c *captureSpeaker) Name() string { return "capture" }
func (c *captureSpeaker) Say(_ context.Context, t string, _ SayOptions) error {
	c.last = t
	return nil
}
