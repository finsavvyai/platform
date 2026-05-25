package api

import (
	"github.com/aegis-aml/aegis/internal/storage"
)

type AlertHandler struct {
	alerts storage.AlertRepository
	audit  storage.AuditRepository
}

func NewAlertHandler(
	alerts storage.AlertRepository,
	audit storage.AuditRepository,
) *AlertHandler {
	return &AlertHandler{
		alerts: alerts,
		audit:  audit,
	}
}

type ResolveAlertRequest struct {
	Justification string `json:"justification"`
}
