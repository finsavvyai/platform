package sdln

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// DatabaseOptimizationService provides comprehensive database performance optimization
type DatabaseOptimizationService struct {
	*BaseService
	queryOptimizer     *QueryOptimizer
	connectionPool     *ConnectionPool
	indexManager       *IndexManager
	performanceMonitor *DatabasePerformanceMonitor
	queryCache         *QueryCache
	analyzer           *QueryAnalyzer
}

// NewDatabaseOptimizationService creates a new database optimization service
func NewDatabaseOptimizationService(client *Client) *DatabaseOptimizationService {
	service := &DatabaseOptimizationService{
		BaseService:        NewBaseService(client, "db_opt", "api/v1/db-optimization"),
		queryOptimizer:     NewQueryOptimizer(),
		connectionPool:     NewConnectionPool(),
		indexManager:       NewIndexManager(),
		performanceMonitor: NewDatabasePerformanceMonitor(),
		queryCache:         NewQueryCache(),
		analyzer:           NewQueryAnalyzer(),
	}

	return service
}

// QueryOptimizer optimizes SQL queries for better performance
type QueryOptimizer struct {
	rules       []OptimizationRule
	planCache   map[string]*ExecutionPlan
	suggestions map[string][]OptimizationSuggestion
	mutex       sync.RWMutex
}

// OptimizationRule represents a query optimization rule
type OptimizationRule struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Pattern    string `json:"pattern"`
	Suggestion string `json:"suggestion"`
	Impact     string `json:"impact"`   // high, medium, low
	Category   string `json:"category"` // join, index, where, order_by, etc.
	Enabled    bool   `json:"enabled"`
}

// ExecutionPlan represents a SQL execution plan
type ExecutionPlan struct {
	Query          string                 `json:"query"`
	Plan           []PlanStep             `json:"plan"`
	Cost           float64                `json:"cost"`
	ExecutionTime  time.Duration          `json:"execution_time"`
	Rows           int64                  `json:"rows"`
	Indexes        []string               `json:"indexes"`
	TableScans     []TableScan            `json:"table_scans"`
	Joins          []JoinOperation        `json:"joins"`
	SortOperations []SortOperation        `json:"sort_operations"`
	Metadata       map[string]interface{} `json:"metadata"`
	GeneratedAt    time.Time              `json:"generated_at"`
}

