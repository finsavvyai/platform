package ingestion

import (
	"sync"
	"time"
)

// DownloadLimiter enforces a minimum interval between HTTP downloads
// to avoid getting rate-limited by sanctions list providers.
type DownloadLimiter struct {
	mu          sync.Mutex
	minInterval time.Duration
	lastRequest time.Time
}

// NewDownloadLimiter creates a limiter with the given minimum interval.
func NewDownloadLimiter(minInterval time.Duration) *DownloadLimiter {
	return &DownloadLimiter{
		minInterval: minInterval,
	}
}

// Wait blocks until the minimum interval has passed since the last request.
func (l *DownloadLimiter) Wait() {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.lastRequest.IsZero() {
		l.lastRequest = time.Now()
		return
	}

	elapsed := time.Since(l.lastRequest)
	if elapsed < l.minInterval {
		time.Sleep(l.minInterval - elapsed)
	}
	l.lastRequest = time.Now()
}
