package fraud

import (
	"fmt"
	"time"
)

// GraphQueryRequest represents a request to query the fraud network graph.
type GraphQueryRequest struct {
	TenantID   string            `json:"tenant_id" validate:"required"`
	TimeWindow *GraphTimeWindow  `json:"time_window,omitempty"`
	Filters    *GraphFilters     `json:"filters,omitempty"`
	Pagination *GraphPagination  `json:"pagination,omitempty"`
}

// GraphTimeWindow defines the time range for graph queries.
type GraphTimeWindow struct {
	Start time.Time `json:"start" validate:"required"`
	End   time.Time `json:"end" validate:"required"`
}

// GraphFilters defines optional filters for graph queries.
type GraphFilters struct {
	NodeTypes    []string `json:"node_types,omitempty"`
	MinRiskScore float64  `json:"min_risk_score,omitempty" validate:"omitempty,min=0,max=1"`
	MaxRiskScore float64  `json:"max_risk_score,omitempty" validate:"omitempty,min=0,max=1"`
	EdgeTypes    []string `json:"edge_types,omitempty"`
}

// GraphPagination defines pagination parameters.
type GraphPagination struct {
	Offset int `json:"offset" validate:"min=0"`
	Limit  int `json:"limit" validate:"min=1,max=500"`
}

// GraphQueryResponse represents the response from a graph query.
type GraphQueryResponse struct {
	Nodes       []GraphNode       `json:"nodes"`
	Edges       []GraphEdge       `json:"edges"`
	Communities []GraphCommunity  `json:"communities"`
	FraudRings  []GraphFraudRing  `json:"fraud_rings"`
	Stats       *GraphStats       `json:"stats"`
	RequestID   string            `json:"request_id"`
	Timestamp   time.Time         `json:"timestamp"`
}

// GraphNode represents a node in the fraud network graph.
type GraphNode struct {
	ID               string                 `json:"id"`
	Type             string                 `json:"type"`
	Label            string                 `json:"label"`
	RiskScore        float64                `json:"risk_score"`
	TransactionCount int                    `json:"transaction_count"`
	TotalAmount      float64                `json:"total_amount"`
	Connections      []string               `json:"connections"`
	Attributes       map[string]interface{} `json:"attributes,omitempty"`
	Position         *NodePosition          `json:"position,omitempty"`
}

// NodePosition stores x/y layout coordinates for visualisation.
type NodePosition struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// GraphEdge represents a connection between two nodes.
type GraphEdge struct {
	Source         string   `json:"source"`
	Target         string   `json:"target"`
	Weight         float64  `json:"weight"`
	EdgeType       string   `json:"edge_type"`
	RiskIndicators []string `json:"risk_indicators"`
}

// GraphCommunity represents a detected community in the graph.
type GraphCommunity struct {
	ID              string   `json:"id"`
	Members         []string `json:"members"`
	FraudScore      float64  `json:"fraud_score"`
	RiskLevel       string   `json:"risk_level"`
	Centrality      float64  `json:"centrality"`
	DetectionMethod string   `json:"detection_method"`
}

// GraphFraudRing represents a detected fraud ring.
type GraphFraudRing struct {
	RingID           string   `json:"ring_id"`
	Members          []string `json:"members"`
	ConfidenceScore  float64  `json:"confidence_score"`
	TransactionCount int      `json:"transaction_count"`
	TotalAmount      float64  `json:"total_amount"`
	DetectionMethod  string   `json:"detection_method"`
	RiskIndicators   []string `json:"risk_indicators"`
}

// GraphStats holds aggregate statistics about the queried graph.
type GraphStats struct {
	NodeCount      int     `json:"node_count"`
	EdgeCount      int     `json:"edge_count"`
	CommunityCount int     `json:"community_count"`
	FraudRingCount int     `json:"fraud_ring_count"`
	UserCount      int     `json:"user_count"`
	MerchantCount  int     `json:"merchant_count"`
	AvgRiskScore   float64 `json:"avg_risk_score"`
}

// Validate checks that a GraphQueryRequest has valid fields.
func (r *GraphQueryRequest) Validate() error {
	if r.TenantID == "" {
		return fmt.Errorf("tenant_id is required")
	}
	if r.TimeWindow != nil && r.TimeWindow.End.Before(r.TimeWindow.Start) {
		return fmt.Errorf("time_window end must be after start")
	}
	if r.Filters != nil {
		if r.Filters.MinRiskScore < 0 || r.Filters.MinRiskScore > 1 {
			return fmt.Errorf("min_risk_score must be between 0 and 1")
		}
		if r.Filters.MaxRiskScore < 0 || r.Filters.MaxRiskScore > 1 {
			return fmt.Errorf("max_risk_score must be between 0 and 1")
		}
	}
	if r.Pagination != nil {
		if r.Pagination.Offset < 0 {
			return fmt.Errorf("pagination offset must be >= 0")
		}
		if r.Pagination.Limit < 1 || r.Pagination.Limit > 500 {
			return fmt.Errorf("pagination limit must be between 1 and 500")
		}
	}
	return nil
}

// DefaultPagination returns a default pagination if none supplied.
func DefaultPagination() *GraphPagination {
	return &GraphPagination{Offset: 0, Limit: 100}
}
