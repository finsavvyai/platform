package domain

import "time"

type Connection struct {
	ID                string    `json:"id"`
	UserID            string    `json:"user_id"`
	Name              string    `json:"name"`
	Type              string    `json:"type"`
	Host              string    `json:"host"`
	Port              int       `json:"port"`
	Database          string    `json:"database"`
	Username          string    `json:"username"`
	EncryptedPassword string    `json:"-"`
	SSLMode           string    `json:"ssl,omitempty"`
	CreatedAt         time.Time `json:"createdAt,omitempty"`
	UpdatedAt         time.Time `json:"updatedAt,omitempty"`
}

type CreateConnectionRequest struct {
	Name     string `json:"name" binding:"required"`
	Type     string `json:"type" binding:"required"`
	Host     string `json:"host" binding:"required"`
	Port     int    `json:"port" binding:"required"`
	Database string `json:"database" binding:"required"`
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	SSL      bool   `json:"ssl"`
}

type UpdateConnectionRequest struct {
	Name     string `json:"name"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Database string `json:"database"`
	Username string `json:"username"`
	Password string `json:"password"`
	SSL      *bool  `json:"ssl"`
}

type TestConnectionResponse struct {
	Success   bool    `json:"success"`
	Message   string  `json:"message"`
	LatencyMs float64 `json:"latencyMs,omitempty"`
}
