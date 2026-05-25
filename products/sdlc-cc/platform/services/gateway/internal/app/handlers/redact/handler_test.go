// SPDX-License-Identifier: AGPL-3.0-or-later
package redact

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakeScanner struct {
	got    string
	tenant string
	res    ScanResult
}

func (f *fakeScanner) Scan(_ context.Context, text, tenant string) ScanResult {
	f.got = text
	f.tenant = tenant
	return f.res
}

func post(body string) *http.Request {
	return httptest.NewRequest(http.MethodPost, "/v1/redact",
		strings.NewReader(body))
}

func TestHandler_HappyPath(t *testing.T) {
	s := &fakeScanner{res: ScanResult{
		Rewritten: "hi [EMAIL]",
		Matches: []Detection{{
			Type: "email", Preset: "pii_default", Action: "redact",
			Start: 3, End: 18,
		}},
		Action: "redact",
	}}
	h := Handler(s, func(*http.Request) string { return "tenant-from-ctx" })
	rec := httptest.NewRecorder()

	h(rec, post(`{"text":"hi you@example.com"}`))

	if rec.Code != http.StatusOK {
		t.Fatalf("status: want 200 got %d body=%s", rec.Code, rec.Body.String())
	}
	var got Response
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Redacted != "hi [EMAIL]" {
		t.Fatalf("redacted: %q", got.Redacted)
	}
	if got.Blocked {
		t.Fatalf("blocked unexpectedly")
	}
	if len(got.Detections) != 1 || got.Detections[0].Type != "email" {
		t.Fatalf("detections: %+v", got.Detections)
	}
	if s.got != "hi you@example.com" {
		t.Fatalf("scanner got: %q", s.got)
	}
	if s.tenant != "tenant-from-ctx" {
		t.Fatalf("tenant fallback: %q", s.tenant)
	}
}

func TestHandler_BodyTenantOverridesCtx(t *testing.T) {
	s := &fakeScanner{res: ScanResult{Rewritten: "x"}}
	h := Handler(s, func(*http.Request) string { return "ctx-tenant" })
	rec := httptest.NewRecorder()

	h(rec, post(`{"text":"x","tenant":"body-tenant"}`))

	if s.tenant != "body-tenant" {
		t.Fatalf("tenant: %q", s.tenant)
	}
}

func TestHandler_Blocked(t *testing.T) {
	s := &fakeScanner{res: ScanResult{
		Blocked: true, BlockReason: "ssn", Action: "block",
	}}
	h := Handler(s, nil)
	rec := httptest.NewRecorder()

	h(rec, post(`{"text":"ssn 123-45-6789"}`))

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d", rec.Code)
	}
	var got Response
	_ = json.Unmarshal(rec.Body.Bytes(), &got)
	if !got.Blocked || got.BlockReason != "ssn" {
		t.Fatalf("body: %+v", got)
	}
}

func TestHandler_RejectsGET(t *testing.T) {
	h := Handler(&fakeScanner{}, nil)
	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodGet, "/v1/redact", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status: %d", rec.Code)
	}
}

func TestHandler_RejectsEmptyBody(t *testing.T) {
	h := Handler(&fakeScanner{}, nil)
	rec := httptest.NewRecorder()
	h(rec, post(``))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: %d", rec.Code)
	}
}

func TestHandler_RejectsMissingText(t *testing.T) {
	h := Handler(&fakeScanner{}, nil)
	rec := httptest.NewRecorder()
	h(rec, post(`{"tenant":"x"}`))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHandler_RejectsUnknownFields(t *testing.T) {
	h := Handler(&fakeScanner{}, nil)
	rec := httptest.NewRecorder()
	h(rec, post(`{"text":"x","unknown":1}`))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: %d", rec.Code)
	}
}

func TestHandler_503WhenScannerNil(t *testing.T) {
	h := Handler(nil, nil)
	rec := httptest.NewRecorder()
	h(rec, post(`{"text":"x"}`))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status: %d", rec.Code)
	}
}
