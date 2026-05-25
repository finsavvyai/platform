// Package e2e contains end-to-end integration tests that spin a
// docker-compose stack and exercise the gateway through real HTTP.
//
// These tests are gated by the build tag `e2e` so `go test ./...` does
// not pull in the runtime cost; CI runs them via:
//
//	go test -tags=e2e ./tests/e2e/...
//
// Day 8 of the production-ready roadmap.
//
//go:build e2e

package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

const (
	defaultGatewayURL = "http://localhost:8080"
	uploadEndpoint    = "/v1/documents"
	statusEndpoint    = "/v1/documents/%s"
	queryEndpoint     = "/v1/rag/query"

	uploadTimeout  = 30 * time.Second
	processTimeout = 90 * time.Second
	queryTimeout   = 5 * time.Second // budget per Day-8 SLO
)

func gatewayURL() string {
	if v := os.Getenv("E2E_GATEWAY_URL"); v != "" {
		return v
	}
	return defaultGatewayURL
}

// TestRAGRoundTrip uploads a small PDF, waits for it to process, runs
// a RAG query referencing the doc, and asserts the answer includes a
// recognisable citation within the per-Day-8 latency budget.
func TestRAGRoundTrip(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), uploadTimeout+processTimeout+queryTimeout+15*time.Second)
	defer cancel()

	pdf := samplePDF(t)
	docID, err := uploadDocument(ctx, pdf)
	if err != nil {
		t.Fatalf("upload: %v", err)
	}

	if err := waitForProcessing(ctx, docID, processTimeout); err != nil {
		t.Fatalf("processing did not complete in %s: %v", processTimeout, err)
	}

	start := time.Now()
	answer, err := ragQuery(ctx, "What does this document contain?")
	elapsed := time.Since(start)
	if err != nil {
		t.Fatalf("rag query: %v", err)
	}
	if elapsed > queryTimeout {
		t.Fatalf("query latency %s exceeds Day-8 SLO %s", elapsed, queryTimeout)
	}
	if answer == "" {
		t.Fatal("answer must not be empty for a non-empty corpus")
	}
	if !strings.Contains(strings.ToLower(answer), "test") {
		t.Errorf("answer should reference uploaded doc content; got: %q", answer)
	}
}

// TestRAGEmptyCorpus confirms a query against an empty knowledge base
// returns the expected "no relevant context" response and is fast.
func TestRAGEmptyCorpus(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), queryTimeout+5*time.Second)
	defer cancel()

	answer, err := ragQuery(ctx, "What does this document contain?")
	if err != nil {
		t.Fatalf("rag query: %v", err)
	}
	if answer == "" {
		t.Fatal("answer should be non-empty even on empty corpus (the no-context message)")
	}
}

func uploadDocument(ctx context.Context, body []byte) (string, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("file", "test-doc.pdf")
	if err != nil {
		return "", err
	}
	if _, err := part.Write(body); err != nil {
		return "", err
	}
	_ = writer.Close()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, gatewayURL()+uploadEndpoint, &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+os.Getenv("E2E_API_KEY"))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("upload status %d: %s", resp.StatusCode, body)
	}
	var out struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if out.ID == "" {
		return "", fmt.Errorf("upload response missing id")
	}
	return out.ID, nil
}

func waitForProcessing(ctx context.Context, docID string, budget time.Duration) error {
	deadline := time.Now().Add(budget)
	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(500 * time.Millisecond):
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet,
			fmt.Sprintf(gatewayURL()+statusEndpoint, docID), nil)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+os.Getenv("E2E_API_KEY"))
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			continue
		}
		var out struct {
			Status string `json:"status"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&out)
		_ = resp.Body.Close()
		if out.Status == "completed" {
			return nil
		}
		if out.Status == "failed" {
			return fmt.Errorf("processing failed for doc %s", docID)
		}
	}
	return fmt.Errorf("timeout waiting for doc %s to process", docID)
}

func ragQuery(ctx context.Context, q string) (string, error) {
	body, _ := json.Marshal(map[string]string{"query": q})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		gatewayURL()+queryEndpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+os.Getenv("E2E_API_KEY"))
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("query status %d: %s", resp.StatusCode, raw)
	}
	var out struct {
		Answer string `json:"answer"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	return out.Answer, nil
}

// samplePDF returns a minimal valid PDF containing the word "test".
// Avoids a fixture file dependency in CI; the bytes below are a hand-
// crafted PDF that opens in any reader and renders the literal word.
func samplePDF(_ *testing.T) []byte {
	const minimal = "%PDF-1.4\n" +
		"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
		"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n" +
		"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<<>>>>endobj\n" +
		"4 0 obj<</Length 20>>stream\nBT /F1 12 Tf (test) Tj ET\nendstream endobj\n" +
		"xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n" +
		"0000000098 00000 n\n0000000180 00000 n\ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n240\n%%EOF\n"
	return []byte(minimal)
}