// PlanStep represents a step in the execution plan
type PlanStep struct {
	Operation   string                 `json:"operation"`
	Table       string                 `json:"table"`
	Index       string                 `json:"index,omitempty"`
	Cost        float64                `json:"cost"`
	Rows        int64                  `json:"rows"`
	Description string                 `json:"description"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// OptimizationSuggestion represents an optimization suggestion
type OptimizationSuggestion struct {
	ID            string                 `json:"id"`
	Type          string                 `json:"type"` // index, query, schema, etc.
	Description   string                 `json:"description"`
	SQL           string                 `json:"sql,omitempty"`
	Impact        string                 `json:"impact"`
	EstimatedGain float64                `json:"estimated_gain"` // percentage
	Priority      int                    `json:"priority"`
	Implemented   bool                   `json:"implemented"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

func NewQueryOptimizer() *QueryOptimizer {
	optimizer := &QueryOptimizer{
		rules:       make([]OptimizationRule, 0),
		planCache:   make(map[string]*ExecutionPlan),
		suggestions: make(map[string][]OptimizationSuggestion),
	}

	optimizer.initializeRules()
	return optimizer
}

func (q *QueryOptimizer) initializeRules() {
	rules := []OptimizationRule{
		{
			ID:         "missing_where_clause",
			Name:       "Missing WHERE Clause",
			Pattern:    `(?i)SELECT\s+\*\s+FROM\s+\w+\s*$`,
			Suggestion: "Add WHERE clause to limit result set",
			Impact:     "high",
			Category:   "where",
			Enabled:    true,
		},
		{
			ID:         "select_star",
			Name:       "SELECT * Optimization",
			Pattern:    `(?i)SELECT\s+\*\s+FROM`,
			Suggestion: "Specify only required columns instead of SELECT *",
			Impact:     "medium",
			Category:   "select",
			Enabled:    true,
		},
		{
			ID:         "missing_index_on_join",
			Name:       "Missing Index on Join Column",
			Pattern:    `(?i)JOIN\s+\w+\s+(?:AS\s+)?\w+\s+ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)`,
			Suggestion: "Add index on join columns for better performance",
			Impact:     "high",
			Category:   "join",
			Enabled:    true,
		},
		{
			ID:         "order_by_without_index",
			Name:       "ORDER BY Without Index",
			Pattern:    `(?i)ORDER\s+BY\s+[^Ll][Ii][Mm][Ii][Tt]`,
			Suggestion: "Add index on ORDER BY columns to avoid filesort",
			Impact:     "medium",
			Category:   "order_by",
			Enabled:    true,
		},
		{
			ID:         "subquery_to_join",
			Name:       "Subquery Can Be Converted to Join",
			Pattern:    `(?i)SELECT.*FROM.*WHERE.*IN\s*\(SELECT`,
			Suggestion: "Consider converting subquery to JOIN for better performance",
			Impact:     "medium",
			Category:   "subquery",
			Enabled:    true,
		},
		{
			ID:         "like_leading_wildcard",
			Name:       "LIKE with Leading Wildcard",
			Pattern:    `(?i)LIKE\s+['\"]%`,
			Suggestion: "Avoid leading wildcards in LIKE patterns - use full-text search",
			Impact:     "high",
			Category:   "where",
			Enabled:    true,
		},
		{
			ID:         "function_in_where",
			Name:       "Function on Column in WHERE",
			Pattern:    `(?i)WHERE.*\w+\([^)]*\)\s*[=<>!]`,
			Suggestion: "Avoid functions on columns in WHERE clause - prevents index usage",
			Impact:     "high",
			Category:   "where",
			Enabled:    true,
		},
		{
			ID:         "implicit_conversion",
			Name:       "Implicit Data Type Conversion",
			Pattern:    `(?i)WHERE.*\w+\s*[=<>!]\s*['\"][^'\"]*['\"]`,
			Suggestion: "Ensure data types match in WHERE conditions to avoid implicit conversion",
			Impact:     "medium",
			Category:   "where",
			Enabled:    true,
		},
	}

	q.rules = rules
}

// OptimizeQuery analyzes and optimizes a SQL query
func (q *QueryOptimizer) OptimizeQuery(ctx context.Context, query string) (*OptimizationResult, error) {
	start := time.Now()

	// Check cache first
	cacheKey := q.getCacheKey(query)
	if cached := q.getCachedOptimization(cacheKey); cached != nil {
		return cached, nil
	}

	result := &OptimizationResult{
		OriginalQuery:  query,
		OptimizedQuery: query,
		Suggestions:    make([]OptimizationSuggestion, 0),
		ExecutionPlan:  q.generateExecutionPlan(query),
		AnalysisTime:   time.Since(start),
		GeneratedAt:    time.Now(),
	}

	// Apply optimization rules
	for _, rule := range q.rules {
		if !rule.Enabled {
			continue
		}

		matched, suggestion := q.applyRule(rule, query)
		if matched {
			result.Suggestions = append(result.Suggestions, suggestion)
		}
	}

	// Generate optimized query
	result.OptimizedQuery = q.generateOptimizedQuery(query, result.Suggestions)

	// Calculate potential improvement
	result.EstimatedImprovement = q.calculateImprovement(result.Suggestions)

	// Cache result
	q.cacheOptimization(cacheKey, result)

	return result, nil
}

// OptimizationResult represents the result of query optimization
type OptimizationResult struct {
	OriginalQuery        string                   `json:"original_query"`
	OptimizedQuery       string                   `json:"optimized_query"`
	Suggestions          []OptimizationSuggestion `json:"suggestions"`
	ExecutionPlan        *ExecutionPlan           `json:"execution_plan"`
	EstimatedImprovement float64                  `json:"estimated_improvement"` // percentage
	AnalysisTime         time.Duration            `json:"analysis_time"`
	GeneratedAt          time.Time                `json:"generated_at"`
	Metadata             map[string]interface{}   `json:"metadata,omitempty"`
}

// applyRule applies an optimization rule to a query
func (q *QueryOptimizer) applyRule(rule OptimizationRule, query string) (bool, OptimizationSuggestion) {
	pattern, err := regexp.Compile(rule.Pattern)
	if err != nil {
		return false, OptimizationSuggestion{}
	}

	if !pattern.MatchString(query) {
		return false, OptimizationSuggestion{}
	}

	suggestion := OptimizationSuggestion{
		ID:          generateID(),
		Type:        rule.Category,
		Description: rule.Suggestion,
		Impact:      rule.Impact,
		Priority:    q.getPriorityFromImpact(rule.Impact),
		Implemented: false,
	}

	return true, suggestion
}

// generateExecutionPlan generates a simulated execution plan
func (q *QueryOptimizer) generateExecutionPlan(query string) *ExecutionPlan {
	// Simulate execution plan generation
	plan := &ExecutionPlan{
		Query:          query,
		Plan:           make([]PlanStep, 0),
		Cost:           q.estimateQueryCost(query),
		ExecutionTime:  time.Duration(q.estimateExecutionTime(query)) * time.Millisecond,
		Rows:           q.estimateRowCount(query),
		Indexes:        q.identifyUsedIndexes(query),
		TableScans:     q.identifyTableScans(query),
		Joins:          q.identifyJoins(query),
		SortOperations: q.identifySortOperations(query),
		Metadata:       make(map[string]interface{}),
		GeneratedAt:    time.Now(),
	}

	// Generate plan steps
	steps := q.generatePlanSteps(query)
	plan.Plan = steps

	return plan
}

// estimateQueryCost estimates the computational cost of a query
func (q *QueryOptimizer) estimateQueryCost(query string) float64 {
	cost := 0.0

	// Base cost for any query
	cost += 10.0

	// Add cost for tables
	tables := q.extractTables(query)
	cost += float64(len(tables)) * 50.0

	// Add cost for joins
	joins := strings.Count(strings.ToUpper(query), "JOIN")
	cost += float64(joins) * 100.0

	// Add cost for WHERE clauses
	if strings.Contains(strings.ToUpper(query), "WHERE") {
		cost += 25.0
	}

	// Add cost for ORDER BY
	if strings.Contains(strings.ToUpper(query), "ORDER BY") {
		cost += 75.0
	}

	// Add cost for GROUP BY
	if strings.Contains(strings.ToUpper(query), "GROUP BY") {
		cost += 150.0
	}

	// Add cost for subqueries
	subqueryCount := strings.Count(strings.ToUpper(query), "(SELECT")
	cost += float64(subqueryCount) * 200.0

	return cost
}

// estimateExecutionTime estimates execution time in milliseconds
func (q *QueryOptimizer) estimateExecutionTime(query string) int64 {
	cost := q.estimateQueryCost(query)
	return int64(cost * 2) // Rough estimate: cost * 2ms
}

// estimateRowCount estimates the number of rows returned
func (q *QueryOptimizer) estimateRowCount(query string) int64 {
	// Simulate row count estimation
	baseCount := int64(1000)

	// Adjust based on WHERE clause
	if strings.Contains(strings.ToUpper(query), "WHERE") {
		baseCount = baseCount / 10 // WHERE typically reduces results
	}

	// Adjust based on JOINs
	joinCount := strings.Count(strings.ToUpper(query), "JOIN")
	baseCount = baseCount * int64(joinCount+1)

	// Adjust based on LIMIT
	if strings.Contains(strings.ToUpper(query), "LIMIT") {
		baseCount = 100 // Assume LIMIT reduces to small number
	}

	return baseCount
}

// identifyUsedIndexes identifies indexes that would be used
func (q *QueryOptimizer) identifyUsedIndexes(query string) []string {
	indexes := make([]string, 0)

	// Simulate index identification
	tables := q.extractTables(query)
	for _, table := range tables {
		// Check for potential primary key usage
		if strings.Contains(strings.ToUpper(query), "WHERE "+table+".ID") {
			indexes = append(indexes, table+"_pkey")
		}

		// Check for potential index usage on WHERE clauses
		if strings.Contains(strings.ToUpper(query), "WHERE "+table+".") {
			indexes = append(indexes, table+"_idx")
		}
	}

	return indexes
}

// identifyTableScans identifies table scans in the execution plan
func (q *QueryOptimizer) identifyTableScans(query string) []TableScan {
	scans := make([]TableScan, 0)
	tables := q.extractTables(query)

	for _, table := range tables {
		scan := TableScan{
			Table:    table,
			Type:     "ALL", // Assume full scan unless indexed
			Rows:     q.estimateRowCount(query) / int64(len(tables)),
			Cost:     50.0,
			Duration: time.Millisecond * 10,
		}

		// Check if this might be an index scan
		if strings.Contains(strings.ToUpper(query), "WHERE "+table+".") {
			scan.Type = "INDEX"
			scan.Cost = 25.0
			scan.Duration = time.Millisecond * 5
		}

		scans = append(scans, scan)
	}

	return scans
}

// identifyJoins identifies join operations
func (q *QueryOptimizer) identifyJoins(query string) []JoinOperation {
	joins := make([]JoinOperation, 0)

	// Simple regex to find JOIN operations
	joinPattern := regexp.MustCompile(`(?i)(?:INNER\s+|LEFT\s+|RIGHT\s+|FULL\s+)?JOIN\s+(\w+)(?:\s+AS\s+(\w+))?\s+ON\s+([^;]+)`)
	matches := joinPattern.FindAllStringSubmatch(query, -1)

	for _, match := range matches {
		if len(match) > 1 {
			join := JoinOperation{
				Type:          q.extractJoinType(match[0]),
				LeftTable:     q.extractLeftTable(query, match[0]),
				RightTable:    match[1],
				RightAlias:    match[2],
				Condition:     match[3],
				Method:        "HASH_JOIN", // Assume hash join
				Cost:          100.0,
				EstimatedRows: q.estimateRowCount(query) / 2,
			}
			joins = append(joins, join)
		}
	}

	return joins
}

// identifySortOperations identifies sort operations
func (q *QueryOptimizer) identifySortOperations(query string) []SortOperation {
	sorts := make([]SortOperation, 0)

	// Check for ORDER BY
	orderPattern := regexp.MustCompile(`(?i)ORDER\s+BY\s+([^;\s]+(?:\s+(?:ASC|DESC))?)`)
	matches := orderPattern.FindAllStringSubmatch(query, -1)

	for _, match := range matches {
		if len(match) > 1 {
			sort := SortOperation{
				Columns:    strings.Split(match[1], ","),
				Method:     "FILE_SORT", // Assume filesort
				UsingIndex: false,
				Cost:       75.0,
				Duration:   time.Millisecond * 15,
			}

			// Check if this might use an index
			if strings.Contains(strings.ToUpper(query), "WHERE") && strings.Contains(match[1], ".") {
				sort.UsingIndex = true
				sort.Method = "INDEX_SORT"
				sort.Cost = 25.0
				sort.Duration = time.Millisecond * 5
			}

			sorts = append(sorts, sort)
		}
	}

	return sorts
}

// generatePlanSteps generates execution plan steps
func (q *QueryOptimizer) generatePlanSteps(query string) []PlanStep {
	steps := make([]PlanStep, 0)
	stepCount := 0

	// Add table scan steps
	tables := q.extractTables(query)
	for _, table := range tables {
		step := PlanStep{
			Operation:   "SCAN",
			Table:       table,
			Cost:        50.0,
			Rows:        q.estimateRowCount(query) / int64(len(tables)),
			Description: fmt.Sprintf("Table scan on %s", table),
		}
		steps = append(steps, step)
		stepCount++
	}

	// Add join steps
	joins := q.identifyJoins(query)
	for _, join := range joins {
		step := PlanStep{
			Operation:   "JOIN",
			Table:       join.RightTable,
			Cost:        join.Cost,
			Rows:        join.EstimatedRows,
			Description: fmt.Sprintf("Join %s with %s", join.LeftTable, join.RightTable),
		}
		steps = append(steps, step)
		stepCount++
	}

	// Add sort step if ORDER BY
	if strings.Contains(strings.ToUpper(query), "ORDER BY") {
		step := PlanStep{
			Operation:   "SORT",
			Cost:        75.0,
			Rows:        q.estimateRowCount(query),
			Description: "Sort result set",
		}
		steps = append(steps, step)
		stepCount++
	}

	// Add filter step if WHERE
	if strings.Contains(strings.ToUpper(query), "WHERE") {
		step := PlanStep{
			Operation:   "FILTER",
			Cost:        25.0,
			Rows:        q.estimateRowCount(query),
			Description: "Apply WHERE conditions",
		}
		steps = append(steps, step)
		stepCount++
	}

	return steps
}

// generateOptimizedQuery generates an optimized version of the query
func (q *QueryOptimizer) generateOptimizedQuery(original string, suggestions []OptimizationSuggestion) string {
	optimized := original

	for _, suggestion := range suggestions {
		switch suggestion.Type {
		case "select":
			// Replace SELECT * with specific columns (simulation)
			optimized = strings.ReplaceAll(optimized, "SELECT *", "SELECT id, name, created_at")
		case "join":
			// Add index hint (simulation)
			if strings.Contains(optimized, "JOIN") {
				optimized = strings.ReplaceAll(optimized, "JOIN", "JOIN /*+ INDEX */")
			}
		case "where":
			// Optimize WHERE clause (simulation)
			optimized = strings.ReplaceAll(optimized, "LIKE '%", "LIKE '")
		}
	}

	return optimized
}

// calculateImprovement calculates the estimated performance improvement
func (q *QueryOptimizer) calculateImprovement(suggestions []OptimizationSuggestion) float64 {
	totalImprovement := 0.0

	for _, suggestion := range suggestions {
		totalImprovement += suggestion.EstimatedGain
	}

	// Cap at 90% improvement
	if totalImprovement > 90.0 {
		totalImprovement = 90.0
	}

	return totalImprovement
}

// Helper functions

func (q *QueryOptimizer) getCacheKey(query string) string {
	hash := sha256.Sum256([]byte(query))
	return hex.EncodeToString(hash[:])
}

func (q *QueryOptimizer) getCachedOptimization(key string) *OptimizationResult {
	q.mutex.RLock()
	defer q.mutex.RUnlock()

	// In real implementation, this would check a cache
	return nil
}

func (q *QueryOptimizer) cacheOptimization(key string, result *OptimizationResult) {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	// In real implementation, this would store in cache
}

func (q *QueryOptimizer) getPriorityFromImpact(impact string) int {
	switch impact {
	case "high":
		return 1
	case "medium":
		return 2
	case "low":
		return 3
	default:
		return 3
	}
}

func (q *QueryOptimizer) extractTables(query string) []string {
	// Simple table extraction - in real implementation, use SQL parser
	pattern := regexp.MustCompile(`(?i)FROM\s+(\w+)(?:\s+AS\s+(\w+))?`)
	matches := pattern.FindAllStringSubmatch(query, -1)

	tables := make([]string, 0)
	for _, match := range matches {
		if len(match) > 1 {
			tables = append(tables, match[1])
		}
	}

	return tables
}

func (q *QueryOptimizer) extractJoinType(joinClause string) string {
	joinClause = strings.ToUpper(joinClause)
	if strings.Contains(joinClause, "INNER JOIN") {
		return "INNER"
	} else if strings.Contains(joinClause, "LEFT JOIN") {
		return "LEFT"
	} else if strings.Contains(joinClause, "RIGHT JOIN") {
		return "RIGHT"
	} else if strings.Contains(joinClause, "FULL JOIN") {
		return "FULL"
	}
	return "INNER"
}

func (q *QueryOptimizer) extractLeftTable(query, joinClause string) string {
	// Simplified extraction - in real implementation, parse SQL properly
	parts := strings.Split(query, joinClause)
	if len(parts) > 0 {
		leftPart := parts[0]
		tables := q.extractTables(leftPart)
		if len(tables) > 0 {
			return tables[len(tables)-1] // Return the last table before the join
		}
	}
	return "unknown"
}

// TableScan represents a table scan operation
type TableScan struct {
	Table    string        `json:"table"`
	Type     string        `json:"type"` // ALL, INDEX
	Rows     int64         `json:"rows"`
	Cost     float64       `json:"cost"`
	Duration time.Duration `json:"duration"`
}

// JoinOperation represents a join operation
type JoinOperation struct {
	Type          string        `json:"type"`
	LeftTable     string        `json:"left_table"`
	RightTable    string        `json:"right_table"`
	RightAlias    string        `json:"right_alias,omitempty"`
	Condition     string        `json:"condition"`
	Method        string        `json:"method"` // NESTED_LOOP, HASH_JOIN, MERGE_JOIN
	Cost          float64       `json:"cost"`
	EstimatedRows int64         `json:"estimated_rows"`
	Duration      time.Duration `json:"duration,omitempty"`
}

// SortOperation represents a sort operation
type SortOperation struct {
	Columns    []string      `json:"columns"`
	Method     string        `json:"method"` // FILE_SORT, INDEX_SORT
	UsingIndex bool          `json:"using_index"`
	Cost       float64       `json:"cost"`
	Duration   time.Duration `json:"duration"`
}

// ConnectionPool manages database connections efficiently
type ConnectionPool struct {
	connections chan *Connection
	config      *PoolConfig
	stats       *PoolStats
	mutex       sync.RWMutex
}

// PoolConfig represents connection pool configuration
type PoolConfig struct {
	MaxConnections    int           `json:"max_connections"`
	MinConnections    int           `json:"min_connections"`
	IdleTimeout       time.Duration `json:"idle_timeout"`
	MaxLifetime       time.Duration `json:"max_lifetime"`
	ConnectTimeout    time.Duration `json:"connect_timeout"`
	QueryTimeout      time.Duration `json:"query_timeout"`
	HealthCheckPeriod time.Duration `json:"health_check_period"`
}

// Connection represents a database connection
type Connection struct {
	ID        string                 `json:"id"`
	CreatedAt time.Time              `json:"created_at"`
	LastUsed  time.Time              `json:"last_used"`
	Used      int64                  `json:"used"`
	Healthy   bool                   `json:"healthy"`
	InUse     bool                   `json:"in_use"`
	Database  string                 `json:"database"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// PoolStats represents connection pool statistics
type PoolStats struct {
	TotalConnections     int64         `json:"total_connections"`
	ActiveConnections    int64         `json:"active_connections"`
	IdleConnections      int64         `json:"idle_connections"`
	CreatedConnections   int64         `json:"created_connections"`
	DestroyedConnections int64         `json:"destroyed_connections"`
	AvgWaitTime          time.Duration `json:"avg_wait_time"`
	PeakConnections      int64         `json:"peak_connections"`
}

func NewConnectionPool() *ConnectionPool {
	config := &PoolConfig{
		MaxConnections:    20,
		MinConnections:    5,
		IdleTimeout:       time.Minute * 5,
		MaxLifetime:       time.Hour,
		ConnectTimeout:    time.Second * 10,
		QueryTimeout:      time.Second * 30,
		HealthCheckPeriod: time.Minute * 1,
	}

	pool := &ConnectionPool{
		connections: make(chan *Connection, config.MaxConnections),
		config:      config,
		stats:       &PoolStats{},
	}

	// Initialize minimum connections
	go pool.initializeConnections()

	return pool
}

// GetConnection gets a connection from the pool
func (p *ConnectionPool) GetConnection(ctx context.Context) (*Connection, error) {
	start := time.Now()

	select {
	case conn := <-p.connections:
		conn.InUse = true
		conn.LastUsed = time.Now()
		conn.Used++

		// Update stats
		p.updateWaitStats(time.Since(start))

		return conn, nil
	case <-ctx.Done():
		return nil, fmt.Errorf("timeout waiting for connection")
	}
}

// ReleaseConnection releases a connection back to the pool
func (p *ConnectionPool) ReleaseConnection(conn *Connection) error {
	if !conn.InUse {
		return fmt.Errorf("connection is not in use")
	}

	conn.InUse = false
	conn.LastUsed = time.Now()

	select {
	case p.connections <- conn:
		return nil
	default:
		// Pool is full, close this connection
		return p.destroyConnection(conn)
	}
}

// initializeConnections creates initial connections
func (p *ConnectionPool) initializeConnections() {
	for i := 0; i < p.config.MinConnections; i++ {
		conn := &Connection{
			ID:        fmt.Sprintf("conn_%d", i),
			CreatedAt: time.Now(),
			LastUsed:  time.Now(),
			Used:      0,
			Healthy:   true,
			InUse:     false,
			Database:  "primary",
		}

		select {
		case p.connections <- conn:
			p.stats.TotalConnections++
			p.stats.CreatedConnections++
		default:
			break
		}
	}
}

// destroyConnection destroys a connection
func (p *ConnectionPool) destroyConnection(conn *Connection) error {
	p.stats.TotalConnections--
	p.stats.DestroyedConnections++
	return nil
}

// updateWaitStats updates waiting time statistics
func (p *ConnectionPool) updateWaitStats(waitTime time.Duration) {
	// Simple moving average
	if p.stats.AvgWaitTime == 0 {
		p.stats.AvgWaitTime = waitTime
	} else {
		p.stats.AvgWaitTime = (p.stats.AvgWaitTime + waitTime) / 2
	}
}

// GetStats returns pool statistics
func (p *ConnectionPool) GetStats() *PoolStats {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	p.stats.ActiveConnections = 0
	p.stats.IdleConnections = 0

	// Count active and idle connections
	for i := 0; i < len(p.connections); i++ {
		select {
		case conn := <-p.connections:
			if conn.InUse {
				p.stats.ActiveConnections++
			} else {
				p.stats.IdleConnections++
			}
			p.connections <- conn // Put it back
		default:
			break
		}
	}

	return p.stats
}

// IndexManager manages database indexes for optimal performance
type IndexManager struct {
	indexes     map[string]*DatabaseIndex
	suggestions map[string][]IndexSuggestion
	mutex       sync.RWMutex
}

// DatabaseIndex represents a database index
type DatabaseIndex struct {
	ID           string                 `json:"id"`
	Table        string                 `json:"table"`
	Columns      []string               `json:"columns"`
	Type         string                 `json:"type"` // BTREE, HASH, GIN, etc.
	Unique       bool                   `json:"unique"`
	Primary      bool                   `json:"primary"`
	Size         int64                  `json:"size"`
	Cardinality  int64                  `json:"cardinality"`
	Usage        *IndexUsage            `json:"usage"`
	CreatedAt    time.Time              `json:"created_at"`
	LastAnalyzed time.Time              `json:"last_analyzed"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// IndexUsage represents index usage statistics
type IndexUsage struct {
	Scans       int64     `json:"scans"`
	RowsRead    int64     `json:"rows_read"`
	LastUsed    time.Time `json:"last_used"`
	Selectivity float64   `json:"selectivity"`
	Efficiency  float64   `json:"efficiency"` // rows_read / rows_returned
}

// IndexSuggestion represents an index creation suggestion
type IndexSuggestion struct {
	ID            string                 `json:"id"`
	Table         string                 `json:"table"`
	Columns       []string               `json:"columns"`
	Type          string                 `json:"type"`
	Reason        string                 `json:"reason"`
	EstimatedGain float64                `json:"estimated_gain"`
	Priority      int                    `json:"priority"`
	SQL           string                 `json:"sql"`
	Impact        string                 `json:"impact"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

func NewIndexManager() *IndexManager {
	return &IndexManager{
		indexes:     make(map[string]*DatabaseIndex),
		suggestions: make(map[string][]IndexSuggestion),
	}
}

// AnalyzeTable analyzes a table and suggests indexes
func (i *IndexManager) AnalyzeTable(ctx context.Context, tableName string, queries []string) ([]IndexSuggestion, error) {
	i.mutex.Lock()
	defer i.mutex.Unlock()

	suggestions := make([]IndexSuggestion, 0)

	// Analyze queries to find potential indexes
	columnUsage := i.analyzeQueryPatterns(queries)

	// Generate suggestions based on column usage
	for column, usage := range columnUsage {
		if usage.InWhereClauses > 10 {
			suggestion := IndexSuggestion{
				ID:            generateID(),
				Table:         tableName,
				Columns:       []string{column},
				Type:          "BTREE",
				Reason:        "Column frequently used in WHERE clauses",
				EstimatedGain: float64(usage.InWhereClauses) * 5.0, // 5% improvement per usage
				Priority:      1,
				SQL:           fmt.Sprintf("CREATE INDEX idx_%s_%s ON %s (%s)", tableName, column, tableName, column),
				Impact:        "medium",
			}
			suggestions = append(suggestions, suggestion)
		}

		if usage.InJoinConditions > 5 {
			suggestion := IndexSuggestion{
				ID:            generateID(),
				Table:         tableName,
				Columns:       []string{column},
				Type:          "BTREE",
				Reason:        "Column frequently used in JOIN conditions",
				EstimatedGain: float64(usage.InJoinConditions) * 8.0, // 8% improvement per usage
				Priority:      1,
				SQL:           fmt.Sprintf("CREATE INDEX idx_%s_%s ON %s (%s)", tableName, column, tableName, column),
				Impact:        "high",
			}
			suggestions = append(suggestions, suggestion)
		}

		if usage.InOrderByClauses > 8 {
			suggestion := IndexSuggestion{
				ID:            generateID(),
				Table:         tableName,
				Columns:       []string{column},
				Type:          "BTREE",
				Reason:        "Column frequently used in ORDER BY clauses",
				EstimatedGain: float64(usage.InOrderByClauses) * 6.0, // 6% improvement per usage
				Priority:      2,
				SQL:           fmt.Sprintf("CREATE INDEX idx_%s_%s ON %s (%s)", tableName, column, tableName, column),
				Impact:        "medium",
			}
			suggestions = append(suggestions, suggestion)
		}
	}

	// Check for composite index opportunities
	compositeSuggestions := i.suggestCompositeIndexes(tableName, columnUsage)
	suggestions = append(suggestions, compositeSuggestions...)

	// Sort suggestions by estimated gain
	sort.Slice(suggestions, func(i, j int) bool {
		return suggestions[i].EstimatedGain > suggestions[j].EstimatedGain
	})

	return suggestions, nil
}

// ColumnUsage tracks how columns are used in queries
type ColumnUsage struct {
	InWhereClauses   int `json:"in_where_clauses"`
	InJoinConditions int `json:"in_join_conditions"`
	InOrderByClauses int `json:"in_order_by_clauses"`
	InSelectClauses  int `json:"in_select_clauses"`
	InGroupByClauses int `json:"in_group_by_clauses"`
}

// analyzeQueryPatterns analyzes query patterns to determine column usage
func (i *IndexManager) analyzeQueryPatterns(queries []string) map[string]*ColumnUsage {
	usage := make(map[string]*ColumnUsage)

	for _, query := range queries {
		queryUpper := strings.ToUpper(query)

		// Extract column mentions (simplified)
		columns := i.extractColumnsFromQuery(query)

		for _, column := range columns {
			if _, exists := usage[column]; !exists {
				usage[column] = &ColumnUsage{}
			}

			// Count usage in different clauses
			if strings.Contains(queryUpper, "WHERE "+column) || strings.Contains(queryUpper, "WHERE "+column+"=") {
				usage[column].InWhereClauses++
			}

			if strings.Contains(queryUpper, "JOIN") && strings.Contains(queryUpper, column+"=") {
				usage[column].InJoinConditions++
			}

			if strings.Contains(queryUpper, "ORDER BY "+column) {
				usage[column].InOrderByClauses++
			}

			if strings.Contains(queryUpper, "SELECT "+column) || strings.Contains(queryUpper, ", "+column) {
				usage[column].InSelectClauses++
			}

			if strings.Contains(queryUpper, "GROUP BY "+column) {
				usage[column].InGroupByClauses++
			}
		}
	}

	return usage
}

// extractColumnsFromQuery extracts column names from a query
func (i *IndexManager) extractColumnsFromQuery(query string) []string {
	// Simplified column extraction
	pattern := regexp.MustCompile(`\b(\w+)\.`)
	matches := pattern.FindAllStringSubmatch(query, -1)

	columns := make([]string, 0)
	seen := make(map[string]bool)

	for _, match := range matches {
		if len(match) > 1 {
			column := match[1]
			// Filter out common keywords
			if !i.isKeyword(column) && !seen[column] {
				columns = append(columns, column)
				seen[column] = true
			}
		}
	}

	return columns
}

// isKeyword checks if a word is a SQL keyword
func (i *IndexManager) isKeyword(word string) bool {
	keywords := []string{
		"SELECT", "FROM", "WHERE", "JOIN", "INNER", "LEFT", "RIGHT", "ON",
		"ORDER", "BY", "GROUP", "HAVING", "LIMIT", "OFFSET", "AND", "OR",
		"NOT", "IN", "EXISTS", "BETWEEN", "LIKE", "IS", "NULL", "AS",
		"COUNT", "SUM", "AVG", "MIN", "MAX", "DISTINCT", "ALL", "ANY",
	}

	for _, keyword := range keywords {
		if word == keyword {
			return true
		}
	}
	return false
}

// suggestCompositeIndexes suggests composite indexes
func (i *IndexManager) suggestCompositeIndexes(tableName string, usage map[string]*ColumnUsage) []IndexSuggestion {
	suggestions := make([]IndexSuggestion, 0)

	// Find columns frequently used together in WHERE clauses
	whereColumns := make([]string, 0)
	for column, usage := range usage {
		if usage.InWhereClauses > 5 {
			whereColumns = append(whereColumns, column)
		}
	}

	// Create composite index suggestions
	if len(whereColumns) >= 2 {
		suggestion := IndexSuggestion{
			ID:            generateID(),
			Table:         tableName,
			Columns:       whereColumns[:2], // Take top 2 columns
			Type:          "BTREE",
			Reason:        "Multiple columns frequently used together in WHERE clauses",
			EstimatedGain: 25.0, // Composite indexes often provide good improvement
			Priority:      1,
			SQL:           fmt.Sprintf("CREATE INDEX idx_%s_composite ON %s (%s)", tableName, tableName, strings.Join(whereColumns[:2], ", ")),
			Impact:        "high",
		}
		suggestions = append(suggestions, suggestion)
	}

	return suggestions
}

// CreateIndex creates a new database index
func (i *IndexManager) CreateIndex(ctx context.Context, suggestion *IndexSuggestion) error {
	i.mutex.Lock()
	defer i.mutex.Unlock()

	// Simulate index creation
	index := &DatabaseIndex{
		ID:          generateID(),
		Table:       suggestion.Table,
		Columns:     suggestion.Columns,
		Type:        suggestion.Type,
		Unique:      false,
		Primary:     false,
		Size:        1024, // Simulated size
		Cardinality: 1000, // Simulated cardinality
		Usage: &IndexUsage{
			Scans:       0,
			RowsRead:    0,
			LastUsed:    time.Time{},
			Selectivity: 0.8, // Good selectivity
			Efficiency:  1.0,
		},
		CreatedAt:    time.Now(),
		LastAnalyzed: time.Now(),
	}

	i.indexes[index.ID] = index
	return nil
}

// GetIndexUsage returns usage statistics for indexes
func (i *IndexManager) GetIndexUsage(ctx context.Context) (map[string]*IndexUsage, error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	usage := make(map[string]*IndexUsage)
	for _, index := range i.indexes {
		usage[index.ID] = index.Usage
	}

	return usage, nil
}

// DatabasePerformanceMonitor monitors database performance metrics
type DatabasePerformanceMonitor struct {
	metrics map[string]*DatabaseMetrics
	mutex   sync.RWMutex
}

// DatabaseMetrics represents database performance metrics
type DatabaseMetrics struct {
	Database          string                 `json:"database"`
	QueryCount        int64                  `json:"query_count"`
	AvgResponseTime   time.Duration          `json:"avg_response_time"`
	P95ResponseTime   time.Duration          `json:"p95_response_time"`
	P99ResponseTime   time.Duration          `json:"p99_response_time"`
	ErrorRate         float64                `json:"error_rate"`
	ConnectionsActive int64                  `json:"connections_active"`
	ConnectionsIdle   int64                  `json:"connections_idle"`
	ThroughputPerSec  float64                `json:"throughput_per_sec"`
	SlowQueries       []*SlowQuery           `json:"slow_queries"`
	IndexUsage        map[string]*IndexUsage `json:"index_usage"`
	TableStats        map[string]*TableStats `json:"table_stats"`
	LastUpdated       time.Time              `json:"last_updated"`
}

// SlowQuery represents a slow database query
type SlowQuery struct {
	Query         string        `json:"query"`
	ExecutionTime time.Duration `json:"execution_time"`
	RowsExamined  int64         `json:"rows_examined"`
	RowsReturned  int64         `json:"rows_returned"`
	Timestamp     time.Time     `json:"timestamp"`
	Database      string        `json:"database"`
}

// TableStats represents table statistics
type TableStats struct {
	Table        string    `json:"table"`
	RowCount     int64     `json:"row_count"`
	Size         int64     `json:"size"`
	LastAnalyzed time.Time `json:"last_analyzed"`
	Fragmented   bool      `json:"fragmented"`
}

func NewDatabasePerformanceMonitor() *DatabasePerformanceMonitor {
	return &DatabasePerformanceMonitor{
		metrics: make(map[string]*DatabaseMetrics),
	}
}

// RecordQuery records a database query for performance monitoring
func (m *DatabasePerformanceMonitor) RecordQuery(database, query string, executionTime time.Duration, rowsExamined, rowsReturned int64, error bool) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if _, exists := m.metrics[database]; !exists {
		m.metrics[database] = &DatabaseMetrics{
			Database:    database,
			SlowQueries: make([]*SlowQuery, 0),
			IndexUsage:  make(map[string]*IndexUsage),
			TableStats:  make(map[string]*TableStats),
		}
	}

	metrics := m.metrics[database]
	metrics.QueryCount++
	metrics.LastUpdated = time.Now()

	// Update response time metrics
	if metrics.AvgResponseTime == 0 {
		metrics.AvgResponseTime = executionTime
	} else {
		metrics.AvgResponseTime = (metrics.AvgResponseTime + executionTime) / 2
	}

	// Check if this is a slow query
	if executionTime > time.Second {
		slowQuery := &SlowQuery{
			Query:         query,
			ExecutionTime: executionTime,
			RowsExamined:  rowsExamined,
			RowsReturned:  rowsReturned,
			Timestamp:     time.Now(),
			Database:      database,
		}
		metrics.SlowQueries = append(metrics.SlowQueries, slowQuery)

		// Keep only last 100 slow queries
		if len(metrics.SlowQueries) > 100 {
			metrics.SlowQueries = metrics.SlowQueries[1:]
		}
	}

	// Update error rate
	if error {
		errorCount := int64(float64(metrics.QueryCount) * metrics.ErrorRate)
		errorCount++
		metrics.ErrorRate = float64(errorCount) / float64(metrics.QueryCount)
	}

	// Update throughput
	metrics.ThroughputPerSec = float64(metrics.QueryCount) / time.Since(metrics.LastUpdated).Seconds()
}

// GetMetrics returns performance metrics for a database
func (m *DatabasePerformanceMonitor) GetMetrics(database string) (*DatabaseMetrics, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if metrics, exists := m.metrics[database]; exists {
		// Calculate percentiles (simplified)
		metrics.P95ResponseTime = metrics.AvgResponseTime + time.Duration(float64(metrics.AvgResponseTime)*0.5)
		metrics.P99ResponseTime = metrics.AvgResponseTime + time.Duration(float64(metrics.AvgResponseTime)*0.8)

		return metrics, nil
	}

	return nil, fmt.Errorf("no metrics found for database: %s", database)
}

// QueryCache caches query results to improve performance
type QueryCache struct {
	cache   map[string]*CachedQuery
	maxSize int
	ttl     time.Duration
	stats   *CacheStats
	mutex   sync.RWMutex
}

// CachedQuery represents a cached query result
type CachedQuery struct {
	Query        interface{}            `json:"query"`
	Result       interface{}            `json:"result"`
	Rows         int64                  `json:"rows"`
	Size         int64                  `json:"size"`
	CreatedAt    time.Time              `json:"created_at"`
	LastAccessed time.Time              `json:"last_accessed"`
	AccessCount  int64                  `json:"access_count"`
	TTL          time.Duration          `json:"ttl"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

func NewQueryCache() *QueryCache {
	return &QueryCache{
		cache:   make(map[string]*CachedQuery),
		maxSize: 1000,
		ttl:     time.Minute * 5,
		stats:   &CacheStats{},
	}
}

// Get retrieves a cached query result
func (c *QueryCache) Get(key string) (interface{}, bool) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	cached, exists := c.cache[key]
	if !exists || time.Since(cached.CreatedAt) > cached.TTL {
		return nil, false
	}

	// Update access statistics
	cached.LastAccessed = time.Now()
	cached.AccessCount++

	return cached.Result, true
}

// Set stores a query result in cache
func (c *QueryCache) Set(key string, query interface{}, result interface{}, rows int64) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	// Check cache size limit
	if len(c.cache) >= c.maxSize {
		c.evictLRU()
	}

	// Serialize result to determine size
	resultData, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to serialize result: %w", err)
	}

	cached := &CachedQuery{
		Query:        query,
		Result:       result,
		Rows:         rows,
		Size:         int64(len(resultData)),
		CreatedAt:    time.Now(),
		LastAccessed: time.Now(),
		AccessCount:  1,
		TTL:          c.ttl,
		Metadata:     make(map[string]interface{}),
	}

	c.cache[key] = cached // Store the cached result
	return nil
}

