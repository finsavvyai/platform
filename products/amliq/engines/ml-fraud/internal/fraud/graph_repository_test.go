package fraud

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"quantumbeam/internal/interfaces"
)

func newTestGraphRepo() *InMemoryGraphRepository {
	graph := &TransactionGraph{
		Users: map[string]*UserNode{
			"user_1": {UserID: "user_1", TransactionCount: 5, TotalAmount: 1000, RiskScore: 0.8, Connections: []string{"merchant_1"}},
			"user_2": {UserID: "user_2", TransactionCount: 3, TotalAmount: 500, RiskScore: 0.3, Connections: []string{"merchant_1"}},
		},
		Merchants: map[string]*MerchantNode{
			"merchant_1": {MerchantID: "merchant_1", TransactionCount: 8, TotalAmount: 1500, RiskScore: 0.5, Connections: []string{"user_1", "user_2"}},
		},
		Edges: []*TransactionEdge{
			{Source: "user_1", Target: "merchant_1", Weight: 0.9, EdgeType: "transaction", RiskIndicators: []string{"high_amount"}},
			{Source: "user_2", Target: "merchant_1", Weight: 0.4, EdgeType: "transaction", RiskIndicators: []string{}},
			{Source: "user_1", Target: "user_2", Weight: 0.7, EdgeType: "shared_device", RiskIndicators: []string{"shared_device"}},
		},
	}
	result := &interfaces.QuantumCommunityResult{
		Communities: []interfaces.Community{
			{ID: "community_0", Members: []string{"user_1", "user_2", "merchant_1"}, FraudScore: 0.75, RiskLevel: "high", Centrality: 0.6},
		},
		FraudRings: []interfaces.FraudRing{
			{RingID: "ring_1", Members: []string{"user_1", "user_2"}, ConfidenceScore: 0.85, TransactionCount: 8, TotalAmount: 1500, DetectionMethod: "classical", RiskIndicators: []string{"high_connectivity"}},
		},
	}
	return NewInMemoryGraphRepository(result, graph)
}

func TestQueryGraph_ReturnsAllData(t *testing.T) {
	repo := newTestGraphRepo()
	req := &GraphQueryRequest{TenantID: "t1"}
	resp, err := repo.QueryGraph(req)
	require.NoError(t, err)
	assert.Equal(t, 3, len(resp.Nodes))
	assert.Equal(t, 3, len(resp.Edges))
	assert.Equal(t, 1, len(resp.Communities))
	assert.Equal(t, 1, len(resp.FraudRings))
	assert.Equal(t, 3, resp.Stats.NodeCount)
}

func TestQueryGraph_FiltersNodesByType(t *testing.T) {
	repo := newTestGraphRepo()
	req := &GraphQueryRequest{
		TenantID: "t1",
		Filters:  &GraphFilters{NodeTypes: []string{"user"}},
	}
	resp, err := repo.QueryGraph(req)
	require.NoError(t, err)
	assert.Equal(t, 2, len(resp.Nodes))
	for _, n := range resp.Nodes {
		assert.Equal(t, "user", n.Type)
	}
}

func TestQueryGraph_FiltersNodesByMinRiskScore(t *testing.T) {
	repo := newTestGraphRepo()
	req := &GraphQueryRequest{
		TenantID: "t1",
		Filters:  &GraphFilters{MinRiskScore: 0.5},
	}
	resp, err := repo.QueryGraph(req)
	require.NoError(t, err)
	for _, n := range resp.Nodes {
		assert.GreaterOrEqual(t, n.RiskScore, 0.5)
	}
}

func TestQueryGraph_PaginationOffset(t *testing.T) {
	repo := newTestGraphRepo()
	req := &GraphQueryRequest{
		TenantID:   "t1",
		Pagination: &GraphPagination{Offset: 2, Limit: 10},
	}
	resp, err := repo.QueryGraph(req)
	require.NoError(t, err)
	assert.Equal(t, 1, len(resp.Nodes))
}

