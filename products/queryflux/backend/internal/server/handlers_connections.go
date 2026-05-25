package server

import (
	"github.com/queryflux/backend/internal/domain/entities"
)

// Connection request/response models

// CreateConnectionRequest represents the request to create a new connection
type CreateConnectionRequest struct {
	Name     string            `json:"name" binding:"required,min=1,max=100"`
	Type     string            `json:"type" binding:"required,oneof=postgresql mysql mongodb redis sqlite oracle sqlserver mariadb cassandra neo4j influxdb dynamodb memcached"`
	Host     string            `json:"host" binding:"required,min=1,max=255"`
	Port     int               `json:"port" binding:"required,min=1,max=65535"`
	Database string            `json:"database" binding:"required,min=1,max=100"`
	Username string            `json:"username" binding:"required,min=1,max=100"`
	Password string            `json:"password" binding:"required,min=1"`
	SSL      bool              `json:"ssl"`
	Options  map[string]string `json:"options"`
}

// UpdateConnectionRequest represents the request to update a connection
type UpdateConnectionRequest struct {
	Name     *string           `json:"name,omitempty" binding:"omitempty,min=1,max=100"`
	Host     *string           `json:"host,omitempty" binding:"omitempty,min=1,max=255"`
	Port     *int              `json:"port,omitempty" binding:"omitempty,min=1,max=65535"`
	Database *string           `json:"database,omitempty" binding:"omitempty,min=1,max=100"`
	Username *string           `json:"username,omitempty" binding:"omitempty,min=1,max=100"`
	Password *string           `json:"password,omitempty" binding:"omitempty,min=1"`
	SSL      *bool             `json:"ssl,omitempty"`
	Options  map[string]string `json:"options,omitempty"`
}

// ConnectionResponse represents the response for connection operations
type ConnectionResponse struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Type      string            `json:"type"`
	Host      string            `json:"host"`
	Port      int               `json:"port"`
	Database  string            `json:"database"`
	Username  string            `json:"username"`
	SSL       bool              `json:"ssl"`
	Options   map[string]string `json:"options"`
	Status    string            `json:"status"`
	LastUsed  *string           `json:"last_used"`
	CreatedAt string            `json:"created_at"`
	UpdatedAt string            `json:"updated_at"`
}

// ConnectionListResponse represents the response for listing connections
type ConnectionListResponse struct {
	Connections []ConnectionResponse `json:"connections"`
	Total       int64                `json:"total"`
	Page        int                  `json:"page"`
	PageSize    int                  `json:"page_size"`
	HasMore     bool                 `json:"has_more"`
}

// TestConnectionResponse represents the response for testing a connection
type TestConnectionResponse struct {
	Success    bool   `json:"success"`
	Message    string `json:"message"`
	Latency    int64  `json:"latency_ms,omitempty"`
	ServerInfo string `json:"server_info,omitempty"`
}

// mapConnectionToResponse converts a Connection entity to ConnectionResponse
func (s *Server) mapConnectionToResponse(conn *entities.Connection) ConnectionResponse {
	response := ConnectionResponse{
		ID:        conn.ID,
		Name:      conn.Name,
		Type:      conn.Type,
		Host:      conn.Host,
		Port:      conn.Port,
		Database:  conn.Database,
		Username:  conn.Username,
		SSL:       conn.SSL,
		Options:   conn.Options,
		Status:    conn.Status,
		CreatedAt: conn.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt: conn.UpdatedAt.Format("2006-01-02T15:04:05.000Z"),
	}

	if conn.LastUsed != nil {
		lastUsed := conn.LastUsed.Format("2006-01-02T15:04:05.000Z")
		response.LastUsed = &lastUsed
	}

	return response
}

// getMaxConnectionsForPlan returns the connection limit for a subscription plan.
// -1 means unlimited.
func (s *Server) getMaxConnectionsForPlan(planType string) int {
	limits := map[string]int{
		"free":       3,
		"monthly":    -1, // Unlimited
		"yearly":     -1, // Unlimited
		"lifetime":   -1, // Unlimited
		"enterprise": -1, // Unlimited
	}

	if limit, exists := limits[planType]; exists {
		return limit
	}
	return 3 // Default free limit
}
