package api

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

type stubTxnRepo struct {
	txns []domain.Transaction
	err  error
}

func (s *stubTxnRepo) Create(_ context.Context, t domain.Transaction) error { return s.err }
func (s *stubTxnRepo) ListByEntity(_ context.Context, id string, _ int) ([]domain.Transaction, error) {
	return s.txns, s.err
}
func (s *stubTxnRepo) ListByTenant(_ context.Context, _ domain.TenantID, _ int) ([]domain.Transaction, error) {
	return s.txns, s.err
}

func TestTxnSubmit(t *testing.T) {
	h := NewTxnHandler(&stubTxnRepo{}, &stubTxnAlertRepo{})
	tests := []struct {
		name       string
		tenantID   string
		body       string
		wantStatus int
	}{
		{"valid", "tnt_abcdefghijkl",
			`{"entity_id":"e1","counterparty_id":"e2","amount_cents":100000,"currency":"USD","direction":"outbound","country":"US"}`,
			202},
		{"no tenant", "", `{"entity_id":"e1"}`, 401},
		{"bad json", "tnt_abcdefghijkl", `{bad`, 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("POST", "/api/v1/txn", tt.tenantID)
			req.Body = httptest.NewRequest("POST", "/", strings.NewReader(tt.body)).Body
			rr := httptest.NewRecorder()
			h.Submit(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}
