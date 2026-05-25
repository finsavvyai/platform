package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage"
)

// TxnMonitorHandler handles transaction monitoring endpoints.
type TxnMonitorHandler struct {
	txns     storage.TransactionRepository
	alerts   storage.TxnAlertRepository
	analyzer *screening.TxnAnalyzer
}

// NewTxnMonitorHandler creates the handler.
func NewTxnMonitorHandler(
	t storage.TransactionRepository,
	a storage.TxnAlertRepository,
	analyzer *screening.TxnAnalyzer,
) *TxnMonitorHandler {
	return &TxnMonitorHandler{txns: t, alerts: a, analyzer: analyzer}
}

// AnalyzeTxnRequest is the request body for transaction analysis.
type AnalyzeTxnRequest struct {
	EntityID       string                `json:"entity_id"`
	Transactions   []TxnInput            `json:"transactions"`
	AvgMonthlyTxns int                   `json:"avg_monthly_txns"`
	AvgMonthlyAmt  int64                 `json:"avg_monthly_amt"`
}

// TxnInput represents a single transaction in the request.
type TxnInput struct {
	ID          string `json:"id"`
	AmountCents int64  `json:"amount_cents"`
	Currency    string `json:"currency"`
	Direction   string `json:"direction"`
	Country     string `json:"country"`
	Timestamp   string `json:"timestamp"`
}

// AnalyzeTxns runs pattern detection on submitted transactions.
func (h *TxnMonitorHandler) AnalyzeTxns(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	var req AnalyzeTxnRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	txns := mapInputToTxns(tid, req)
	profile := screening.CustomerProfile{
		EntityID:       req.EntityID,
		AvgMonthlyTxns: req.AvgMonthlyTxns,
		AvgMonthlyAmt:  req.AvgMonthlyAmt,
	}
	alerts, err := h.analyzer.Analyze(r.Context(), txns, profile)
	if err != nil {
		Error(w, "ANALYZE_ERROR", err.Error(), http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"alerts": alerts, "total": len(alerts),
	}, http.StatusOK)
}

// ListPatterns returns active detection patterns.
func (h *TxnMonitorHandler) ListPatterns(w http.ResponseWriter, _ *http.Request) {
	patterns := domain.DefaultPatterns()
	Success(w, map[string]interface{}{
		"patterns": patterns, "total": len(patterns),
	}, http.StatusOK)
}

// ReviewAlert marks a transaction alert as reviewed.
func (h *TxnMonitorHandler) ReviewAlert(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	alertID := PathParam(r, "id")
	if alertID == "" {
		Error(w, "INVALID", "alert id required", http.StatusBadRequest)
		return
	}
	Success(w, map[string]string{
		"id": alertID, "status": "reviewed",
	}, http.StatusOK)
}
