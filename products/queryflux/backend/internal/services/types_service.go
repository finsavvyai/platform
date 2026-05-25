package services

// DatabaseSchema represents database schema information
type DatabaseSchema struct {
	Tables []TableSchema `json:"tables"`
}

// TableSchema represents table schema information
type TableSchema struct {
	Name    string         `json:"name"`
	Columns []ColumnSchema `json:"columns"`
	Indexes []IndexSchema  `json:"indexes"`
}

// ColumnSchema represents column schema information
type ColumnSchema struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	Nullable     bool   `json:"nullable"`
	DefaultValue string `json:"default_value"`
	IsPrimaryKey bool   `json:"is_primary_key"`
	IsForeignKey bool   `json:"is_foreign_key"`
}

// IndexSchema represents index schema information
type IndexSchema struct {
	Name    string   `json:"name"`
	Columns []string `json:"columns"`
	Unique  bool     `json:"unique"`
}

// ConnectionInfo represents database connection information
type ConnectionInfo struct {
	Version         string `json:"version"`
	ServerInfo      string `json:"server_info"`
	DatabaseSize    int64  `json:"database_size"`
	TableCount      int    `json:"table_count"`
	ConnectionCount int    `json:"connection_count"`
}

// QueryOptimization represents query optimization suggestions
type QueryOptimization struct {
	OriginalQuery        string                   `json:"original_query"`
	OptimizedQuery       string                   `json:"optimized_query"`
	Suggestions          []OptimizationSuggestion `json:"suggestions"`
	EstimatedImprovement float64                  `json:"estimated_improvement"`
}

// OptimizationSuggestion represents a single optimization suggestion
type OptimizationSuggestion struct {
	Type        string `json:"type"`
	Description string `json:"description"`
	Impact      string `json:"impact"`
}

// QueryExplanation represents a human-readable query explanation
type QueryExplanation struct {
	Query       string           `json:"query"`
	Explanation string           `json:"explanation"`
	Operations  []QueryOperation `json:"operations"`
	Complexity  string           `json:"complexity"`
}

// QueryOperation represents a single query operation
type QueryOperation struct {
	Type        string  `json:"type"`
	Description string  `json:"description"`
	Cost        float64 `json:"cost"`
}

// PerformanceAnalysis represents query performance analysis
type PerformanceAnalysis struct {
	Query           string                      `json:"query"`
	ExecutionTime   float64                     `json:"execution_time"`
	RowsProcessed   int64                       `json:"rows_processed"`
	MemoryUsage     int64                       `json:"memory_usage"`
	Bottlenecks     []PerformanceBottleneck     `json:"bottlenecks"`
	Recommendations []PerformanceRecommendation `json:"recommendations"`
}

// PerformanceBottleneck represents a performance bottleneck
type PerformanceBottleneck struct {
	Type        string  `json:"type"`
	Description string  `json:"description"`
	Severity    string  `json:"severity"`
	Impact      float64 `json:"impact"`
}

// PerformanceRecommendation represents a performance recommendation
type PerformanceRecommendation struct {
	Type        string `json:"type"`
	Description string `json:"description"`
	Priority    string `json:"priority"`
}
