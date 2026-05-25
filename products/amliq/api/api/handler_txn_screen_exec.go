package api

import (
	"context"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// Screen handles POST /api/v1/txn/screen.
// Single endpoint: screen sender+receiver → CLEAR or HELD.
func (h *TxnScreenHandler) Screen(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "UNAUTHORIZED", "missing auth", http.StatusUnauthorized)
		return
	}
	tid, err := domain.NewTenantID(claims.TenantID)
	if err != nil {
		Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
		return
	}

	var req TxnScreenRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID_REQUEST", "bad json", http.StatusBadRequest)
		return
	}
	if req.SenderName == "" {
		Error(w, "VALIDATION", "sender_name required", http.StatusBadRequest)
		return
	}

	start := time.Now()
	ctx := r.Context()
	resp := h.orchestrate(ctx, tid, claims.UserID, req)
	resp.ProcessingMs = time.Since(start).Milliseconds()

	status := http.StatusOK
	if resp.Decision == "HELD" {
		status = http.StatusConflict // 409 = transaction held
	}
	Success(w, resp, status)
}

type txnScreenResponse struct {
	Decision     string                   `json:"decision"`
	TxnID        string                   `json:"txn_id"`
	RiskFlags    []string                 `json:"risk_flags"`
	SenderHits   []map[string]interface{} `json:"sender_hits"`
	ReceiverHits []map[string]interface{} `json:"receiver_hits,omitempty"`
	CaseID       string                   `json:"case_id,omitempty"`
	ProcessingMs int64                    `json:"processing_ms"`
}

func (h *TxnScreenHandler) orchestrate(
	ctx context.Context,
	tid domain.TenantID,
	userID string,
	req TxnScreenRequest,
) txnScreenResponse {
	resp := txnScreenResponse{
		TxnID:    req.TxnID,
		Decision: "CLEAR",
	}

	// 1. FATF country risk check
	h.checkCountryRisk(&resp, req)

	// 2. Screen sender
	senderMatches := h.screenName(req.SenderName)
	if len(senderMatches) > 0 {
		for _, m := range senderMatches {
			resp.SenderHits = append(resp.SenderHits, matchToDetailMap(m, nil))
		}
		resp.Decision = "HELD"
	}

	// 3. Screen receiver (if provided)
	if req.ReceiverName != "" {
		receiverMatches := h.screenName(req.ReceiverName)
		if len(receiverMatches) > 0 {
			for _, m := range receiverMatches {
				resp.ReceiverHits = append(resp.ReceiverHits,
					matchToDetailMap(m, nil))
			}
			resp.Decision = "HELD"
		}
	}

	// 4. If HELD → create compliance case + audit
	if resp.Decision == "HELD" {
		caseID := h.createHoldCase(ctx, tid, userID, req, resp)
		resp.CaseID = caseID
	}

	return resp
}
