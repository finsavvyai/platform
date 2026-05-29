package domain

import "time"

type SavedQuery struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	Name         string    `json:"name,omitempty"`
	SQL          string    `json:"sql"`
	ConnectionID string    `json:"connectionId"`
	Description  string    `json:"description,omitempty"`
	Tags         []string  `json:"tags,omitempty"`
	CreatedAt    time.Time `json:"createdAt,omitempty"`
	UpdatedAt    time.Time `json:"updatedAt,omitempty"`
}

type CreateSavedQueryRequest struct {
	Name         string   `json:"name"`
	SQL          string   `json:"sql" binding:"required"`
	ConnectionID string   `json:"connectionId" binding:"required"`
	Description  string   `json:"description"`
	Tags         []string `json:"tags"`
}

type UpdateSavedQueryRequest struct {
	Name        string   `json:"name"`
	SQL         string   `json:"sql"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
}
