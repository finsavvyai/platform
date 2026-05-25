package publisher

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/sdlc-ai/platform/packages/insights-core/types"
)

type fakeTransport struct {
	mu       sync.Mutex
	subjects []string
	fail     bool
}

func (f *fakeTransport) Publish(_ context.Context, subject string, _ []byte) error {
	if f.fail {
		return errors.New("boom")
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.subjects = append(f.subjects, subject)
	return nil
}

func TestEmitPublishesOnCorrectSubject(t *testing.T) {
	ft := &fakeTransport{}
	p := New(ft, Options{QueueSize: 4})
	defer p.Close()

	err := p.Emit(types.SignalEvent{
		TenantID: "t", Source: types.SourceLLMGateway, EventType: "request",
	})
	if err != nil {
		t.Fatal(err)
	}
	waitForStat(t, p, func(s Stats) bool { return s.Published == 1 })
	ft.mu.Lock()
	defer ft.mu.Unlock()
	if len(ft.subjects) != 1 || ft.subjects[0] != "signals.llm_gateway.request" {
		t.Fatalf("subjects: %v", ft.subjects)
	}
}

func TestEmitRejectsMissingFields(t *testing.T) {
	p := New(&fakeTransport{}, Options{})
	defer p.Close()
	if err := p.Emit(types.SignalEvent{}); err == nil {
		t.Fatal("expected error")
	}
}

func TestEmitDropsOnFullQueue(t *testing.T) {
	slow := &slowTransport{hold: make(chan struct{})}
	p := New(slow, Options{QueueSize: 1})
	defer func() { close(slow.hold); p.Close() }()

	for i := 0; i < 10; i++ {
		_ = p.Emit(types.SignalEvent{
			TenantID: "t", Source: types.SourceDLP, EventType: "hit",
		})
	}
	waitForStat(t, p, func(s Stats) bool { return s.Dropped >= 1 })
}

type slowTransport struct {
	hold  chan struct{}
	calls atomic.Int64
}

func (s *slowTransport) Publish(_ context.Context, _ string, _ []byte) error {
	s.calls.Add(1)
	<-s.hold
	return nil
}

func waitForStat(t *testing.T, p *Publisher, ok func(Stats) bool) {
	t.Helper()
	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) {
		if ok(p.Stats()) {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("timed out; stats=%+v", p.Stats())
}
