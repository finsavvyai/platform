// Package alerting fans out list-sync failures to configured channels.
package alerting

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// Channel delivers one alert via a single transport (email, Slack,
// WhatsApp, audit_events, …).
type Channel interface {
	Send(ctx context.Context, a domain.ListSyncAudit) error
	Name() string
}

// ListSyncAlerter composes channels + debounces repeated failures.
// Debounce window: 1 alert per (list_id, status) per debounceEvery.
type ListSyncAlerter struct {
	channels      []Channel
	debounceEvery time.Duration

	mu   sync.Mutex
	sent map[string]time.Time
}

// NewListSyncAlerter wires up the alerter. Channels with nil config
// (e.g. missing RESEND_API_KEY) are expected to be filtered out by
// the caller (see BuildDefaultChannels).
func NewListSyncAlerter(channels []Channel, debounceEvery time.Duration) *ListSyncAlerter {
	if debounceEvery <= 0 {
		debounceEvery = time.Hour
	}
	return &ListSyncAlerter{
		channels:      channels,
		debounceEvery: debounceEvery,
		sent:          make(map[string]time.Time),
	}
}

// Fire fans out to every channel if status is a failure and the
// debounce window has elapsed for (listID, status).
func (a *ListSyncAlerter) Fire(ctx context.Context, audit domain.ListSyncAudit) {
	if !audit.Status.IsFailure() {
		return
	}
	if !a.shouldSend(audit) {
		return
	}
	for _, ch := range a.channels {
		if err := ch.Send(ctx, audit); err != nil {
			log.Printf("alerting: %s send failed (list=%s): %v",
				ch.Name(), audit.ListID, err)
		}
	}
}

func (a *ListSyncAlerter) shouldSend(audit domain.ListSyncAudit) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	key := audit.ListID + "|" + string(audit.Status)
	last, ok := a.sent[key]
	if ok && time.Since(last) < a.debounceEvery {
		return false
	}
	a.sent[key] = time.Now()
	return true
}
