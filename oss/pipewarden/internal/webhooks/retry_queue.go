package webhooks

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"sync"
	"time"

	"go.uber.org/zap"
)

// backoffDurations maps attempt index (0-based) to wait duration before next retry.
var backoffDurations = []time.Duration{
	30 * time.Second,
	60 * time.Second,
	120 * time.Second,
	300 * time.Second,
}

const maxRetries = 4

// retryItem holds a pending webhook delivery and its retry state.
type retryItem struct {
	url        string
	payload    []byte
	secret     string
	attempts   int
	maxRetries int
	nextRetry  time.Time
}

// RetryQueue delivers webhook payloads with exponential-backoff retries.
type RetryQueue struct {
	mu      sync.Mutex
	pending []*retryItem
	client  *http.Client
	logger  *zap.Logger
}

// NewRetryQueue creates a RetryQueue backed by the provided zap logger.
func NewRetryQueue(logger *zap.Logger) *RetryQueue {
	return &RetryQueue{
		client: &http.Client{Timeout: 10 * time.Second},
		logger: logger,
	}
}

// Enqueue schedules a payload for immediate delivery (first attempt is due now).
func (q *RetryQueue) Enqueue(url string, payload []byte, secret string) {
	item := &retryItem{
		url:        url,
		payload:    payload,
		secret:     secret,
		attempts:   0,
		maxRetries: maxRetries,
		nextRetry:  time.Now(),
	}
	q.mu.Lock()
	q.pending = append(q.pending, item)
	q.mu.Unlock()
}

// Start runs a background goroutine that processes due items every 30 seconds.
// It exits when ctx is cancelled.
func (q *RetryQueue) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				q.processDue()
			}
		}
	}()
}

// processDue iterates the pending list, attempting delivery for due items.
func (q *RetryQueue) processDue() {
	now := time.Now()

	q.mu.Lock()
	items := make([]*retryItem, len(q.pending))
	copy(items, q.pending)
	q.mu.Unlock()

	var remaining []*retryItem
	for _, item := range items {
		if item.nextRetry.After(now) {
			remaining = append(remaining, item)
			continue
		}
		delivered := q.process(item)
		if !delivered {
			remaining = append(remaining, item)
		}
	}

	q.mu.Lock()
	q.pending = remaining
	q.mu.Unlock()
}

// process attempts one delivery. Returns true if delivered or permanently dropped.
func (q *RetryQueue) process(item *retryItem) bool {
	item.attempts++

	sig := generateHMAC(item.payload, item.secret)
	req, err := http.NewRequest(http.MethodPost, item.url, bytes.NewReader(item.payload))
	if err != nil {
		q.logger.Warn("retry queue: bad request", zap.String("url", item.url), zap.Error(err))
		return q.handleFailure(item)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-PipeWarden-Signature", sig)

	resp, err := q.client.Do(req)
	if err == nil {
		_ = resp.Body.Close()
	}

	if err == nil && resp.StatusCode >= 200 && resp.StatusCode < 300 {
		q.logger.Info("retry queue: delivered",
			zap.String("url", item.url),
			zap.Int("attempt", item.attempts),
		)
		return true
	}

	q.logger.Warn("retry queue: delivery failed",
		zap.String("url", item.url),
		zap.Int("attempt", item.attempts),
	)
	return q.handleFailure(item)
}

// handleFailure schedules the next retry or drops the item if maxRetries exceeded.
// Returns true (drop) when no more attempts remain.
func (q *RetryQueue) handleFailure(item *retryItem) bool {
	if item.attempts >= item.maxRetries {
		q.logger.Error("retry queue: dropping item after max retries",
			zap.String("url", item.url),
			zap.Int("attempts", item.attempts),
		)
		return true // drop
	}
	idx := item.attempts - 1
	if idx >= len(backoffDurations) {
		idx = len(backoffDurations) - 1
	}
	item.nextRetry = time.Now().Add(backoffDurations[idx])
	return false
}

// generateHMAC computes HMAC-SHA256 for payload using secret.
func generateHMAC(payload []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(payload)
	return hex.EncodeToString(h.Sum(nil))
}