// evictLRU removes the least recently used entry
func (c *QueryCache) evictLRU() {
	var oldestKey string
	var oldestTime time.Time

	for key, cached := range c.cache {
		if oldestKey == "" || cached.LastAccessed.Before(oldestTime) {
			oldestKey = key
			oldestTime = cached.LastAccessed
		}
	}

	if oldestKey != "" {
		delete(c.cache, oldestKey)
	}
}

// Clear clears the cache
func (c *QueryCache) Clear() {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.cache = make(map[string]*CachedQuery)
}

// GetStats returns cache statistics
func (c *QueryCache) GetStats() *CacheStats {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	stats := *c.stats
	stats.ItemCount = int64(len(c.cache))

	var totalSize int64
	for _, cached := range c.cache {
		totalSize += cached.Size
	}
	stats.TotalSize = totalSize

	return &stats
}

// QueryAnalyzer analyzes SQL queries for optimization opportunities
type QueryAnalyzer struct {
	patterns map[string]*QueryPattern
}

// QueryPattern represents a SQL query pattern
type QueryPattern struct {
	Name       string   `json:"name"`
	Pattern    string   `json:"pattern"`
	Type       string   `json:"type"`       // SELECT, INSERT, UPDATE, DELETE
	Complexity int      `json:"complexity"` // 1-10
	Tables     []string `json:"tables"`
	Columns    []string `json:"columns"`
	Operations []string `json:"operations"`
}

