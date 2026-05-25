package observability

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// ingestionEvent is one item in the Langfuse /api/public/ingestion batch.
type ingestionEvent struct {
	ID        string      `json:"id"`
	Type      string      `json:"type"`
	Timestamp string      `json:"timestamp"`
	Body      interface{} `json:"body"`
}

// traceBody matches the Langfuse `trace-create` event body schema.
type traceBody struct {
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Timestamp string                 `json:"timestamp"`
	UserID    string                 `json:"userId,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Tags      []string               `json:"tags,omitempty"`
}

// generationBody matches the Langfuse `generation-create` event body schema.
type generationBody struct {
	ID        string                 `json:"id"`
	TraceID   string                 `json:"traceId"`
	Name      string                 `json:"name"`
	StartTime string                 `json:"startTime"`
	EndTime   string                 `json:"endTime"`
	Model     string                 `json:"model,omitempty"`
	Input     interface{}            `json:"input,omitempty"`
	Output    interface{}            `json:"output,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Usage     map[string]int         `json:"usage,omitempty"`
}

// ingestionRequest is the POST body for /api/public/ingestion.
type ingestionRequest struct {
	Batch []ingestionEvent `json:"batch"`
}

// flushLoop runs until stopCh is closed, draining the buffer on every tick.
func (c *LangfuseClient) flushLoop() {
	defer c.wg.Done()
	ticker := time.NewTicker(flushInterval)
	defer ticker.Stop()
	for {
		select {
		case <-c.stopCh:
			return
		case <-ticker.C:
			c.flush()
		}
	}
}

// flush drains the buffer and sends one batch request. Failures are logged
// at warn level and dropped — observability must never break the gateway.
func (c *LangfuseClient) flush() {
	c.mu.Lock()
	if len(c.buffer) == 0 {
		c.mu.Unlock()
		return
	}
	batch := c.buffer
	c.buffer = nil
	c.mu.Unlock()

	payload, err := json.Marshal(ingestionRequest{Batch: batch})
	if err != nil {
		c.logger.WithError(err).Warn("Langfuse: failed to marshal batch")
		return
	}

	req, err := http.NewRequest(http.MethodPost, c.host+ingestionPath, bytes.NewReader(payload))
	if err != nil {
		c.logger.WithError(err).Warn("Langfuse: failed to build request")
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", c.authToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		c.logger.WithError(err).Warn("Langfuse: ingestion request failed")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		c.logger.Warn(fmt.Sprintf("Langfuse: ingestion returned status %d", resp.StatusCode))
	}
}
