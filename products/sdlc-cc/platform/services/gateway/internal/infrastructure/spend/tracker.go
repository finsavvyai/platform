// Package spend tracks per-call LLM cost. Every call produces exactly
// one spend_events row with prompt+completion tokens and computed USD
// cost. The tracker writes asynchronously through a buffered channel
// so the request hot path never blocks on the spend INSERT.
//
// Days 28-30 of the production-ready roadmap.
package spend

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Event is the input the tracker accepts; the tracker fills in
// usd_cents from the pricing table.
type Event struct {
	TenantID         uuid.UUID
	UserID           *uuid.UUID
	APIKeyID         *uuid.UUID
	Provider         string
	Model            string
	PromptTokens     int
	CompletionTokens int
	RequestID        string
	OccurredAt       time.Time
}

// Sink persists one Event. Production wires Postgres; tests pass an
// in-memory implementation.
type Sink interface {
	Write(ctx context.Context, ev Event, usdCents int64) error
}

// Pricing answers "how many USD cents does this provider+model cost
// for the given token counts". Lookup is cached for 60s.
type Pricing interface {
	CostCents(ctx context.Context, provider, model string, promptTokens, completionTokens int) (int64, error)
}

// Tracker is the entry point: Record buffers + the drain goroutine
// computes cost + writes to the sink.
type Tracker struct {
	sink    Sink
	pricing Pricing
	buffer  chan Event
	wg      sync.WaitGroup
	closed  chan struct{}
	once    sync.Once
}

// NewTracker starts the drain goroutine. bufferCap=0 applies 1024.
func NewTracker(sink Sink, pricing Pricing, bufferCap int) *Tracker {
	if bufferCap <= 0 {
		bufferCap = 1024
	}
	t := &Tracker{
		sink:    sink,
		pricing: pricing,
		buffer:  make(chan Event, bufferCap),
		closed:  make(chan struct{}),
	}
	t.wg.Add(1)
	go t.drain()
	return t
}

// Record enqueues. Returns ErrBufferFull when saturated; caller can
// pick (drop, log, switch to sync).
func (t *Tracker) Record(ev Event) error {
	if ev.OccurredAt.IsZero() {
		ev.OccurredAt = time.Now()
	}
	select {
	case t.buffer <- ev:
		return nil
	default:
		return ErrBufferFull
	}
}

// ErrBufferFull is returned by Record when the buffer is saturated.
var ErrBufferFull = errors.New("spend: buffer full")

// Close drains the buffer and shuts the tracker down.
func (t *Tracker) Close() {
	t.once.Do(func() {
		close(t.buffer)
		t.wg.Wait()
		close(t.closed)
	})
}

func (t *Tracker) drain() {
	defer t.wg.Done()
	for ev := range t.buffer {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		usd, err := t.pricing.CostCents(ctx, ev.Provider, ev.Model, ev.PromptTokens, ev.CompletionTokens)
		if err == nil {
			_ = t.sink.Write(ctx, ev, usd)
		}
		cancel()
	}
}
