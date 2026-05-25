package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// TxnHandler manages transaction monitoring endpoints.
type TxnHandler struct {
	txns   storage.TransactionRepository
	alerts storage.TxnAlertRepository
}

func NewTxnHandler(
	t storage.TransactionRepository, a storage.TxnAlertRepository,
) *TxnHandler {
	return &TxnHandler{txns: t, alerts: a}
}

type SubmitTxnRequest struct {
	EntityID       string `json:"entity_id"`
	CounterpartyID string `json:"counterparty_id"`
	AmountCents    int64  `json:"amount_cents"`
	Currency       string `json:"currency"`
	Direction      string `json:"direction"`
	Country        string `json:"country"`
	Reference      string `json:"reference"`
}

func (h *TxnHandler) Submit(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	var req SubmitTxnRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	txn := domain.Transaction{
		TenantID: tid, EntityID: req.EntityID,
		CounterpartyID: req.CounterpartyID,
		AmountCents:    req.AmountCents, Currency: req.Currency,
		Direction: req.Direction, Country: req.Country,
		Reference: req.Reference,
	}
	if err := h.txns.Create(r.Context(), txn); err != nil {
		Error(w, "DB_ERROR", "create failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]string{"status": "accepted"}, http.StatusAccepted)
}
