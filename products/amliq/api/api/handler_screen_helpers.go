package api

import (
	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
)

func (sh *ScreenHandler) createScreeningAuditsAndAlerts(
	tid domain.TenantID,
	screenResp domain.ScreenResponse,
	userID string,
) {
	tenant, err := sh.tenants.GetByID(tid)
	if err != nil {
		return
	}

	if userID == "" {
		userID = "system"
	}

	auditEntry, err := domain.NewAuditEntry(
		tid,
		domain.AuditActionScreeningPerformed,
		userID,
		"Screening",
		screenResp.ID,
	)
	if err == nil {
		sh.audit.Create(auditEntry)
	}

	postProc := screening.PostProcess(screenResp.Matches,
		tenant.Config)

	sh.createAlerts(tid, screenResp.ID, postProc.Escalated, userID)
	sh.createAlerts(tid, screenResp.ID, postProc.Review, userID)
}

func (sh *ScreenHandler) createAlerts(
	tid domain.TenantID,
	screeningID string,
	matches []domain.MatchResult,
	userID string,
) {
	for _, match := range matches {
		alert, err := domain.NewAlert(tid, screeningID, match)
		if err == nil {
			sh.alerts.Create(alert)

			auditAlert, err := domain.NewAuditEntry(
				tid,
				domain.AuditActionAlertCreated,
				userID,
				"Alert",
				alert.ID,
			)
			if err == nil {
				sh.audit.Create(auditAlert)
			}
		}
	}
}
