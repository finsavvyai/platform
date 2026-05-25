// SPDX-License-Identifier: AGPL-3.0-or-later
//
// POST /v1/redact — standalone DLP scan endpoint.
//
// Used by the privacy-gateway browser extension, IDE addins, and
// Office addins to scrub PII / secrets out of prompts before the
// host application submits them to an LLM. Honours the same
// per-tenant policy + custom patterns + legal preset as the
// middleware chain (see infrastructure/middleware/dlp_scan_api.go).
//
// The endpoint never forwards the prompt to an upstream provider —
// it returns the rewritten text and the list of detections so the
// client can decide what to do.

package redact

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
)

const maxBodyBytes = 1 << 20 // 1 MiB request cap for /v1/redact

// Scanner is the contract the handler needs. The production
// implementation is infrastructure/middleware.(*DLP).Scan; tests
// pass a fake.
type Scanner interface {
	Scan(ctx context.Context, text, tenant string) ScanResult
}

// ScanResult mirrors middleware.ScanResult — duplicated here so the
// handler package does not import the middleware package's
// internals beyond the interface.
type ScanResult struct {
	Rewritten   string
	Matches     []Detection
	Action      string
	Blocked     bool
	BlockReason string
}

// Detection is one finding surfaced to the API client.
type Detection struct {
	Type   string `json:"pattern"`
	Preset string `json:"preset"`
	Action string `json:"action"`
	Start  int    `json:"start"`
	End    int    `json:"end"`
}

// Request is the JSON request body.
type Request struct {
	Text    string   `json:"text"`
	Presets []string `json:"presets,omitempty"`
	Tenant  string   `json:"tenant,omitempty"`
}

// Response is the JSON response body.
type Response struct {
	Redacted    string      `json:"redacted"`
	Detections  []Detection `json:"detections"`
	Blocked     bool        `json:"blocked"`
	BlockReason string      `json:"block_reason,omitempty"`
}

// Handler returns the POST /v1/redact handler. tenantFrom may be nil
// for self-host installs where no tenant context is wired — in that
// case the request body's tenant field is the only source.
func Handler(s Scanner, tenantFrom func(*http.Request) string) http.HandlerFunc {
	if tenantFrom == nil {
		tenantFrom = func(*http.Request) string { return "" }
	}
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeErr(w, http.StatusMethodNotAllowed, "POST only")
			return
		}
		if s == nil {
			writeErr(w, http.StatusServiceUnavailable, "scanner not configured")
			return
		}
		req, err := decode(r)
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		tenant := strings.TrimSpace(req.Tenant)
		if tenant == "" {
			tenant = tenantFrom(r)
		}
		res := s.Scan(r.Context(), req.Text, tenant)
		writeJSON(w, http.StatusOK, toResponse(res))
	}
}

func decode(r *http.Request) (Request, error) {
	defer func() { _ = r.Body.Close() }()
	body, err := io.ReadAll(http.MaxBytesReader(nil, r.Body, maxBodyBytes))
	if err != nil {
		return Request{}, errors.New("request too large or unreadable")
	}
	if len(body) == 0 {
		return Request{}, errors.New("empty body")
	}
	var req Request
	dec := json.NewDecoder(strings.NewReader(string(body)))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		return Request{}, errors.New("invalid JSON body")
	}
	if req.Text == "" {
		return Request{}, errors.New("text is required")
	}
	return req, nil
}

func toResponse(res ScanResult) Response {
	out := Response{
		Redacted:    res.Rewritten,
		Detections:  res.Matches,
		Blocked:     res.Blocked,
		BlockReason: res.BlockReason,
	}
	if out.Detections == nil {
		out.Detections = []Detection{}
	}
	return out
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"type":   "https://sdlc.ai/problems/redact-bad-request",
		"title":  http.StatusText(status),
		"status": status,
		"detail": msg,
	})
}
