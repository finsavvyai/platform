package main

import (
	"bufio"
	"context"
	"fmt"
	"net/http"
	"strings"
)

// streamSSE reads Server-Sent Events from the given URL until complete or error.
// Calls onEvent for each parsed SSE data line. Returns nil on clean completion.
func streamSSE(ctx context.Context, url string, onEvent func(data string)) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("create SSE request: %w", err)
	}
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("connect to SSE stream: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("SSE stream returned HTTP %d", resp.StatusCode)
	}

	scanner := bufio.NewScanner(resp.Body)
	var blockLines []string

	for scanner.Scan() {
		line := scanner.Text()

		if line == "" {
			// blank line = end of SSE block; dispatch collected data lines
			if len(blockLines) > 0 {
				for _, bl := range blockLines {
					if strings.HasPrefix(bl, "data:") {
						payload := strings.TrimPrefix(bl, "data:")
						payload = strings.TrimSpace(payload)
						onEvent(payload)
					}
				}
				blockLines = blockLines[:0]
			}
			continue
		}

		// Skip SSE comment lines (keepalive)
		if strings.HasPrefix(line, ":") {
			continue
		}

		blockLines = append(blockLines, line)
	}

	// Flush any trailing block (stream closed without trailing blank line)
	for _, bl := range blockLines {
		if strings.HasPrefix(bl, "data:") {
			payload := strings.TrimPrefix(bl, "data:")
			payload = strings.TrimSpace(payload)
			onEvent(payload)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read SSE stream: %w", err)
	}

	return nil
}
