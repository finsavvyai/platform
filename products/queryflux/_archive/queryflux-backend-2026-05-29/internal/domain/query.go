package domain

import "time"

type Query struct {
	ID         string
	DatabaseID string
	SQL        string
	Result     interface{}
	ExecutedAt time.Time
	ExecutedBy string
	DryRun     bool
	Error      string
}

type QueryRequest struct {
	DatabaseID string `json:"database_id" binding:"required"`
	SQL        string `json:"sql" binding:"required"`
	DryRun     bool   `json:"dry_run"`
}

type QueryResponse struct {
	Rows         []map[string]interface{} `json:"rows,omitempty"`
	RowsAffected int64                    `json:"rows_affected,omitempty"`
	ExecutionMs  float64                  `json:"execution_ms"`
	SQL          string                   `json:"sql"`
	Error        string                   `json:"error,omitempty"`
}
