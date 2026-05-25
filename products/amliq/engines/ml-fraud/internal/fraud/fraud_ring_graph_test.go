package fraud

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"quantumbeam/internal/interfaces"
)

func TestConvertToNetworkGraph(t *testing.T) {
	detector := NewFraudRingDetector(nil, nil)
	graph := &TransactionGraph{
		Users: map[string]*UserNode{
			"u1": {UserID: "u1", TransactionCount: 2, TotalAmount: 9000, RiskScore: 0.3},
		},
		Merchants: map[string]*MerchantNode{
			"m1": {MerchantID: "m1", TransactionCount: 3, TotalAmount: 12000, RiskScore: 0.2},
		},
		Edges: []*TransactionEdge{
			{Source: "u1", Target: "m1", Weight: 0.8, EdgeType: "transaction", Timestamp: time.Now()},
		},
	}

	networkGraph := detector.convertToNetworkGraph(graph)
	assert.NotNil(t, networkGraph)
	assert.Len(t, networkGraph.Nodes, 2)
	assert.Len(t, networkGraph.Edges, 1)
}

func TestFindConnectedComponents_TwoClusters(t *testing.T) {
	detector := NewFraudRingDetector(nil, nil)
	graph := &interfaces.NetworkGraph{
		Nodes: []interfaces.NetworkNode{
			{ID: "a"}, {ID: "b"}, {ID: "c"},
			{ID: "x"}, {ID: "y"}, {ID: "z"},
		},
		Edges: []interfaces.NetworkEdge{
			{Source: "a", Target: "b"}, {Source: "b", Target: "c"},
			{Source: "x", Target: "y"}, {Source: "y", Target: "z"},
		},
	}

	communities := detector.findConnectedComponents(graph)
	assert.Len(t, communities, 2)
	assert.Len(t, communities[0].Members, 3)
	assert.Len(t, communities[1].Members, 3)
}

func TestFindConnectedComponents_SingleLargeCluster(t *testing.T) {
	detector := NewFraudRingDetector(nil, nil)
	graph := &interfaces.NetworkGraph{
		Nodes: []interfaces.NetworkNode{
			{ID: "a"}, {ID: "b"}, {ID: "c"}, {ID: "d"},
		},
		Edges: []interfaces.NetworkEdge{
			{Source: "a", Target: "b"}, {Source: "b", Target: "c"},
			{Source: "c", Target: "d"},
		},
	}

	communities := detector.findConnectedComponents(graph)
	assert.Len(t, communities, 1)
	assert.Len(t, communities[0].Members, 4)
}

func TestFindConnectedComponents_NoEdges(t *testing.T) {
	detector := NewFraudRingDetector(nil, nil)
	graph := &interfaces.NetworkGraph{
		Nodes: []interfaces.NetworkNode{{ID: "a"}, {ID: "b"}},
		Edges: []interfaces.NetworkEdge{},
	}

	// Individual nodes don't meet MinRingSize of 3
	communities := detector.findConnectedComponents(graph)
	assert.Empty(t, communities)
}

func TestCalculateRiskLevel_Detector(t *testing.T) {
	detector := NewFraudRingDetector(nil, nil)
	assert.Equal(t, "critical", detector.calculateRiskLevel(0.9))
	assert.Equal(t, "high", detector.calculateRiskLevel(0.7))
	assert.Equal(t, "medium", detector.calculateRiskLevel(0.5))
	assert.Equal(t, "low", detector.calculateRiskLevel(0.2))
}

func TestCalculateConnectivityScore(t *testing.T) {
	detector := NewFraudRingDetector(nil, nil)
	graph := &interfaces.NetworkGraph{
		Edges: []interfaces.NetworkEdge{
			{Source: "a", Target: "b"},
			{Source: "a", Target: "c"},
			{Source: "b", Target: "c"},
		},
	}

	// Fully connected triangle: 3 edges / 3 possible = 1.0
	score := detector.calculateConnectivityScore([]string{"a", "b", "c"}, graph)
	assert.Equal(t, 1.0, score)

	// Single member: 0 possible edges
	scoreSingle := detector.calculateConnectivityScore([]string{"a"}, graph)
	assert.Equal(t, 0.0, scoreSingle)
}

func TestCalculateCommunityCentrality(t *testing.T) {
	detector := NewFraudRingDetector(nil, nil)
	graph := &interfaces.NetworkGraph{
		Edges: []interfaces.NetworkEdge{
			{Source: "a", Target: "b"},
			{Source: "b", Target: "c"},
			{Source: "c", Target: "d"}, // d is external
		},
	}

	centrality := detector.calculateCommunityCentrality([]string{"a", "b", "c"}, graph)
	// 2 internal edges (a-b, b-c), 1 external (c-d). 2/3 = 0.667
	assert.InDelta(t, 0.667, centrality, 0.01)
}

func TestCalculateMerchantRiskScore(t *testing.T) {
	detector := NewFraudRingDetector(nil, nil)

	tests := []struct {
		name   string
		method string
		min    float64
	}{
		{"digital_wallet", "digital_wallet", 0.15},
		{"credit_card", "credit_card", 0.05},
		{"bank_transfer", "bank_transfer", 0.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tx := newTestTransaction("mrisk", 1000.0, tt.method)
			score := detector.calculateMerchantRiskScore(tx)
			assert.GreaterOrEqual(t, score, tt.min)
			assert.LessOrEqual(t, score, 1.0)
		})
	}
}
