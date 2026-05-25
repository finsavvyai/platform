package api

import (
	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage"
)

// TxnScreenRequest is the request for transaction screening.
type TxnScreenRequest struct {
	TxnID           string `json:"txn_id"`
	SenderName      string `json:"sender_name"`
	SenderCountry   string `json:"sender_country,omitempty"`
	ReceiverName    string `json:"receiver_name,omitempty"`
	ReceiverCountry string `json:"receiver_country,omitempty"`
	AmountCents     int64  `json:"amount_cents,omitempty"`
	Currency        string `json:"currency,omitempty"`
}

// TxnScreenHandler orchestrates screen → hold → case → alert.
type TxnScreenHandler struct {
	entities storage.EntityRepository
	cases    storage.CaseRepository
	alerts   storage.AlertRepository
	audit    storage.AuditRepository
	engine   *screening.Engine
	fatf     *ingestion.FATFConfig
}

// NewTxnScreenHandler creates the orchestrated handler.
func NewTxnScreenHandler(
	entities storage.EntityRepository,
	cases storage.CaseRepository,
	alerts storage.AlertRepository,
	audit storage.AuditRepository,
	engine *screening.Engine,
) *TxnScreenHandler {
	return &TxnScreenHandler{
		entities: entities,
		cases:    cases,
		alerts:   alerts,
		audit:    audit,
		engine:   engine,
		fatf:     ingestion.NewFATFConfig(),
	}
}
