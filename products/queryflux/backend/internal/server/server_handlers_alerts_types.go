package server

import (
	"github.com/queryflux/backend/internal/domain/entities"
)

// AlertResponse represents the response for alert operations
type AlertResponse struct {
	ID           string  `json:"id"`
	UserID       string  `json:"user_id"`
	ConnectionID string  `json:"connection_id"`
	Type         string  `json:"type"`
	Severity     string  `json:"severity"`
	Status       string  `json:"status"`
	Message      string  `json:"message"`
	Threshold    float64 `json:"threshold"`
	CurrentValue float64 `json:"current_value"`
	ResolvedAt   *string `json:"resolved_at,omitempty"`
	MutedAt      *string `json:"muted_at,omitempty"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}

// AlertListResponse represents the response for listing alerts
type AlertListResponse struct {
	Alerts   []AlertResponse   `json:"alerts"`
	Total    int64             `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"page_size"`
	HasMore  bool              `json:"has_more"`
	Filters  map[string]string `json:"filters,omitempty"`
}

// mapAlertToResponse converts an Alert entity to AlertResponse
func (s *Server) mapAlertToResponse(alert *entities.Alert) AlertResponse {
	response := AlertResponse{
		ID:           alert.ID,
		UserID:       alert.UserID,
		ConnectionID: alert.ConnectionID,
		Type:         alert.Type,
		Severity:     alert.Severity,
		Status:       alert.Status,
		Message:      alert.Message,
		Threshold:    alert.Threshold,
		CurrentValue: alert.CurrentValue,
		CreatedAt:    alert.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt:    alert.UpdatedAt.Format("2006-01-02T15:04:05.000Z"),
	}
	if alert.ResolvedAt != nil {
		resolvedAt := alert.ResolvedAt.Format("2006-01-02T15:04:05.000Z")
		response.ResolvedAt = &resolvedAt
	}
	if alert.MutedAt != nil {
		mutedAt := alert.MutedAt.Format("2006-01-02T15:04:05.000Z")
		response.MutedAt = &mutedAt
	}
	return response
}
