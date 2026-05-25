package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

const testProgressTenantID = "tnt_000000000001"

// progressFixture wires the minimum repos the progress handler
// reads from. mutate via the helpers below to flip steps to done.
type progressFixture struct {
	tenants    *storage.InMemoryTenantRepo
	screenings *storage.InMemoryScreeningRepo
	webhooks   *WebhookSecretStore
}

func newProgressFixture(t *testing.T) *progressFixture {
	t.Helper()
	tenants := storage.NewInMemoryTenantRepo()
	tid, _ := domain.NewTenantID(testProgressTenantID)
	tenant, err := domain.NewTenant(tid, "Acme", "Acme Bank")
	if err != nil {
		t.Fatalf("NewTenant: %v", err)
	}
	if err := tenants.Create(tenant); err != nil {
		t.Fatalf("create tenant: %v", err)
	}
	return &progressFixture{
		tenants:    tenants,
		screenings: storage.NewInMemoryScreeningRepo(),
		webhooks:   NewWebhookSecretStore(),
	}
}

func (f *progressFixture) call(t *testing.T) OnboardingProgress {
	t.Helper()
	h := handleOnboardingProgress(f.tenants, f.screenings, f.webhooks)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/onboarding/progress", nil)
	req = req.WithContext(ContextWithClaims(req.Context(),
		&Claims{TenantID: testProgressTenantID, UserID: "u", Role: "admin"}))
	rr := httptest.NewRecorder()
	h(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	var resp struct {
		Data OnboardingProgress `json:"data"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	return resp.Data
}

func stepDone(steps []OnboardingStep, id string) bool {
	for _, s := range steps {
		if s.ID == id {
			return s.Done
		}
	}
	return false
}

func TestProgressFreshTenantOnlyHasProfileAndLists(t *testing.T) {
	f := newProgressFixture(t)
	got := f.call(t)
	if got.Total != 4 {
		t.Errorf("Total=%d, want 4", got.Total)
	}
	if !stepDone(got.Steps, "profile") {
		t.Error("profile must be done after signup")
	}
	if !stepDone(got.Steps, "lists") {
		t.Error("lists are seeded by NewTenantConfig — should be done")
	}
	if stepDone(got.Steps, "first_screen") {
		t.Error("first_screen must NOT be done on a fresh tenant")
	}
	if stepDone(got.Steps, "webhook") {
		t.Error("webhook must NOT be done before configuration")
	}
	if got.Completed != 2 {
		t.Errorf("Completed=%d, want 2 (profile + lists)", got.Completed)
	}
}

func TestProgressFlipsToDoneWhenScreeningAndWebhookConfigured(t *testing.T) {
	f := newProgressFixture(t)
	tid, _ := domain.NewTenantID(testProgressTenantID)
	resp := domain.NewScreenResponse(domain.ScreenRequest{TenantID: tid})
	if err := f.screenings.Create(resp); err != nil {
		t.Fatalf("seed screening: %v", err)
	}
	if _, err := f.webhooks.Rotate(testProgressTenantID); err != nil {
		t.Fatalf("rotate secret: %v", err)
	}
	got := f.call(t)
	if !stepDone(got.Steps, "first_screen") || !stepDone(got.Steps, "webhook") {
		t.Errorf("expected first_screen + webhook done; got %+v", got.Steps)
	}
	if got.Completed != 4 {
		t.Errorf("Completed=%d, want 4", got.Completed)
	}
}
