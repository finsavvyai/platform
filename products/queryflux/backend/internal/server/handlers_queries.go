package server

// Query request/response models.
//
// Handler functions are split into:
//   - handlers_queries_execute.go : execute, explain, mapping helpers
//   - handlers_queries_history.go : schema introspection, query history
//   - handlers_queries_stream.go  : websocket + SSE streaming endpoints

// ExecuteQueryRequest represents the request to execute a query.
type ExecuteQueryRequest struct {
	SQL     string `json:"sql" binding:"required,min=1"`
	Timeout int    `json:"timeout,omitempty"` // Timeout in seconds, default 30
}

// QueryResponse represents the response for query operations.
type QueryResponse struct {
	ID           string                   `json:"id"`
	ConnectionID string                   `json:"connection_id"`
	Name         string                   `json:"name,omitempty"`
	SQL          string                   `json:"sql"`
	Results      []map[string]interface{} `json:"results,omitempty"`
	RowCount     int                      `json:"row_count"`
	Duration     int64                    `json:"duration_ms"`
	Status       string                   `json:"status"`
	Error        string                   `json:"error,omitempty"`
	ExecutedAt   string                   `json:"executed_at"`
	CreatedAt    string                   `json:"created_at"`
}

// QueryListResponse represents the response for listing queries.
type QueryListResponse struct {
	Queries  []QueryResponse `json:"queries"`
	Total    int64           `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"page_size"`
	HasMore  bool            `json:"has_more"`
}

// SchemaResponse represents database schema information.
type SchemaResponse struct {
	Tables []TableInfo `json:"tables"`
}

// TableInfo represents table information.
type TableInfo struct {
	Name    string       `json:"name"`
	Columns []ColumnInfo `json:"columns"`
	Indexes []IndexInfo  `json:"indexes"`
}

// ColumnInfo represents column information.
type ColumnInfo struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	Nullable     bool   `json:"nullable"`
	DefaultValue string `json:"default_value,omitempty"`
	IsPrimaryKey bool   `json:"is_primary_key"`
	IsForeignKey bool   `json:"is_foreign_key"`
}

// IndexInfo represents index information.
type IndexInfo struct {
	Name    string   `json:"name"`
	Columns []string `json:"columns"`
	Unique  bool     `json:"unique"`
}

// ExplainResponse represents query execution plan.
type ExplainResponse struct {
	Query         string                   `json:"query"`
	ExecutionPlan []map[string]interface{} `json:"execution_plan"`
	EstimatedCost float64                  `json:"estimated_cost,omitempty"`
	EstimatedRows int64                    `json:"estimated_rows,omitempty"`
	Explanation   string                   `json:"explanation,omitempty"`
}
