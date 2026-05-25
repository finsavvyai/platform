package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

func newTeamHandlers(t *testing.T) (*Handlers, func()) {
	t.Helper()
	db, err := storage.NewInMemory()
	if err != nil {
		t.Fatalf("storage.NewInMemory: %v", err)
	}
	logger, err := logging.New(&logging.Config{Level: "error"})
	if err != nil {
		t.Fatalf("logging.New: %v", err)
	}
	h := New(db, integrations.NewManager(logger), nil, nil, logger, nil)
	return h, func() { _ = db.Close() }
}

func inviteMember(t *testing.T, h *Handlers, email, role string) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"email": email, "role": role})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/team/members", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.InviteTeamMember(w, req)
	return w
}

func TestInviteMember(t *testing.T) {
	h, cleanup := newTeamHandlers(t)
	defer cleanup()

	w := inviteMember(t, h, "alice@example.com", "member")
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["email"] != "alice@example.com" {
		t.Errorf("email mismatch: got %q", resp["email"])
	}
	if resp["status"] != "invited" {
		t.Errorf("status mismatch: got %q", resp["status"])
	}
}

func TestInviteDuplicate(t *testing.T) {
	h, cleanup := newTeamHandlers(t)
	defer cleanup()

	inviteMember(t, h, "bob@example.com", "member")
	w := inviteMember(t, h, "bob@example.com", "admin")
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRemoveMember(t *testing.T) {
	h, cleanup := newTeamHandlers(t)
	defer cleanup()

	inviteMember(t, h, "carol@example.com", "viewer")

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/team/members/carol@example.com", nil)
	req.URL.Path = "/api/v1/team/members/carol@example.com"
	w := httptest.NewRecorder()
	h.RemoveTeamMember(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Confirm gone
	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/team/members", nil)
	listW := httptest.NewRecorder()
	h.ListTeamMembers(listW, listReq)
	var resp map[string]interface{}
	_ = json.NewDecoder(listW.Body).Decode(&resp)
	if count, ok := resp["count"].(float64); ok && count != 0 {
		t.Errorf("expected 0 members, got %v", count)
	}
}

func TestUpdateRole(t *testing.T) {
	h, cleanup := newTeamHandlers(t)
	defer cleanup()

	inviteMember(t, h, "dave@example.com", "member")

	body, _ := json.Marshal(map[string]string{"role": "admin"})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/team/members/dave@example.com/role", bytes.NewReader(body))
	req.URL.Path = "/api/v1/team/members/dave@example.com/role"
	w := httptest.NewRecorder()
	h.UpdateTeamMemberRole(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]string
	_ = json.NewDecoder(w.Body).Decode(&resp)
	if resp["role"] != "admin" {
		t.Errorf("role mismatch: got %q", resp["role"])
	}
}

func TestInvalidRole(t *testing.T) {
	h, cleanup := newTeamHandlers(t)
	defer cleanup()

	w := inviteMember(t, h, "eve@example.com", "superadmin")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}
