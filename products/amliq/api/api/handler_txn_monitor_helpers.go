package api

import (
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func mapInputToTxns(tid domain.TenantID, req AnalyzeTxnRequest) []domain.Transaction {
	txns := make([]domain.Transaction, len(req.Transactions))
	for i, input := range req.Transactions {
		ts, _ := time.Parse(time.RFC3339, input.Timestamp)
		txns[i] = domain.Transaction{
			ID:          input.ID,
			TenantID:    tid,
			EntityID:    req.EntityID,
			AmountCents: input.AmountCents,
			Currency:    input.Currency,
			Direction:   input.Direction,
			Country:     input.Country,
			Timestamp:   ts,
		}
	}
	return txns
}
