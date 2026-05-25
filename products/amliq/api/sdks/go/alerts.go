package amliq

import "context"

// Alert represents an AMLIQ screening alert.
type Alert struct {
	ID         string  `json:"id"`
	EntityName string  `json:"entity_name"`
	MatchedName string `json:"matched_name"`
	Confidence float64 `json:"confidence"`
	Status     string  `json:"status"`
	ListID     string  `json:"list_id"`
}

// AlertsResponse wraps the list of alerts.
type AlertsResponse struct {
	Alerts []Alert `json:"alerts"`
	Total  int     `json:"total"`
}

// ListAlerts retrieves alerts for the authenticated tenant.
func (c *Client) ListAlerts(ctx context.Context) (*AlertsResponse, error) {
	var resp AlertsResponse
	err := c.do(ctx, "GET", "/alerts", nil, &resp)
	return &resp, err
}

// ResolveAlertRequest sets the resolution for an alert.
type ResolveAlertRequest struct {
	Resolution    string `json:"resolution"`
	Justification string `json:"justification"`
}

// ResolveAlert resolves an alert with a disposition.
func (c *Client) ResolveAlert(ctx context.Context, alertID string, req ResolveAlertRequest) error {
	return c.do(ctx, "PUT", "/alerts/"+alertID+"/resolve", req, nil)
}
