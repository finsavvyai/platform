package publisher

import (
	"context"
	"encoding/json"
	"errors"
	"sync/atomic"
	"time"

	"github.com/sdlc-ai/platform/packages/insights-core/types"
)

// Transport is what a JetStream client must satisfy. Decoupled so callers can
// swap in a real nats.JetStreamContext or a test fake.
type Transport interface {
	Publish(ctx context.Context, subject string, data []byte) error
}

// Publisher is non-blocking by default: Emit returns immediately after
// enqueueing; failures increment a counter but never block the hot path.
type Publisher struct {
	t         Transport
	queue     chan envelope
	dropped   atomic.Uint64
	published atomic.Uint64
	failed    atomic.Uint64
}

type envelope struct {
	subject string
	payload []byte
}

type Options struct {
	QueueSize int
}

func New(t Transport, opts Options) *Publisher {
	size := opts.QueueSize
	if size <= 0 {
		size = 1024
	}
	p := &Publisher{t: t, queue: make(chan envelope, size)}
	go p.run()
	return p
}

// Emit enqueues a SignalEvent for publication. Returns immediately. If the
// queue is full the event is dropped and counted; callers must accept loss
// under back-pressure — durability belongs to JetStream once accepted.
func (p *Publisher) Emit(ev types.SignalEvent) error {
	if ev.Source == "" || ev.TenantID == "" {
		return errors.New("publisher: source and tenant_id required")
	}
	b, err := json.Marshal(ev)
	if err != nil {
		return err
	}
	subject := "signals." + string(ev.Source) + "." + ev.EventType
	select {
	case p.queue <- envelope{subject: subject, payload: b}:
		return nil
	default:
		p.dropped.Add(1)
		return errors.New("publisher: queue full")
	}
}

func (p *Publisher) run() {
	for env := range p.queue {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		if err := p.t.Publish(ctx, env.subject, env.payload); err != nil {
			p.failed.Add(1)
		} else {
			p.published.Add(1)
		}
		cancel()
	}
}

// Stats exposes counters for Prometheus wiring by the host service.
type Stats struct {
	Published uint64
	Failed    uint64
	Dropped   uint64
}

func (p *Publisher) Stats() Stats {
	return Stats{
		Published: p.published.Load(),
		Failed:    p.failed.Load(),
		Dropped:   p.dropped.Load(),
	}
}

func (p *Publisher) Close() { close(p.queue) }
