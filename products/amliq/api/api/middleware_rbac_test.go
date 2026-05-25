package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestRequireRole(t *testing.T) {
	tests := []struct {
		name       string
		role       string
		check      func(domain.Role) bool
		wantStatus int
	}{
		{
			name:       "admin allowed",
			role:       "admin",
			check:      func(r domain.Role) bool { return r == domain.RoleAdmin },
			wantStatus: http.StatusOK,
		},
		{
			name:       "analyst denied admin",
			role:       "analyst",
			check:      func(r domain.Role) bool { return r == domain.RoleAdmin },
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "empty role",
			role:       "",
			check:      func(r domain.Role) bool { return true },
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "invalid role string",
			role:       "superuser",
			check:      func(r domain.Role) bool { return true },
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "analyst write access",
			role:       "analyst",
			check:      func(r domain.Role) bool { return r.CanWrite() },
			wantStatus: http.StatusOK,
		},
		{
			name:       "viewer no write",
			role:       "viewer",
			check:      func(r domain.Role) bool { return r.CanWrite() },
			wantStatus: http.StatusForbidden,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := RequireRole(tt.check)(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
				}),
			)
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			claims := &Claims{TenantID: "tnt_test", UserID: "u1", Role: tt.role}
			ctx := context.WithValue(req.Context(), ClaimsContextKey, claims)
			req = req.WithContext(ctx)

			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}
