package fraud

import (
	"fmt"
	"math"

	"quantumbeam/internal/interfaces"
)

// GraphRepository defines the interface for querying fraud network graphs.
type GraphRepository interface {
	QueryGraph(req *GraphQueryRequest) (*GraphQueryResponse, error)
	GetGraphStatistics(tenantID string) (*GraphStats, error)
	GetNodeDetail(tenantID, nodeID string) (*GraphNode, error)
	GetCommunityDetail(tenantID, communityID string) (*GraphCommunity, error)
}

// InMemoryGraphRepository wraps FraudRingDetector to serve graph queries.
type InMemoryGraphRepository struct {
	result *interfaces.QuantumCommunityResult
	graph  *TransactionGraph
}

// NewInMemoryGraphRepository creates a repository from detection results.
func NewInMemoryGraphRepository(result *interfaces.QuantumCommunityResult, graph *TransactionGraph) *InMemoryGraphRepository {
	return &InMemoryGraphRepository{result: result, graph: graph}
}

// QueryGraph returns filtered and paginated graph data.
func (r *InMemoryGraphRepository) QueryGraph(req *GraphQueryRequest) (*GraphQueryResponse, error) {
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("invalid query: %w", err)
	}

	pagination := req.Pagination
	if pagination == nil {
		pagination = DefaultPagination()
	}

	nodes := r.buildNodes(req.Filters)
	edges := r.buildEdges(req.Filters)
	communities := r.buildCommunities()
	rings := r.buildFraudRings()

	// Paginate nodes
	paginatedNodes := paginateNodes(nodes, pagination.Offset, pagination.Limit)

	stats := r.computeStats(nodes, edges, communities, rings)

	return &GraphQueryResponse{
		Nodes:       paginatedNodes,
		Edges:       edges,
		Communities: communities,
		FraudRings:  rings,
		Stats:       stats,
		RequestID:   generateRequestID(),
	}, nil
}

// GetGraphStatistics returns aggregate statistics.
func (r *InMemoryGraphRepository) GetGraphStatistics(tenantID string) (*GraphStats, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	nodes := r.buildNodes(nil)
	edges := r.buildEdges(nil)
	return r.computeStats(nodes, edges, r.buildCommunities(), r.buildFraudRings()), nil
}

// GetNodeDetail returns a single node with its connections.
func (r *InMemoryGraphRepository) GetNodeDetail(tenantID, nodeID string) (*GraphNode, error) {
	if tenantID == "" || nodeID == "" {
		return nil, fmt.Errorf("tenant_id and node_id are required")
	}
	if user, ok := r.graph.Users[nodeID]; ok {
		return r.userToGraphNode(nodeID, user), nil
	}
	if merchant, ok := r.graph.Merchants[nodeID]; ok {
		return r.merchantToGraphNode(nodeID, merchant), nil
	}
	return nil, fmt.Errorf("node %s not found", nodeID)
}

// GetCommunityDetail returns details for a single community.
func (r *InMemoryGraphRepository) GetCommunityDetail(tenantID, communityID string) (*GraphCommunity, error) {
	if tenantID == "" || communityID == "" {
		return nil, fmt.Errorf("tenant_id and community_id are required")
	}
	for _, c := range r.result.Communities {
		if c.ID == communityID {
			return &GraphCommunity{
				ID: c.ID, Members: c.Members, FraudScore: c.FraudScore,
				RiskLevel: c.RiskLevel, Centrality: c.Centrality,
				DetectionMethod: "classical_community_detection",
			}, nil
		}
	}
	return nil, fmt.Errorf("community %s not found", communityID)
}

// buildNodes converts internal graph data to API nodes with optional filters.
func (r *InMemoryGraphRepository) buildNodes(filters *GraphFilters) []GraphNode {
	nodes := make([]GraphNode, 0, len(r.graph.Users)+len(r.graph.Merchants))
	for id, u := range r.graph.Users {
		node := r.userToGraphNode(id, u)
		if matchesNodeFilters(node, filters) {
			nodes = append(nodes, *node)
		}
	}
	for id, m := range r.graph.Merchants {
		node := r.merchantToGraphNode(id, m)
		if matchesNodeFilters(node, filters) {
			nodes = append(nodes, *node)
		}
	}
	return nodes
}

func (r *InMemoryGraphRepository) userToGraphNode(id string, u *UserNode) *GraphNode {
	return &GraphNode{
		ID: id, Type: "user", Label: fmt.Sprintf("User %s", id),
		RiskScore: u.RiskScore, TransactionCount: u.TransactionCount,
		TotalAmount: u.TotalAmount, Connections: u.Connections,
	}
}

func (r *InMemoryGraphRepository) merchantToGraphNode(id string, m *MerchantNode) *GraphNode {
	return &GraphNode{
		ID: id, Type: "merchant", Label: fmt.Sprintf("Merchant %s", id),
		RiskScore: m.RiskScore, TransactionCount: m.TransactionCount,
		TotalAmount: m.TotalAmount, Connections: m.Connections,
	}
}

func (r *InMemoryGraphRepository) buildEdges(filters *GraphFilters) []GraphEdge {
	edges := make([]GraphEdge, 0, len(r.graph.Edges))
	for _, e := range r.graph.Edges {
		if filters != nil && len(filters.EdgeTypes) > 0 && !containsStr(filters.EdgeTypes, e.EdgeType) {
			continue
		}
		edges = append(edges, GraphEdge{
			Source: e.Source, Target: e.Target, Weight: e.Weight,
			EdgeType: e.EdgeType, RiskIndicators: e.RiskIndicators,
		})
	}
	return edges
}

func (r *InMemoryGraphRepository) buildCommunities() []GraphCommunity {
	out := make([]GraphCommunity, 0, len(r.result.Communities))
	for _, c := range r.result.Communities {
		out = append(out, GraphCommunity{
			ID: c.ID, Members: c.Members, FraudScore: c.FraudScore,
			RiskLevel: c.RiskLevel, Centrality: c.Centrality,
			DetectionMethod: "classical_community_detection",
		})
	}
	return out
}

func (r *InMemoryGraphRepository) buildFraudRings() []GraphFraudRing {
	out := make([]GraphFraudRing, 0, len(r.result.FraudRings))
	for _, fr := range r.result.FraudRings {
		out = append(out, GraphFraudRing{
			RingID: fr.RingID, Members: fr.Members,
			ConfidenceScore: fr.ConfidenceScore, TransactionCount: fr.TransactionCount,
			TotalAmount: fr.TotalAmount, DetectionMethod: fr.DetectionMethod,
			RiskIndicators: fr.RiskIndicators,
		})
	}
	return out
}

func (r *InMemoryGraphRepository) computeStats(nodes []GraphNode, edges []GraphEdge, communities []GraphCommunity, rings []GraphFraudRing) *GraphStats {
	users, merchants := 0, 0
	totalRisk := 0.0
	for _, n := range nodes {
		if n.Type == "user" {
			users++
		} else {
			merchants++
		}
		totalRisk += n.RiskScore
	}
	avg := 0.0
	if len(nodes) > 0 {
		avg = math.Round(totalRisk/float64(len(nodes))*100) / 100
	}
	return &GraphStats{
		NodeCount: len(nodes), EdgeCount: len(edges),
		CommunityCount: len(communities), FraudRingCount: len(rings),
		UserCount: users, MerchantCount: merchants, AvgRiskScore: avg,
	}
}

