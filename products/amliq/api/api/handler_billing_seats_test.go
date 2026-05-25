package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

type stubSeatRepo struct {
	seats []domain.Seat
	count int
}

func (s *stubSeatRepo) Create(_ context.Context, seat domain.Seat) error {
	s.seats = append(s.seats, seat)
	return nil
}
func (s *stubSeatRepo) ListByTenant(_ context.Context, _ string) ([]domain.Seat, error) {
	return s.seats, nil
}
func (s *stubSeatRepo) UpdateRole(_ context.Context, _ string, _ domain.Role) error { return nil }
func (s *stubSeatRepo) Deactivate(_ context.Context, _ string) error               { return nil }
func (s *stubSeatRepo) CountByTenant(_ context.Context, _ string) (int, error) {
	return s.count, nil
}

func TestHandleAddSeat(t *testing.T) {
	tests := []struct {
		name       string
		tenantID   string
		payload    AddSeatRequest
		wantStatus int
	}{
		{
			name:     "success",
			tenantID: "t1",
			payload:  AddSeatRequest{Email: "user@example.com", Role: "analyst"},
			wantStatus: http.StatusCreated,
		},
		{
			name:       "unauthorized_no_tenant",
			tenantID:   "",
			payload:    AddSeatRequest{Email: "user@example.com", Role: "analyst"},
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.payload)
			req := httptest.NewRequest("POST", "/api/v1/billing/seats", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			if tt.tenantID != "" {
				ctx := context.WithValue(req.Context(), TenantContextKey, tt.tenantID)
				req = req.WithContext(ctx)
			}
			w := httptest.NewRecorder()

			handler := handleAddSeat(&stubSeatRepo{count: 0}, 3)
			handler(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}

func TestHandleGetSeats(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/billing/seats", nil)
	ctx := context.WithValue(req.Context(), TenantContextKey, "t1")
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	handler := handleGetSeats(&stubSeatRepo{})
	handler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}
