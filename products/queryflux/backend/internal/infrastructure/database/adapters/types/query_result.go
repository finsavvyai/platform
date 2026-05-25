package types

// QueryResult is the result envelope every adapter returns from ExecuteQuery.
// See QUERY_CONTRACT.md §2 for binding semantics.
//
// Note: Rows is `[]map[string]interface{}` (NOT `[][]any`) — the handler and
// frontend depend on the map shape. Columns is ordered for downstream
// conversion when a positional shape is required.
type QueryResult struct {
	Columns       []ColumnInfo             `json:"columns"`
	Rows          []map[string]interface{} `json:"rows"`
	Count         int64                    `json:"count"`
	Query         string                   `json:"query,omitempty"`
	RowsAffected  int64                    `json:"rows_affected"`
	ExecutionTime int64                    `json:"execution_time_ms"`
	// Truncated is set by the runner (or adapter) when MaxRows is hit and
	// the result was clipped. Default false. See QUERY_CONTRACT.md §2.
	Truncated bool   `json:"truncated"`
	Error     string `json:"error,omitempty"`
	Success   bool   `json:"success"`
}
