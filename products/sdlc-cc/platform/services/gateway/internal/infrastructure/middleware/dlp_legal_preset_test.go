// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Behaviour tests for the LegalPresetLookup capability. Each test
// stands up the DLP middleware with a fake PolicyLookup whose
// LegalPreset method returns either true or false, sends a request
// with a privilege marker in the body, and asserts the pattern is
// (or is not) redacted accordingly. This exercises the wiring added
// in migration 032 — the underlying patterns are tested separately
// in dlp_legal_test.go.
package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeLegalPresetPolicy implements PolicyLookup + LegalPresetLookup.
// preset toggles the opt-in flag; action is what DLPAction returns.
type fakeLegalPresetPolicy struct {
	action Action
	preset bool
}

func (f fakeLegalPresetPolicy) DLPAction(_ context.Context, _ string) (Action, error) {
	return f.action, nil
}

func (f fakeLegalPresetPolicy) LegalPreset(_ context.Context, _ string) (bool, error) {
	return f.preset, nil
}

func TestLegalPreset_OnRedactsPrivilegeMarker(t *testing.T) {
	policy := fakeLegalPresetPolicy{action: ActionRedact, preset: true}
	dlp := NewDLP(NewDetector(), policy, nil)
	dlp.TenantFromCtx = func(_ context.Context) string {
		return "11111111-1111-4111-8111-111111111111"
	}

	downstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("PRIVILEGED & CONFIDENTIAL — memo re Smith matter"))
	})
	chained := dlp.Outbound()(downstream)

	rec := httptest.NewRecorder()
	chained.ServeHTTP(rec, withTenant(httptest.NewRequest(http.MethodGet, "/", nil), "t1"))

	body := rec.Body.String()
	if strings.Contains(body, "PRIVILEGED & CONFIDENTIAL") {
		t.Fatalf("preset=on should have redacted the privilege marker; got %q", body)
	}
}

func TestLegalPreset_OffLeavesPrivilegeMarker(t *testing.T) {
	policy := fakeLegalPresetPolicy{action: ActionRedact, preset: false}
	dlp := NewDLP(NewDetector(), policy, nil)
	dlp.TenantFromCtx = func(_ context.Context) string {
		return "11111111-1111-4111-8111-111111111111"
	}

	downstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("PRIVILEGED & CONFIDENTIAL — memo re Smith matter"))
	})
	chained := dlp.Outbound()(downstream)

	rec := httptest.NewRecorder()
	chained.ServeHTTP(rec, withTenant(httptest.NewRequest(http.MethodGet, "/", nil), "t1"))

	body := rec.Body.String()
	if !strings.Contains(body, "PRIVILEGED & CONFIDENTIAL") {
		t.Fatalf("preset=off should have passed the privilege marker through; got %q", body)
	}
}
