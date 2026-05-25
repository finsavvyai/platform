package voice

import (
	"bytes"
	"context"
	"strings"
	"testing"
)

func TestPersonaByName_FallsBackToNarrator(t *testing.T) {
	if got := PersonaByName("does-not-exist"); got.Name != "deadpan-narrator" {
		t.Fatalf("expected fallback to deadpan-narrator; got %q", got.Name)
	}
}

func TestPersonaByName_CaseInsensitive(t *testing.T) {
	// "Curb-Style" must resolve case-insensitively to "curb-style".
	if got := PersonaByName("Curb-Style"); got.Name != "curb-style" {
		t.Fatalf("case-insensitive match failed; got %q", got.Name)
	}
}

func TestLineFor_AllPersonasCoverEveryEvent(t *testing.T) {
	events := []Event{EventStart, EventStage, EventPass, EventFail, EventDeploy, EventRollback}
	for _, p := range builtinPersonas() {
		for _, ev := range events {
			if line := p.LineFor(ev); line == "" {
				t.Errorf("persona %q has no phrase for event %q", p.Name, ev)
			}
		}
	}
}

func TestTextSpeaker_PrintsLineWithPersona(t *testing.T) {
	t.Setenv("PUSHCI_VOICE_OFF", "")
	var buf bytes.Buffer
	s := &textSpeaker{out: &buf}
	if err := s.Say(context.Background(), "hello", SayOptions{VoiceID: "Daniel"}); err != nil {
		t.Fatal(err)
	}
	out := buf.String()
	if !strings.Contains(out, "Daniel") || !strings.Contains(out, "hello") {
		t.Fatalf("expected voice ID + text; got %q", out)
	}
}

func TestMuteEnv_SuppressesOutput(t *testing.T) {
	t.Setenv("PUSHCI_VOICE_OFF", "1")
	var buf bytes.Buffer
	s := &textSpeaker{out: &buf}
	_ = s.Say(context.Background(), "hello", SayOptions{})
	if buf.Len() != 0 {
		t.Fatalf("muted speaker still wrote: %q", buf.String())
	}
}

func TestNarrator_EventNoOpOnUnknownEvent(t *testing.T) {
	n := NewNarrator("deadpan-narrator")
	n.Speaker = &textSpeaker{out: &bytes.Buffer{}}
	n.Event(context.Background(), Event("does-not-exist"))
}
