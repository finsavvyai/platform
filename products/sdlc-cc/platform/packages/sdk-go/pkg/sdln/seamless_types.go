package sdln

import (
	"time"
)

// SeamlessResponse represents the response from a seamless Ask operation
type SeamlessResponse struct {
	QueryID           string                 `json:"query_id"`
	Answer            string                 `json:"answer"`
	Confidence        float64                `json:"confidence"`
	Sources           []SeamlessSource       `json:"sources"`
	Citations         []SeamlessCitation     `json:"citations"`
	ContextSummary    string                 `json:"context_summary"`
	FollowupQuestions []string               `json:"followup_questions,omitempty"`
	Metadata          map[string]interface{} `json:"metadata"`
	ProcessingTime    time.Duration          `json:"processing_time"`
	TokensUsed        SeamlessTokenUsage     `json:"tokens_used"`
	SecurityAnalysis  SecurityAnalysis       `json:"security_analysis"`
	CreatedAt         Timestamp              `json:"created_at"`
}

// SeamlessSource represents a source document in the seamless response
type SeamlessSource struct {
	ID        string                 `json:"id"`
	Title     string                 `json:"title"`
	URL       string                 `json:"url,omitempty"`
	Type      string                 `json:"type"` // pdf, doc, html, api, etc.
	Relevance float64                `json:"relevance"`
	Authority float64                `json:"authority"`
	Preview   string                 `json:"preview"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// SeamlessCitation represents a citation reference
type SeamlessCitation struct {
	ID         string  `json:"id"`
	SourceID   string  `json:"source_id"`
	Text       string  `json:"text"`
	PageNumber *int    `json:"page_number,omitempty"`
	Position   int     `json:"position"`
	Relevance  float64 `json:"relevance"`
}

// SeamlessTokenUsage represents token usage in seamless operations
type SeamlessTokenUsage struct {
	Prompt     int     `json:"prompt"`
	Context    int     `json:"context"`
	Completion int     `json:"completion"`
	Total      int     `json:"total"`
	USD        float64 `json:"usd_cost"`
}

// SecurityAnalysis represents security analysis of the response
type SecurityAnalysis struct {
	PIIDetected   bool     `json:"pii_detected"`
	PIIRedacted   bool     `json:"pii_redacted"`
	PolicyChecks  []string `json:"policy_checks"`
	RiskLevel     string   `json:"risk_level"` // low, medium, high, critical
	ComplianceOK  bool     `json:"compliance_ok"`
	DataResidency string   `json:"data_residency"`
}

// Insights represents AI-generated insights from data analysis
type Insights struct {
	ID              string                 `json:"id"`
	Topic           string                 `json:"topic"`
	Summary         string                 `json:"summary"`
	KeyFindings     []KeyFinding           `json:"key_findings"`
	ActionItems     []SeamlessActionItem           `json:"action_items"`
	SeamlessRiskAssessment  SeamlessRiskAssessment         `json:"risk_assessment"`
	Recommendations []SeamlessRecommendation       `json:"recommendations"`
	DataAnalyzed    int                    `json:"data_analyzed"`
	Confidence      float64                `json:"confidence"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
	ProcessingTime  time.Duration          `json:"processing_time"`
	CreatedAt       Timestamp              `json:"created_at"`
}

// KeyFinding represents a key insight finding
type KeyFinding struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Impact      string   `json:"impact"` // low, medium, high, critical
	Confidence  float64  `json:"confidence"`
	Evidence    []string `json:"evidence,omitempty"`
}

