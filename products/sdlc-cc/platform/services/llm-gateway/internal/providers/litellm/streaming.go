package litellm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/SDLC/llm-gateway/internal/providers"
	"github.com/SDLC/llm-gateway/pkg/models"
)

// CompleteStream opens an SSE stream against LiteLLM's chat completions
// endpoint and relays deltas onto the gateway's StreamChunk channel.
//
// The OpenAI SSE wire format is one `data: <json>` line per event,
// terminated by a blank line, with a final `data: [DONE]` sentinel.
func (p *Provider) CompleteStream(ctx context.Context, req *models.CompletionRequest) (<-chan providers.StreamChunk, error) {
	body := buildRequest(req, true)
	resp, err := p.client.do(ctx, "POST", "/v1/chat/completions", body, true)
	if err != nil {
		return nil, err
	}

	ch := make(chan providers.StreamChunk, 16)
	go func() {
		defer close(ch)
		defer resp.Body.Close()
		readSSE(resp.Body, ch)
	}()
	return ch, nil
}

// readSSE is the line-oriented parser for OpenAI-style Server-Sent Events.
// Split into its own function so the stream goroutine above stays short
// and the parser can be unit-tested directly against a bytes.Buffer.
func readSSE(body io.Reader, ch chan<- providers.StreamChunk) {
	scanner := bufio.NewScanner(body)
	// Allow long SSE lines (tool calls, long deltas).
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)

	for scanner.Scan() {
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 || !bytes.HasPrefix(line, []byte("data:")) {
			continue
		}
		payload := bytes.TrimSpace(line[len("data:"):])
		if string(payload) == "[DONE]" {
			ch <- providers.StreamChunk{Done: true}
			return
		}

		var sr streamResponse
		if err := json.Unmarshal(payload, &sr); err != nil {
			// Ignore malformed keep-alive comments; fail loudly on real JSON.
			if !strings.HasPrefix(string(payload), ":") {
				ch <- providers.StreamChunk{
					Error: fmt.Errorf("litellm: decode stream chunk: %w", err),
					Done:  true,
				}
				return
			}
			continue
		}
		ch <- toChunk(&sr)
	}
	if err := scanner.Err(); err != nil {
		ch <- providers.StreamChunk{Error: fmt.Errorf("litellm: stream read: %w", err), Done: true}
	}
}

// toChunk maps the wire-level streamResponse onto the gateway's
// provider-agnostic StreamChunk.
func toChunk(sr *streamResponse) providers.StreamChunk {
	choices := make([]providers.StreamChoice, len(sr.Choices))
	done := false
	for i, c := range sr.Choices {
		choices[i] = providers.StreamChoice{
			Index:        c.Index,
			Delta:        providers.Delta{Role: c.Delta.Role, Content: c.Delta.Content},
			FinishReason: c.FinishReason,
		}
		if c.FinishReason != "" {
			done = true
		}
	}
	return providers.StreamChunk{
		ID:      sr.ID,
		Object:  sr.Object,
		Created: sr.Created,
		Model:   sr.Model,
		Choices: choices,
		Done:    done,
	}
}
