// Package webhooks — retrier with backoff schedule and DLQ handoff.
//
// Backoff: 30s / 2m / 10m / 1h / 4h (5 attempts) before DLQ.
//
// Deliver POSTs the payload with the supplied signature header and
// retries on 5xx + network errors. 4xx is treated as a permanent
// failure and routed straight to DLQ — there is no value in replaying
// a request the receiver explicitly rejected.
package webhooks

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Endpoint is the destination for one outbound webhook.
type Endpoint struct {
	ID       string // tenant-scoped endpoint id (for DLQ correlation)
	URL      string
	TenantID string
}

// DLQ is the persistence seam used when delivery exhausts retries.
type DLQ interface {
	Push(ctx context.Context, e DLQEntry) error
}

// DLQEntry is one failed-delivery record.
type DLQEntry struct {
	EndpointID string
	TenantID   string
	URL        string
	Payload    []byte
	Headers    SignedHeaders
	Attempts   int
	LastStatus int
	LastError  string
	FailedAt   time.Time
}

// Retrier orchestrates the backoff + DLQ sequence. The Sleep hook lets
// tests collapse the delays; production passes nil for time.Sleep.
type Retrier struct {
	Client *http.Client
	Delays []time.Duration
	DLQ    DLQ
	Sleep  func(time.Duration)
	Now    func() time.Time
}

// NewRetrier returns a Retrier with the canonical 30s/2m/10m/1h/4h schedule.
func NewRetrier(dlq DLQ) *Retrier {
	return &Retrier{
		Client: &http.Client{Timeout: 15 * time.Second},
		Delays: RetryDelays(),
		DLQ:    dlq,
		Sleep:  time.Sleep,
		Now:    time.Now,
	}
}

// ErrPermanent is returned (and routed to DLQ) for 4xx responses.
var ErrPermanent = errors.New("webhooks: permanent delivery failure")

// Deliver POSTs payload to target.URL and retries per the backoff schedule.
// Returns nil on eventual 2xx success, ErrPermanent on 4xx, or the last
// error after MaxAttempts. DLQ.Push is invoked once on terminal failure.
func (r *Retrier) Deliver(ctx context.Context, target Endpoint, payload []byte, h SignedHeaders) error {
	if r.Sleep == nil {
		r.Sleep = time.Sleep
	}
	if r.Now == nil {
		r.Now = time.Now
	}
	if r.Client == nil {
		r.Client = &http.Client{Timeout: 15 * time.Second}
	}
	delays := r.Delays
	if delays == nil {
		delays = RetryDelays()
	}
	maxAttempts := len(delays) // 5 by default

	var lastErr error
	var lastStatus int
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		status, err := r.attempt(ctx, target, payload, h)
		lastStatus = status
		if err == nil {
			return nil
		}
		lastErr = err
		if errors.Is(err, ErrPermanent) {
			return r.routeToDLQ(ctx, target, payload, h, attempt, status, err)
		}
		if attempt < maxAttempts {
			d := delays[attempt-1]
			select {
			case <-ctx.Done():
				return r.routeToDLQ(ctx, target, payload, h, attempt, status, ctx.Err())
			default:
			}
			r.Sleep(d)
		}
	}
	return r.routeToDLQ(ctx, target, payload, h, maxAttempts, lastStatus, lastErr)
}

// attempt does one HTTP POST and classifies the result.
// Returns the status code (or 0 on transport error) and an error.
func (r *Retrier) attempt(ctx context.Context, target Endpoint, payload []byte, h SignedHeaders) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, target.URL, bytes.NewReader(payload))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	SetHeaders(req, h)

	resp, err := r.Client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	switch {
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		return resp.StatusCode, nil
	case resp.StatusCode >= 400 && resp.StatusCode < 500:
		return resp.StatusCode, fmt.Errorf("%w: status %d", ErrPermanent, resp.StatusCode)
	default:
		return resp.StatusCode, fmt.Errorf("transient: status %d", resp.StatusCode)
	}
}

// routeToDLQ pushes a DLQEntry and returns the failure error so the
// caller can log it.
func (r *Retrier) routeToDLQ(
	ctx context.Context,
	target Endpoint,
	payload []byte,
	h SignedHeaders,
	attempt, status int,
	cause error,
) error {
	if r.DLQ == nil {
		return cause
	}
	msg := ""
	if cause != nil {
		msg = cause.Error()
	}
	entry := DLQEntry{
		EndpointID: target.ID,
		TenantID:   target.TenantID,
		URL:        target.URL,
		Payload:    payload,
		Headers:    h,
		Attempts:   attempt,
		LastStatus: status,
		LastError:  msg,
		FailedAt:   r.Now().UTC(),
	}
	if perr := r.DLQ.Push(ctx, entry); perr != nil {
		return fmt.Errorf("delivery failed (%v) and DLQ push failed: %w", cause, perr)
	}
	return cause
}
