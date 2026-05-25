// Package llm — Vertex AI streamGenerateContent SSE consumer.
package llm

import (
	"bufio"
	"encoding/json"
	"io"
	"strings"
)

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

// consumeVertexSSE parses Vertex AI :streamGenerateContent SSE frames.
// Each `data:` line is a JSON object with the same shape as vertexGenResp.
func consumeVertexSSE(body io.ReadCloser, out chan<- StreamChunk) {
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
		var ev vertexGenResp
		if err := json.Unmarshal([]byte(payload), &ev); err != nil {
			continue
		}
		if len(ev.Candidates) > 0 {
			for _, p := range ev.Candidates[0].Content.Parts {
				if p.Text != "" {
					out <- StreamChunk{Delta: p.Text}
				}
			}
			if ev.Candidates[0].FinishReason != "" {
				out <- StreamChunk{Done: true}
				return
			}
		}
	}
	if err := scanner.Err(); err != nil {
		out <- StreamChunk{Err: err}
	}
}