func TestQueryGraph_PaginationLimit(t *testing.T) {
	repo := newTestGraphRepo()
	req := &GraphQueryRequest{
		TenantID:   "t1",
		Pagination: &GraphPagination{Offset: 0, Limit: 1},
	}
	resp, err := repo.QueryGraph(req)
	require.NoError(t, err)
	assert.Equal(t, 1, len(resp.Nodes))
}

func TestQueryGraph_PaginationBeyondEnd(t *testing.T) {
	repo := newTestGraphRepo()
	req := &GraphQueryRequest{
		TenantID:   "t1",
		Pagination: &GraphPagination{Offset: 100, Limit: 10},
	}
	resp, err := repo.QueryGraph(req)
	require.NoError(t, err)
	assert.Equal(t, 0, len(resp.Nodes))
}

func TestQueryGraph_InvalidRequest(t *testing.T) {
	repo := newTestGraphRepo()
	req := &GraphQueryRequest{}
	_, err := repo.QueryGraph(req)
	assert.Error(t, err)
}

func TestGetGraphStatistics_Success(t *testing.T) {
	repo := newTestGraphRepo()
	stats, err := repo.GetGraphStatistics("t1")
	require.NoError(t, err)
	assert.Equal(t, 3, stats.NodeCount)
	assert.Equal(t, 3, stats.EdgeCount)
	assert.Equal(t, 2, stats.UserCount)
	assert.Equal(t, 1, stats.MerchantCount)
	assert.Equal(t, 1, stats.CommunityCount)
	assert.Equal(t, 1, stats.FraudRingCount)
}

func TestGetGraphStatistics_RequiresTenantID(t *testing.T) {
	repo := newTestGraphRepo()
	_, err := repo.GetGraphStatistics("")
	assert.Error(t, err)
}

func TestGetNodeDetail_User(t *testing.T) {
	repo := newTestGraphRepo()
	node, err := repo.GetNodeDetail("t1", "user_1")
	require.NoError(t, err)
	assert.Equal(t, "user", node.Type)
	assert.Equal(t, 0.8, node.RiskScore)
}

func TestGetNodeDetail_Merchant(t *testing.T) {
	repo := newTestGraphRepo()
	node, err := repo.GetNodeDetail("t1", "merchant_1")
	require.NoError(t, err)
	assert.Equal(t, "merchant", node.Type)
}

func TestRepoGetNodeDetail_NotFound(t *testing.T) {
	repo := newTestGraphRepo()
	_, err := repo.GetNodeDetail("t1", "nonexistent")
	assert.Error(t, err)
}

func TestRepoGetCommunityDetail_Success(t *testing.T) {
	repo := newTestGraphRepo()
	c, err := repo.GetCommunityDetail("t1", "community_0")
	require.NoError(t, err)
	assert.Equal(t, "community_0", c.ID)
	assert.Equal(t, 3, len(c.Members))
}

func TestRepoGetCommunityDetail_NotFound(t *testing.T) {
	repo := newTestGraphRepo()
	_, err := repo.GetCommunityDetail("t1", "nonexistent")
	assert.Error(t, err)
}

func TestEmptyGraph(t *testing.T) {
	repo := NewInMemoryGraphRepository(
		&interfaces.QuantumCommunityResult{},
		&TransactionGraph{
			Users: map[string]*UserNode{}, Merchants: map[string]*MerchantNode{},
			Edges: []*TransactionEdge{},
		},
	)
	req := &GraphQueryRequest{TenantID: "t1"}
	resp, err := repo.QueryGraph(req)
	require.NoError(t, err)
	assert.Empty(t, resp.Nodes)
	assert.Empty(t, resp.Edges)
	assert.Equal(t, 0, resp.Stats.NodeCount)
}

func TestQueryGraph_FiltersEdgesByType(t *testing.T) {
	repo := newTestGraphRepo()
	req := &GraphQueryRequest{
		TenantID: "t1",
		Filters:  &GraphFilters{EdgeTypes: []string{"shared_device"}},
	}
	resp, err := repo.QueryGraph(req)
	require.NoError(t, err)
	assert.Equal(t, 1, len(resp.Edges))
	assert.Equal(t, "shared_device", resp.Edges[0].EdgeType)
}
