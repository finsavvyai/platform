// Package observability provides opt-in Langfuse tracing for LLM calls.
//
// All configuration is read from env vars, making it safe to import and
// instantiate unconditionally:
//
//	LANGFUSE_ENABLED     = "true" | "false"  (default: false)
//	LANGFUSE_HOST        = base URL (default: https://cloud.langfuse.com)
//	LANGFUSE_PUBLIC_KEY  = public key
//	LANGFUSE_SECRET_KEY  = secret key
//
// Events are batched and flushed every 5 seconds or when 100 events are
// queued, whichever comes first. When disabled, every method is a no-op.
package observability

import (
	"context"
	"encoding/base64"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

const (
	defaultLangfuseHost = "https://cloud.langfuse.com"
	ingestionPath       = "/api/public/ingestion"
	flushInterval       = 5 * time.Second
	maxBatchSize        = 100
	httpTimeout         = 10 * time.Second
)

// LangfuseClient batches and ships generation events to a Langfuse backend.
type LangfuseClient struct {
	enabled   bool
	host      string
	publicKey string
	secretKey string
	authToken string

	httpClient *http.Client
	logger     *logrus.Logger

	mu     sync.Mutex
	buffer []ingestionEvent
	stopCh chan struct{}
	wg     sync.WaitGroup
	closed bool
}

// NewLangfuseClient reads env vars and returns a client. The returned client
// is always non-nil; when disabled every method is a no-op.
func NewLangfuseClient(logger *logrus.Logger) *LangfuseClient {
	if logger == nil {
		logger = logrus.New()
	}
	enabled := isTruthy(os.Getenv("LANGFUSE_ENABLED"))
	publicKey := os.Getenv("LANGFUSE_PUBLIC_KEY")
	secretKey := os.Getenv("LANGFUSE_SECRET_KEY")
	host := strings.TrimRight(os.Getenv("LANGFUSE_HOST"), "/")
	if host == "" {
		host = defaultLangfuseHost
	}

	c := &LangfuseClient{
		host:       host,
		publicKey:  publicKey,
		secretKey:  secretKey,
		httpClient: &http.Client{Timeout: httpTimeout},
		logger:     logger,
		stopCh:     make(chan struct{}),
	}

	if !enabled || publicKey == "" || secretKey == "" {
		logger.Debug("Langfuse disabled or missing credentials; tracing is a no-op")
		return c
	}

	token := base64.StdEncoding.EncodeToString([]byte(publicKey + ":" + secretKey))
	c.authToken = "Basic " + token
	c.enabled = true

	c.wg.Add(1)
	go c.flushLoop()
	logger.WithField("host", host).Info("Langfuse tracing enabled")
	return c
}

// TraceGeneration enqueues a trace + generation event pair for ingestion.
// It never blocks on network I/O and is safe to call from hot paths.
func (c *LangfuseClient) TraceGeneration(
	_ context.Context,
	name string,
	input interface{},
	output interface{},
	metadata map[string]interface{},
) {
	if c == nil || !c.enabled {
		return
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	traceID := uuid.NewString()
	genID := uuid.NewString()

	userID, _ := metadata["user_id"].(string)
	usage, _ := metadata["usage"].(map[string]int)
	model, _ := metadata["model"].(string)

	events := []ingestionEvent{
		{
			ID:        uuid.NewString(),
			Type:      "trace-create",
			Timestamp: now,
			Body: traceBody{
				ID:        traceID,
				Name:      name,
				Timestamp: now,
				UserID:    userID,
				Metadata:  metadata,
				Tags:      []string{"llm-gateway", "generation"},
			},
		},
		{
			ID:        uuid.NewString(),
			Type:      "generation-create",
			Timestamp: now,
			Body: generationBody{
				ID:        genID,
				TraceID:   traceID,
				Name:      name,
				StartTime: now,
				EndTime:   now,
				Model:     model,
				Input:     input,
				Output:    output,
				Metadata:  metadata,
				Usage:     usage,
			},
		},
	}

	c.mu.Lock()
	c.buffer = append(c.buffer, events...)
	shouldFlush := len(c.buffer) >= maxBatchSize
	c.mu.Unlock()

	if shouldFlush {
		c.flush()
	}
}

// Close flushes pending events and stops the background worker.
func (c *LangfuseClient) Close() error {
	if c == nil || !c.enabled {
		return nil
	}
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return nil
	}
	c.closed = true
	c.mu.Unlock()

	close(c.stopCh)
	c.wg.Wait()
	c.flush()
	return nil
}

func isTruthy(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "on", "enabled":
		return true
	}
	return false
}
