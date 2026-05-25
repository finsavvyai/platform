// Behavior tests for the A2 SCIM audit hook.
//
// Each test POSTs/DELETEs through the real Handler (including the mux
// routing) and asserts the AuditHook is called with the expected action.
// Fail-closed: when the hook returns an error the handler must return 5xx.
package scim

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestHandler(store Store, audit AuditHook) (*Handler, *http.ServeMux) {
	h := &Handler{
		Store:    store,
		BasePath: "/scim/v2",
		Tenant:   func(_ *http.Request) (string, error) { return "tenant-1", nil },
		Audit:    audit,
	}
	mux := http.NewServeMux()
	h.Register(mux)
	return h, mux
}

// TestSCIM_CreateUser_AuditHookCalled asserts that POST /Users fires the
// audit hook with action "scim.user.create" and the correct tenant.
func TestSCIM_CreateUser_AuditHookCalled(t *testing.T) {
	var capturedAction, capturedTenant string
	hook := func(_ context.Context, action, _, tenantID string) error {
		capturedAction = action
		capturedTenant = tenantID
		return nil
	}

	_, mux := newTestHandler(newMemStore(), hook)

	body, _ := json.Marshal(map[string]any{
		"schemas":  []string{UserSchema},
		"userName": "alice@example.com",
		"active":   true,
	})
	req := httptest.NewRequest(http.MethodPost, "/scim/v2/Users", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	require.Equal(t, http.StatusCreated, rr.Code, "body: %s", rr.Body.String())
	assert.Equal(t, "scim.user.create", capturedAction)
	assert.Equal(t, "tenant-1", capturedTenant)
}

// TestSCIM_DeleteUser_AuditHookCalled asserts that DELETE /Users/{id} fires
// the audit hook with action "scim.user.delete".
func TestSCIM_DeleteUser_AuditHookCalled(t *testing.T) {
	store := newMemStore()
	// Pre-populate a user.
	created, err := store.Create(context.Background(), User{
		Schemas: []string{UserSchema}, UserName: "bob@example.com",
		Active: true, TenantID: "tenant-1",
	})
	require.NoError(t, err)

	var capturedAction string
	hook := func(_ context.Context, action, _, _ string) error {
		capturedAction = action
		return nil
	}

	_, mux := newTestHandler(store, hook)

	req := httptest.NewRequest(http.MethodDelete, "/scim/v2/Users/"+created.ID, nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	require.Equal(t, http.StatusNoContent, rr.Code)
	assert.Equal(t, "scim.user.delete", capturedAction)
}

// TestSCIM_CreateUser_AuditError_Fails verifies fail-closed: when the audit
// hook returns an error the HTTP handler returns 5xx and the user is NOT
// considered successfully created from the client's perspective.
func TestSCIM_CreateUser_AuditError_Fails(t *testing.T) {
	hook := func(_ context.Context, _, _, _ string) error {
		return errors.New("audit store unavailable")
	}

	_, mux := newTestHandler(newMemStore(), hook)

	body, _ := json.Marshal(map[string]any{
		"schemas":  []string{UserSchema},
		"userName": "carol@example.com",
		"active":   true,
	})
	req := httptest.NewRequest(http.MethodPost, "/scim/v2/Users", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusInternalServerError, rr.Code)
	assert.True(t, strings.Contains(rr.Body.String(), "audit write failed"),
		"body should mention audit failure, got: %s", rr.Body.String())
}
