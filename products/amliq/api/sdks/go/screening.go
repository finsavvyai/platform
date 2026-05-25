package amliq

import "context"

// ScreenRequest is the input for a screening API call.
type ScreenRequest struct {
	Name        string `json:"name"`
	EntityType  string `json:"entity_type,omitempty"`
	Country     string `json:"country,omitempty"`
	DOB         string `json:"dob,omitempty"`
	Identifiers map[string]string `json:"identifiers,omitempty"`
}

// ScreenResult is a single match from the screening API.
type ScreenResult struct {
	EntityID   string  `json:"entity_id"`
	Name       string  `json:"matched_name"`
	Confidence float64 `json:"confidence"`
	ListID     string  `json:"list_id"`
	Evidence   []Evidence `json:"evidence"`
}

// Evidence describes why a match was flagged.
type Evidence struct {
	Layer     string  `json:"layer"`
	Algorithm string  `json:"algorithm"`
	Score     float64 `json:"score"`
}

// ScreenResponse wraps the screening API response.
type ScreenResponse struct {
	Results []ScreenResult `json:"results"`
	Total   int            `json:"total"`
}

// Screen performs a single entity screening.
func (c *Client) Screen(ctx context.Context, req ScreenRequest) (*ScreenResponse, error) {
	var resp ScreenResponse
	err := c.do(ctx, "POST", "/screen", req, &resp)
	return &resp, err
}

// BatchScreenRequest holds multiple screening inputs.
type BatchScreenRequest struct {
	Entities []ScreenRequest `json:"entities"`
}

// BatchScreen performs batch screening of multiple entities.
func (c *Client) BatchScreen(ctx context.Context, req BatchScreenRequest) (*ScreenResponse, error) {
	var resp ScreenResponse
	err := c.do(ctx, "POST", "/batch", req, &resp)
	return &resp, err
}
