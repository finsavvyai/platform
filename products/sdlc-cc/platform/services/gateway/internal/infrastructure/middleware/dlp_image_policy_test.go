// Behavior tests for Claude Team C2 image-input policy. The
// detector is text-only; HIPAA / regulated tenants need a way to
// refuse image content blocks before they reach the upstream LLM.
package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeImagePolicy implements both PolicyLookup and ImagePolicyLookup
// for tests so we can exercise each verdict (allow/block/warn).
type fakeImagePolicy struct {
	dlpAction Action
	imgPolicy ImagePolicy
}

func (f fakeImagePolicy) DLPAction(_ context.Context, _ string) (Action, error) {
	return f.dlpAction, nil
}

func (f fakeImagePolicy) ImagePolicy(_ context.Context, _ string) (ImagePolicy, error) {
	return f.imgPolicy, nil
}

func TestHasImageContentBlock_DetectsCommonEncodings(t *testing.T) {
	cases := map[string]bool{
		`{"role":"user","content":[{"type":"image","source":{}}]}`:        true,
		`{"role":"user","content":[{"type": "image", "source":{}}]}`:      true,
		`{"role":"user","content":[{"type":"text","text":"hi image"}]}`:   false,
		`{"role":"user","content":[{"type":"text","text":"hello"}]}`:      false,
	}
	for body, want := range cases {
		got := hasImageContentBlock([]byte(body))
		if got != want {
			t.Errorf("hasImageContentBlock(%q) = %v, want %v", body, got, want)
		}
	}
}

func TestEnforceImagePolicy_BlocksWhenPolicyIsBlock(t *testing.T) {
	policy := fakeImagePolicy{dlpAction: ActionAllow, imgPolicy: ImagePolicyBlock}
	dlp := NewDLP(NewDetector(), policy, nil)
	dlp.TenantFromCtx = func(_ context.Context) string {
		return "11111111-1111-4111-8111-111111111111"
	}

	downstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Error("downstream must not receive a blocked image request")
	})
	chained := dlp.EnforceImagePolicy()(downstream)

	body := `{"role":"user","content":[{"type":"image","source":{"data":"AAAA"}}]}`
	req := withTenant(httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body)), "t1")
	req.ContentLength = int64(len(body))
	rec := httptest.NewRecorder()
	chained.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", rec.Code)
	}
	var env struct {
		Type  string `json:"type"`
		Error struct {
			Type    string `json:"type"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("response body not JSON: %v", err)
	}
	if env.Type != "error" || env.Error.Type == "" {
		t.Errorf("expected Anthropic-shape error envelope, got %+v", env)
	}
}

func TestEnforceImagePolicy_AllowsWhenPolicyIsAllow(t *testing.T) {
	policy := fakeImagePolicy{dlpAction: ActionAllow, imgPolicy: ImagePolicyAllow}
	dlp := NewDLP(NewDetector(), policy, nil)
	dlp.TenantFromCtx = func(_ context.Context) string { return "t1" }

	called := false
	downstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	chained := dlp.EnforceImagePolicy()(downstream)

	body := `{"content":[{"type":"image","source":{}}]}`
	req := withTenant(httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body)), "t1")
	req.ContentLength = int64(len(body))
	chained.ServeHTTP(httptest.NewRecorder(), req)

	if !called {
		t.Error("downstream should have been called when image policy is allow")
	}
}

func TestEnforceImagePolicy_PassesThroughWhenNoImageBlock(t *testing.T) {
	policy := fakeImagePolicy{dlpAction: ActionAllow, imgPolicy: ImagePolicyBlock}
	dlp := NewDLP(NewDetector(), policy, nil)
	dlp.TenantFromCtx = func(_ context.Context) string { return "t1" }

	called := false
	downstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	chained := dlp.EnforceImagePolicy()(downstream)

	// Text-only request — block policy must NOT trigger because no
	// image block is present in the body.
	body := `{"messages":[{"role":"user","content":"hello"}]}`
	req := withTenant(httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body)), "t1")
	req.ContentLength = int64(len(body))
	chained.ServeHTTP(httptest.NewRecorder(), req)

	if !called {
		t.Error("downstream should be called for text-only requests even under block policy")
	}
}

func TestEnforceImagePolicy_WarnPassesThroughWithAuditRow(t *testing.T) {
	rec := &recordingAudit{}
	policy := fakeImagePolicy{dlpAction: ActionAllow, imgPolicy: ImagePolicyWarn}
	dlp := NewDLP(NewDetector(), policy, rec)
	dlp.TenantFromCtx = func(_ context.Context) string { return "t1" }

	called := false
	downstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	chained := dlp.EnforceImagePolicy()(downstream)

	body := `{"content":[{"type":"image"}]}`
	req := withTenant(httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body)), "t1")
	req.ContentLength = int64(len(body))
	chained.ServeHTTP(httptest.NewRecorder(), req)

	if !called {
		t.Error("downstream should have been called under warn policy")
	}
	rows := rec.snapshot()
	if len(rows) == 0 {
		t.Fatal("expected at least one audit row under warn policy")
	}
	if rows[0].Action != "dlp.image.warn" {
		t.Errorf("audit row action = %q, want dlp.image.warn", rows[0].Action)
	}
}

func TestEnforceImagePolicy_RestoresBodyForDownstream(t *testing.T) {
	// The middleware reads + restores the body. Downstream must see
	// the same bytes the caller sent.
	policy := fakeImagePolicy{dlpAction: ActionAllow, imgPolicy: ImagePolicyAllow}
	dlp := NewDLP(NewDetector(), policy, nil)
	dlp.TenantFromCtx = func(_ context.Context) string { return "t1" }

	expected := `{"content":[{"type":"image","source":{"data":"deadbeef"}}]}`
	var captured []byte
	downstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := make([]byte, r.ContentLength)
		_, _ = r.Body.Read(buf)
		captured = buf
	})
	chained := dlp.EnforceImagePolicy()(downstream)

	req := withTenant(httptest.NewRequest(http.MethodPost, "/", bytes.NewReader([]byte(expected))), "t1")
	req.ContentLength = int64(len(expected))
	chained.ServeHTTP(httptest.NewRecorder(), req)

	if string(captured) != expected {
		t.Errorf("downstream body lost or mangled:\n  want: %q\n   got: %q", expected, captured)
	}
}
