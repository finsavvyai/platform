package fraud

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGraphQueryRequest_Validate_RequiresTenantID(t *testing.T) {
	req := &GraphQueryRequest{}
	err := req.Validate()
	assert.EqualError(t, err, "tenant_id is required")
}

func TestGraphQueryRequest_Validate_ValidMinimal(t *testing.T) {
	req := &GraphQueryRequest{TenantID: "tenant-1"}
	assert.NoError(t, req.Validate())
}

func TestGraphQueryRequest_Validate_TimeWindowEndBeforeStart(t *testing.T) {
	now := time.Now()
	req := &GraphQueryRequest{
		TenantID:   "tenant-1",
		TimeWindow: &GraphTimeWindow{Start: now, End: now.Add(-time.Hour)},
	}
	assert.EqualError(t, req.Validate(), "time_window end must be after start")
}

func TestGraphQueryRequest_Validate_InvalidRiskScoreRange(t *testing.T) {
	req := &GraphQueryRequest{
		TenantID: "tenant-1",
		Filters:  &GraphFilters{MinRiskScore: -0.1},
	}
	assert.Error(t, req.Validate())

	req.Filters.MinRiskScore = 1.5
	assert.Error(t, req.Validate())
}

func TestGraphQueryRequest_Validate_InvalidPagination(t *testing.T) {
	req := &GraphQueryRequest{
		TenantID:   "tenant-1",
		Pagination: &GraphPagination{Offset: -1, Limit: 10},
	}
	assert.Error(t, req.Validate())

	req.Pagination.Offset = 0
	req.Pagination.Limit = 0
	assert.Error(t, req.Validate())

	req.Pagination.Limit = 501
	assert.Error(t, req.Validate())
}

func TestGraphQueryRequest_Validate_ValidFull(t *testing.T) {
	now := time.Now()
	req := &GraphQueryRequest{
		TenantID:   "tenant-1",
		TimeWindow: &GraphTimeWindow{Start: now.Add(-24 * time.Hour), End: now},
		Filters:    &GraphFilters{MinRiskScore: 0.3, MaxRiskScore: 0.9, NodeTypes: []string{"user"}},
		Pagination: &GraphPagination{Offset: 0, Limit: 50},
	}
	assert.NoError(t, req.Validate())
}

func TestGraphNode_JSONSerialization(t *testing.T) {
	node := GraphNode{
		ID: "user_001", Type: "user", Label: "John Doe",
		RiskScore: 0.75, TransactionCount: 42, TotalAmount: 15000.50,
		Connections: []string{"merchant_001", "merchant_002"},
		Position:    &NodePosition{X: 100.5, Y: 200.3},
	}

	data, err := json.Marshal(node)
	require.NoError(t, err)

	var decoded GraphNode
	require.NoError(t, json.Unmarshal(data, &decoded))

	assert.Equal(t, node.ID, decoded.ID)
	assert.Equal(t, node.Type, decoded.Type)
	assert.Equal(t, node.RiskScore, decoded.RiskScore)
	assert.Equal(t, node.TransactionCount, decoded.TransactionCount)
	assert.InDelta(t, node.TotalAmount, decoded.TotalAmount, 0.01)
	assert.Equal(t, node.Connections, decoded.Connections)
	assert.InDelta(t, node.Position.X, decoded.Position.X, 0.01)
}

func TestGraphEdge_JSONSerialization(t *testing.T) {
	edge := GraphEdge{
		Source: "user_001", Target: "merchant_001",
		Weight: 0.85, EdgeType: "transaction",
		RiskIndicators: []string{"high_amount", "unusual_time"},
	}

	data, err := json.Marshal(edge)
	require.NoError(t, err)

	var decoded GraphEdge
	require.NoError(t, json.Unmarshal(data, &decoded))

	assert.Equal(t, edge.Source, decoded.Source)
	assert.Equal(t, edge.Target, decoded.Target)
	assert.Equal(t, edge.Weight, decoded.Weight)
	assert.Equal(t, edge.RiskIndicators, decoded.RiskIndicators)
}

func TestGraphQueryResponse_JSONSerialization(t *testing.T) {
	resp := GraphQueryResponse{
		Nodes: []GraphNode{{ID: "n1", Type: "user", Label: "Test", Connections: []string{}}},
		Edges: []GraphEdge{{Source: "n1", Target: "n2", Weight: 1.0, EdgeType: "tx"}},
		Stats: &GraphStats{NodeCount: 1, EdgeCount: 1},
	}

	data, err := json.Marshal(resp)
	require.NoError(t, err)

	var decoded GraphQueryResponse
	require.NoError(t, json.Unmarshal(data, &decoded))

	assert.Len(t, decoded.Nodes, 1)
	assert.Len(t, decoded.Edges, 1)
	assert.Equal(t, 1, decoded.Stats.NodeCount)
}

func TestDefaultPagination(t *testing.T) {
	p := DefaultPagination()
	assert.Equal(t, 0, p.Offset)
	assert.Equal(t, 100, p.Limit)
}