func NewQueryAnalyzer() *QueryAnalyzer {
	return &QueryAnalyzer{
		patterns: make(map[string]*QueryPattern),
	}
}

// AnalyzeQuery analyzes a SQL query
func (a *QueryAnalyzer) AnalyzeQuery(query string) *QueryAnalysis {
	analysis := &QueryAnalysis{
		Query:       query,
		Type:        a.detectQueryType(query),
		Complexity:  a.calculateComplexity(query),
		Tables:      a.extractTables(query),
		Columns:     a.extractColumns(query),
		Operations:  a.extractOperations(query),
		RiskFactors: a.identifyRiskFactors(query),
		GeneratedAt: time.Now(),
	}

	return analysis
}

// QueryAnalysis represents the result of query analysis
type QueryAnalysis struct {
	Query       string                 `json:"query"`
	Type        string                 `json:"type"`
	Complexity  int                    `json:"complexity"`
	Tables      []string               `json:"tables"`
	Columns     []string               `json:"columns"`
	Operations  []string               `json:"operations"`
	RiskFactors []string               `json:"risk_factors"`
	Suggestions []string               `json:"suggestions"`
	GeneratedAt time.Time              `json:"generated_at"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// detectQueryType detects the type of SQL query
func (a *QueryAnalyzer) detectQueryType(query string) string {
	queryUpper := strings.ToUpper(strings.TrimSpace(query))

	if strings.HasPrefix(queryUpper, "SELECT") {
		return "SELECT"
	} else if strings.HasPrefix(queryUpper, "INSERT") {
		return "INSERT"
	} else if strings.HasPrefix(queryUpper, "UPDATE") {
		return "UPDATE"
	} else if strings.HasPrefix(queryUpper, "DELETE") {
		return "DELETE"
	} else if strings.HasPrefix(queryUpper, "CREATE") {
		return "CREATE"
	} else if strings.HasPrefix(queryUpper, "ALTER") {
		return "ALTER"
	} else if strings.HasPrefix(queryUpper, "DROP") {
		return "DROP"
	}

	return "UNKNOWN"
}

// calculateComplexity calculates query complexity
func (a *QueryAnalyzer) calculateComplexity(query string) int {
	complexity := 1 // Base complexity

	queryUpper := strings.ToUpper(query)

	// Add complexity for joins
	joinCount := strings.Count(queryUpper, "JOIN")
	complexity += joinCount * 2

	// Add complexity for subqueries
	subqueryCount := strings.Count(queryUpper, "(SELECT")
	complexity += subqueryCount * 3

	// Add complexity for WHERE clauses
	if strings.Contains(queryUpper, "WHERE") {
		complexity += 1
		// Add complexity for multiple conditions
		andCount := strings.Count(queryUpper, " AND ")
		orCount := strings.Count(queryUpper, " OR ")
		complexity += andCount + orCount
	}

	// Add complexity for GROUP BY
	if strings.Contains(queryUpper, "GROUP BY") {
		complexity += 2
	}

	// Add complexity for ORDER BY
	if strings.Contains(queryUpper, "ORDER BY") {
		complexity += 1
	}

	// Add complexity for window functions
	if strings.Contains(queryUpper, "OVER (") {
		complexity += 3
	}

	// Cap complexity at 10
	if complexity > 10 {
		complexity = 10
	}

	return complexity
}

// extractTables extracts table names from query
func (a *QueryAnalyzer) extractTables(query string) []string {
	pattern := regexp.MustCompile(`(?i)(?:FROM|JOIN|UPDATE|INTO)\s+(\w+)(?:\s+AS\s+(\w+))?`)
	matches := pattern.FindAllStringSubmatch(query, -1)

	tables := make([]string, 0)
	seen := make(map[string]bool)

	for _, match := range matches {
		if len(match) > 1 {
			table := match[1]
			if !seen[table] {
				tables = append(tables, table)
				seen[table] = true
			}
		}
	}

	return tables
}

// extractColumns extracts column names from query
func (a *QueryAnalyzer) extractColumns(query string) []string {
	// Simple column extraction
	pattern := regexp.MustCompile(`\b(\w+)\.`)
	matches := pattern.FindAllStringSubmatch(query, -1)

	columns := make([]string, 0)
	seen := make(map[string]bool)

	for _, match := range matches {
		if len(match) > 1 {
			column := match[1]
			if !a.isSQLKeyword(column) && !seen[column] {
				columns = append(columns, column)
				seen[column] = true
			}
		}
	}

	return columns
}

// extractOperations extracts SQL operations from query
func (a *QueryAnalyzer) extractOperations(query string) []string {
	operations := make([]string, 0)

	// Common SQL operations
	operationPatterns := map[string]string{
		"COUNT\\(":     "COUNT",
		"SUM\\(":       "SUM",
		"AVG\\(":       "AVG",
		"MIN\\(":       "MIN",
		"MAX\\(":       "MAX",
		"CONCAT\\(":    "CONCAT",
		"SUBSTRING\\(": "SUBSTRING",
		"UPPER\\(":     "UPPER",
		"LOWER\\(":     "LOWER",
		"CAST\\(":      "CAST",
		"CONVERT\\(":   "CONVERT",
	}

	for pattern, operation := range operationPatterns {
		if matched, _ := regexp.MatchString(pattern, query); matched {
			operations = append(operations, operation)
		}
	}

	return operations
}

// identifyRiskFactors identifies potential performance risks
func (a *QueryAnalyzer) identifyRiskFactors(query string) []string {
	risks := make([]string, 0)
	queryUpper := strings.ToUpper(query)

	// Check for SELECT *
	if strings.Contains(queryUpper, "SELECT *") {
		risks = append(risks, "SELECT * can retrieve unnecessary columns")
	}

	// Check for missing WHERE clause
	if strings.Contains(queryUpper, "SELECT") && !strings.Contains(queryUpper, "WHERE") && !strings.Contains(queryUpper, "LIMIT") {
		risks = append(risks, "Missing WHERE clause may return too many rows")
	}

	// Check for LIKE with leading wildcard
	if strings.Contains(queryUpper, "LIKE '%") {
		risks = append(risks, "LIKE with leading wildcard prevents index usage")
	}

	// Check for function on column in WHERE
	if regexp.MustCompile(`WHERE.*\w+\([^)]+\)\s*[=<>!]`).MatchString(query) {
		risks = append(risks, "Function on column in WHERE clause prevents index usage")
	}

	// Check for implicit conversion
	if regexp.MustCompile(`WHERE.*\w+\s*[=<>!]\s*['\"][^'\"]*['\"]`).MatchString(query) {
		risks = append(risks, "Possible implicit type conversion in WHERE clause")
	}

	// Check for ORDER BY without LIMIT
	if strings.Contains(queryUpper, "ORDER BY") && !strings.Contains(queryUpper, "LIMIT") {
		risks = append(risks, "ORDER BY without LIMIT may sort large result sets")
	}

	return risks
}

// isSQLKeyword checks if a word is a SQL keyword
func (a *QueryAnalyzer) isSQLKeyword(word string) bool {
	keywords := []string{
		"SELECT", "FROM", "WHERE", "JOIN", "INNER", "LEFT", "RIGHT", "ON", "AND", "OR",
		"NOT", "IN", "EXISTS", "BETWEEN", "LIKE", "IS", "NULL", "AS", "ORDER", "BY",
		"GROUP", "HAVING", "LIMIT", "OFFSET", "DISTINCT", "ALL", "ANY", "SOME",
		"COUNT", "SUM", "AVG", "MIN", "MAX", "CASE", "WHEN", "THEN", "ELSE", "END",
		"UNION", "INTERSECT", "EXCEPT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER",
		"DROP", "INDEX", "TABLE", "VIEW", "PROCEDURE", "FUNCTION", "TRIGGER",
	}

	for _, keyword := range keywords {
		if word == keyword {
			return true
		}
	}
	return false
}