// SeamlessActionItem represents a recommended action
type SeamlessActionItem struct {
	ID          string                 `json:"id"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Priority    string                 `json:"priority"` // low, medium, high, urgent
	Effort      string                 `json:"effort"`   // low, medium, high
	Impact      string                 `json:"impact"`
	Deadline    *Timestamp             `json:"deadline,omitempty"`
	Assignee    string                 `json:"assignee,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// SeamlessRiskAssessment represents a risk analysis
type SeamlessRiskAssessment struct {
	OverallRisk    string                 `json:"overall_risk"` // low, medium, high, critical
	RiskFactors    []SeamlessRiskFactor           `json:"risk_factors"`
	Mitigations    []Mitigation           `json:"mitigations"`
	ComplianceGaps []ComplianceGap        `json:"compliance_gaps"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// SeamlessRiskFactor represents an individual risk factor
type SeamlessRiskFactor struct {
	ID          string  `json:"id"`
	Category    string  `json:"category"` // security, compliance, operational, financial
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Probability float64 `json:"probability"` // 0.0-1.0
	Impact      string  `json:"impact"`
	RiskScore   float64 `json:"risk_score"` // probability * impact weight
}

// Mitigation represents a risk mitigation strategy
type Mitigation struct {
	ID            string                 `json:"id"`
	RiskID        string                 `json:"risk_id"`
	Title         string                 `json:"title"`
	Description   string                 `json:"description"`
	Effectiveness float64                `json:"effectiveness"` // 0.0-1.0
	Cost          string                 `json:"cost"`          // low, medium, high
	Timeline      string                 `json:"timeline"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// ComplianceGap represents a compliance gap
type ComplianceGap struct {
	ID          string                 `json:"id"`
	Framework   string                 `json:"framework"` // GDPR, HIPAA, SOX, etc.
	Requirement string                 `json:"requirement"`
	Status      string                 `json:"status"` // compliant, partial, non_compliant
	Description string                 `json:"description"`
	Evidence    []string               `json:"evidence,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// SeamlessRecommendation represents a recommendation
type SeamlessRecommendation struct {
	ID          string                 `json:"id"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Category    string                 `json:"category"`
	Priority    string                 `json:"priority"`
	Benefit     string                 `json:"benefit"`
	Effort      string                 `json:"effort"`
	Timeline    string                 `json:"timeline"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// SearchResults represents comprehensive search results
type SearchResults struct {
	Query          string                 `json:"query"`
	Results        []SeamlessSearchResult         `json:"results"`
	Aggregations   map[string]interface{} `json:"aggregations,omitempty"`
	Facets         []SearchFacet          `json:"facets,omitempty"`
	Suggestions    []string               `json:"suggestions,omitempty"`
	TotalResults   int64                  `json:"total_results"`
	ProcessingTime time.Duration          `json:"processing_time"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt      Timestamp              `json:"created_at"`
}

// SeamlessSearchResult represents a single search result
type SeamlessSearchResult struct {
	ID         string                 `json:"id"`
	Title      string                 `json:"title"`
	Content    string                 `json:"content"`
	URL        string                 `json:"url,omitempty"`
	Type       string                 `json:"type"`
	Score      float64                `json:"score"`
	Relevance  float64                `json:"relevance"`
	Preview    string                 `json:"preview"`
	Highlights []string               `json:"highlights,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// SearchFacet represents a search facet for filtering
type SearchFacet struct {
	Field  string             `json:"field"`
	Values []SearchFacetValue `json:"values"`
}

// SearchFacetValue represents a facet value
type SearchFacetValue struct {
	Value  string `json:"value"`
	Count  int64  `json:"count"`
	Active bool   `json:"active"`
}

// SeamlessOptions represents options for seamless operations
type SeamlessOptions struct {
	// Query options
	MaxContextLength int  `json:"max_context_length,omitempty"`
	MaxSources       int  `json:"max_sources,omitempty"`
	IncludeCitations bool `json:"include_citations,omitempty"`
	Stream           bool `json:"stream,omitempty"`

	// Security options
	EnableDLP     bool   `json:"enable_dlp,omitempty"`
	StrictPolicy  bool   `json:"strict_policy,omitempty"`
	DataResidency string `json:"data_residency,omitempty"`

	// Model options
	Model       string   `json:"model,omitempty"`
	Temperature *float64 `json:"temperature,omitempty"`
	MaxTokens   *int     `json:"max_tokens,omitempty"`

	// Context options
	ContextStrategy string   `json:"context_strategy,omitempty"` // simple, weighted, diversity, adaptive
	Sources         []string `json:"sources,omitempty"`
	DocumentTypes   []string `json:"document_types,omitempty"`

	// User context
	UserID         *string `json:"user_id,omitempty"`
	SessionID      *string `json:"session_id,omitempty"`
	ConversationID *string `json:"conversation_id,omitempty"`

	// Metadata
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// StreamingSeamlessResponse represents a streaming response chunk
type StreamingSeamlessResponse struct {
	Type      string                 `json:"type"` // start, chunk, context, citation, end, error
	Content   string                 `json:"content,omitempty"`
	Chunk     *SeamlessResponse      `json:"chunk,omitempty"`
	Context   *ContextChunk          `json:"context,omitempty"`
	Citation  *SeamlessCitation      `json:"citation,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	QueryID   string                 `json:"query_id,omitempty"`
	Error     *APIError              `json:"error,omitempty"`
	CreatedAt Timestamp              `json:"created_at"`
}

// OrchestrationResult represents the result of internal orchestration
type OrchestrationResult struct {
	QueryID   string                 `json:"query_id"`
	Steps     []OrchestrationStep    `json:"steps"`
	TotalTime time.Duration          `json:"total_time"`
	Success   bool                   `json:"success"`
	Error     *APIError              `json:"error,omitempty"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// OrchestrationStep represents a step in the orchestration pipeline
type OrchestrationStep struct {
	Name      string                 `json:"name"`   // dlp_scan, policy_check, retrieval, generation, etc.
	Status    string                 `json:"status"` // success, failure, skipped
	Duration  time.Duration          `json:"duration"`
	StartTime time.Time              `json:"start_time,omitempty"`
	Input     interface{}            `json:"input,omitempty"`
	Output    interface{}            `json:"output,omitempty"`
	Error     string                 `json:"error,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// DefaultSeamlessOptions returns default options for seamless operations
func DefaultSeamlessOptions() *SeamlessOptions {
	return &SeamlessOptions{
		MaxContextLength: 8000,
		MaxSources:       5,
		IncludeCitations: true,
		Stream:           false,
		EnableDLP:        true,
		StrictPolicy:     false,
		ContextStrategy:  "adaptive",
		Temperature:      &[]float64{0.1}[0],
		MaxTokens:        &[]int{2000}[0],
	}
}
