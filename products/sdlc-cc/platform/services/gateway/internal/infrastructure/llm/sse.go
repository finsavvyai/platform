// Package llm — shared SSE consumer for OpenAI-style streams.
package llm

import (
	"bufio"
	"encoding/json"
	"io"
	"strings"
)

// consumeOAISSE parses OpenAI's "data: {...}" SSE protocol and emits
// StreamChunks. The protocol terminates with a literal "data: [DONE]".
func consumeOAISSE(body io.ReadCloser, out chan<- StreamChunk) {
	defer close(out)
	defer body.Close()
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1<<20)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		payload := strings.TrimPrefix(line, "data: ")
		if payload == "[DONE]" {
			out <- StreamChunk{Done: true}
			return
		}
		var ev struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(payload), &ev); err != nil {
			continue
		}
		if len(ev.Choices) > 0 && ev.Choices[0].Delta.Content != "" {
			out <- StreamChunk{Delta: ev.Choices[0].Delta.Content}
		}
	}
	if err := scanner.Err(); err != nil {
		out <- StreamChunk{Err: err}
	}
}
