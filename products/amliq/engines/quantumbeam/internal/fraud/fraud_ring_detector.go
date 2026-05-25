package fraud

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// FraudRingDetector implements graph-based fraud ring detection using quantum algorithms
type FraudRingDetector struct {
	quantumBackend interfaces.QuantumBackendService
	alertService   AlertService
	config         *FraudRingConfig
}

// FraudRingConfig holds configuration for fraud ring detection
type FraudRingConfig struct {
	MinRingSize         int     `json:"min_ring_size"`
	MaxGraphSize        int     `json:"max_graph_size"`
	FraudThreshold      float64 `json:"fraud_threshold"`
	ConnectivityWeight  float64 `json:"connectivity_weight"`
	TemporalWeight      float64 `json:"temporal_weight"`
	AmountWeight        float64 `json:"amount_weight"`
	AlertThreshold      float64 `json:"alert_threshold"`
	RealTimeEnabled     bool    `json:"real_time_enabled"`
	QuantumOptimization bool    `json:"quantum_optimization"`
}

// AlertService defines the interface for real-time alerting
type AlertService interface {
	SendFraudRingAlert(ctx context.Context, fraudRing *interfaces.FraudRing) error
	SendCommunityAlert(ctx context.Context, community *interfaces.Community) error
}

// TransactionGraph represents a graph of transactions for analysis
type TransactionGraph struct {
	Transactions map[string]*models.TransactionData
	Users        map[string]*UserNode
	Merchants    map[string]*MerchantNode
	Edges        []*TransactionEdge
	TimeWindow   TimeWindow
}

// UserNode represents a user in the transaction graph
type UserNode struct {
	UserID           string                 `json:"user_id"`
	TransactionCount int                    `json:"transaction_count"`
	TotalAmount      float64                `json:"total_amount"`
	RiskScore        float64                `json:"risk_score"`
	Attributes       map[string]interface{} `json:"attributes"`
	Connections      []string               `json:"connections"`
}

// MerchantNode represents a merchant in the transaction graph
type MerchantNode struct {
	MerchantID       string                 `json:"merchant_id"`
	TransactionCount int                    `json:"transaction_count"`
	TotalAmount      float64                `json:"total_amount"`
	RiskScore        float64                `json:"risk_score"`
	Attributes       map[string]interface{} `json:"attributes"`
	Connections      []string               `json:"connections"`
}

// TransactionEdge represents a connection between nodes
type TransactionEdge struct {
	Source         string    `json:"source"`
	Target         string    `json:"target"`
	Weight         float64   `json:"weight"`
	EdgeType       string    `json:"edge_type"`
	Timestamp      time.Time `json:"timestamp"`
	Amount         float64   `json:"amount"`
	Frequency      int       `json:"frequency"`
	RiskIndicators []string  `json:"risk_indicators"`
}

// TimeWindow represents a time window for analysis
type TimeWindow struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// NewFraudRingDetector creates a new fraud ring detector
func NewFraudRingDetector(quantumBackend interfaces.QuantumBackendService, alertService AlertService) *FraudRingDetector {
	config := &FraudRingConfig{
		MinRingSize:         3,
		MaxGraphSize:        1000,
		FraudThreshold:      0.7,
		ConnectivityWeight:  0.4,
		TemporalWeight:      0.3,
		AmountWeight:        0.3,
		AlertThreshold:      0.8,
		RealTimeEnabled:     true,
		QuantumOptimization: true,
	}

	return &FraudRingDetector{
		quantumBackend: quantumBackend,
		alertService:   alertService,
		config:         config,
	}
}

// DetectFraudRings performs comprehensive fraud ring detection on transaction data
func (f *FraudRingDetector) DetectFraudRings(ctx context.Context, transactions []*models.TransactionData, timeWindow TimeWindow) (*interfaces.QuantumCommunityResult, error) {
	// Build transaction graph
	graph, err := f.buildTransactionGraph(transactions, timeWindow)
	if err != nil {
		return nil, fmt.Errorf("failed to build transaction graph: %w", err)
	}

	// Convert to network graph for quantum processing
	networkGraph := f.convertToNetworkGraph(graph)

	// Validate graph size
	if len(networkGraph.Nodes) > f.config.MaxGraphSize {
		return nil, fmt.Errorf("graph too large for processing: %d nodes (max: %d)",
			len(networkGraph.Nodes), f.config.MaxGraphSize)
	}

	// Use quantum QAOA for community detection if enabled and graph is suitable
	var result *interfaces.QuantumCommunityResult
	if f.config.QuantumOptimization && len(networkGraph.Nodes) <= 16 {
		// Create fraud detection service for QAOA processing
		fraudService := NewService(f.quantumBackend, nil)
		result, err = fraudService.DetectFraudRingsQAOA(ctx, networkGraph)
		if err != nil {
			// Fallback to classical community detection
			result, err = f.detectCommunitiesClassical(ctx, networkGraph, graph)
			if err != nil {
				return nil, fmt.Errorf("both quantum and classical community detection failed: %w", err)
			}
		}
	} else {
		// Use classical community detection for large graphs
		result, err = f.detectCommunitiesClassical(ctx, networkGraph, graph)
		if err != nil {
			return nil, fmt.Errorf("classical community detection failed: %w", err)
		}
	}

	// Enhance results with detailed fraud analysis
	f.enhanceFraudRingAnalysis(result, graph)

	// Send real-time alerts if enabled
	if f.config.RealTimeEnabled {
		f.sendRealTimeAlerts(ctx, result)
	}

	return result, nil
}

// buildTransactionGraph builds a graph from transaction data
func (f *FraudRingDetector) buildTransactionGraph(transactions []*models.TransactionData, timeWindow TimeWindow) (*TransactionGraph, error) {
	graph := &TransactionGraph{
		Transactions: make(map[string]*models.TransactionData),
		Users:        make(map[string]*UserNode),
		Merchants:    make(map[string]*MerchantNode),
		Edges:        make([]*TransactionEdge, 0),
		TimeWindow:   timeWindow,
	}

	// Filter transactions by time window
	filteredTransactions := make([]*models.TransactionData, 0)
	for _, tx := range transactions {
		if tx.Timestamp.After(timeWindow.Start) && tx.Timestamp.Before(timeWindow.End) {
			filteredTransactions = append(filteredTransactions, tx)
			graph.Transactions[tx.TransactionID] = tx
		}
	}

	// Build user and merchant nodes
	for _, tx := range filteredTransactions {
		f.addUserNode(graph, tx)
		f.addMerchantNode(graph, tx)
	}

	// Build edges between nodes
	f.buildTransactionEdges(graph, filteredTransactions)
	f.buildUserConnections(graph, filteredTransactions)

	return graph, nil
}

// addUserNode adds or updates a user node in the graph
func (f *FraudRingDetector) addUserNode(graph *TransactionGraph, tx *models.TransactionData) {
	if user, exists := graph.Users[tx.UserID]; exists {
		user.TransactionCount++
		amount, _ := tx.Amount.Float64()
		user.TotalAmount += amount
	} else {
		amount, _ := tx.Amount.Float64()
		graph.Users[tx.UserID] = &UserNode{
			UserID:           tx.UserID,
			TransactionCount: 1,
			TotalAmount:      amount,
			RiskScore:        f.calculateUserRiskScore(tx),
			Attributes:       make(map[string]interface{}),
			Connections:      make([]string, 0),
		}
	}
}

// addMerchantNode adds or updates a merchant node in the graph
func (f *FraudRingDetector) addMerchantNode(graph *TransactionGraph, tx *models.TransactionData) {
	if merchant, exists := graph.Merchants[tx.MerchantID]; exists {
		merchant.TransactionCount++
		amount, _ := tx.Amount.Float64()
		merchant.TotalAmount += amount
	} else {
		amount, _ := tx.Amount.Float64()
		graph.Merchants[tx.MerchantID] = &MerchantNode{
			MerchantID:       tx.MerchantID,
			TransactionCount: 1,
			TotalAmount:      amount,
			RiskScore:        f.calculateMerchantRiskScore(tx),
			Attributes:       make(map[string]interface{}),
			Connections:      make([]string, 0),
		}
	}
}

// buildTransactionEdges builds edges representing direct transactions
func (f *FraudRingDetector) buildTransactionEdges(graph *TransactionGraph, transactions []*models.TransactionData) {
	for _, tx := range transactions {
		amount, _ := tx.Amount.Float64()

		edge := &TransactionEdge{
			Source:         tx.UserID,
			Target:         tx.MerchantID,
			Weight:         f.calculateEdgeWeight(tx),
			EdgeType:       "transaction",
			Timestamp:      tx.Timestamp,
			Amount:         amount,
			Frequency:      1,
			RiskIndicators: f.identifyRiskIndicators(tx),
		}

		graph.Edges = append(graph.Edges, edge)
	}
}

// buildUserConnections builds edges between users based on shared patterns
func (f *FraudRingDetector) buildUserConnections(graph *TransactionGraph, transactions []*models.TransactionData) {
	// Group transactions by various attributes to find connections
	deviceGroups := make(map[string][]string)
	merchantGroups := make(map[string][]string)
	locationGroups := make(map[string][]string)

	for _, tx := range transactions {
		// Device fingerprint connections
		if tx.DeviceFingerprint != nil {
			deviceGroups[*tx.DeviceFingerprint] = append(deviceGroups[*tx.DeviceFingerprint], tx.UserID)
		}

		// Merchant connections
		merchantGroups[tx.MerchantID] = append(merchantGroups[tx.MerchantID], tx.UserID)

		// Location connections
		if tx.Location != nil {
			locationKey := fmt.Sprintf("%.2f,%.2f", tx.Location.Latitude, tx.Location.Longitude)
			locationGroups[locationKey] = append(locationGroups[locationKey], tx.UserID)
		}
	}

	// Create user-to-user edges based on shared attributes
	f.createUserConnections(graph, deviceGroups, "shared_device")
	f.createUserConnections(graph, locationGroups, "shared_location")
}

// createUserConnections creates edges between users in the same group
func (f *FraudRingDetector) createUserConnections(graph *TransactionGraph, groups map[string][]string, edgeType string) {
	for _, userList := range groups {
		if len(userList) < 2 {
			continue
		}

		// Create edges between all pairs in the group
		for i := 0; i < len(userList); i++ {
			for j := i + 1; j < len(userList); j++ {
				if userList[i] != userList[j] {
					weight := f.calculateConnectionWeight(edgeType, len(userList))

					edge := &TransactionEdge{
						Source:         userList[i],
						Target:         userList[j],
						Weight:         weight,
						EdgeType:       edgeType,
						Timestamp:      time.Now(),
						Frequency:      1,
						RiskIndicators: []string{edgeType},
					}

					graph.Edges = append(graph.Edges, edge)
				}
			}
		}
	}
}

// convertToNetworkGraph converts TransactionGraph to NetworkGraph for quantum processing
func (f *FraudRingDetector) convertToNetworkGraph(graph *TransactionGraph) *interfaces.NetworkGraph {
	networkGraph := &interfaces.NetworkGraph{
		Nodes: make([]interfaces.NetworkNode, 0),
		Edges: make([]interfaces.NetworkEdge, 0),
	}

	// Add user nodes
	for userID, user := range graph.Users {
		node := interfaces.NetworkNode{
			ID:   userID,
			Type: "user",
			Attributes: map[string]interface{}{
				"transaction_count": user.TransactionCount,
				"total_amount":      user.TotalAmount,
				"risk_score":        user.RiskScore,
			},
		}
		networkGraph.Nodes = append(networkGraph.Nodes, node)
	}

	// Add merchant nodes (limit to prevent graph explosion)
	merchantCount := 0
	for merchantID, merchant := range graph.Merchants {
		if merchantCount >= 50 { // Limit merchants to keep graph manageable
			break
		}

		node := interfaces.NetworkNode{
			ID:   merchantID,
			Type: "merchant",
			Attributes: map[string]interface{}{
				"transaction_count": merchant.TransactionCount,
				"total_amount":      merchant.TotalAmount,
				"risk_score":        merchant.RiskScore,
			},
		}
		networkGraph.Nodes = append(networkGraph.Nodes, node)
		merchantCount++
	}

	// Add edges
	for _, edge := range graph.Edges {
		networkEdge := interfaces.NetworkEdge{
			Source:    edge.Source,
			Target:    edge.Target,
			Weight:    edge.Weight,
			EdgeType:  edge.EdgeType,
			Timestamp: edge.Timestamp.Unix(),
		}
		networkGraph.Edges = append(networkGraph.Edges, networkEdge)
	}

	return networkGraph
}

// detectCommunitiesClassical performs classical community detection as fallback
func (f *FraudRingDetector) detectCommunitiesClassical(ctx context.Context, networkGraph *interfaces.NetworkGraph, graph *TransactionGraph) (*interfaces.QuantumCommunityResult, error) {
	startTime := time.Now()

	// Simple community detection using connected components and clustering
	communities := f.findConnectedComponents(networkGraph)
	fraudRings := make([]interfaces.FraudRing, 0)

	// Analyze each community for fraud indicators
	for i, community := range communities {
		if len(community.Members) >= f.config.MinRingSize {
			fraudScore := f.calculateCommunityFraudScore(community.Members, networkGraph, graph)

			community.ID = fmt.Sprintf("community_%d", i)
			community.FraudScore = fraudScore
			community.RiskLevel = f.calculateRiskLevel(fraudScore)
			community.Centrality = f.calculateCommunityCentrality(community.Members, networkGraph)

			// Create fraud ring if score exceeds threshold
			if fraudScore >= f.config.FraudThreshold {
				fraudRing := interfaces.FraudRing{
					RingID:           fmt.Sprintf("ring_%d", len(fraudRings)+1),
					Members:          community.Members,
					ConfidenceScore:  fraudScore,
					TransactionCount: f.countCommunityTransactions(community.Members, graph),
					TotalAmount:      f.calculateCommunityAmount(community.Members, graph),
					DetectionMethod:  "classical_community_detection",
					RiskIndicators:   f.identifyCommunityRiskIndicators(community.Members, networkGraph, graph),
				}
				fraudRings = append(fraudRings, fraudRing)
			}
		}
	}

	processingTime := time.Since(startTime).Milliseconds()

	result := &interfaces.QuantumCommunityResult{
		Communities:      communities,
		FraudRings:       fraudRings,
		ConfidenceScore:  0.75, // Classical methods have good but not excellent confidence
		ProcessingTimeMs: processingTime,
		QuantumAdvantage: 0.0, // No quantum advantage for classical processing
	}

	return result, nil
}

// Helper methods for fraud ring detection

// calculateUserRiskScore calculates risk score for a user based on transaction
func (f *FraudRingDetector) calculateUserRiskScore(tx *models.TransactionData) float64 {
	score := 0.0

	// Amount-based risk
	amount, _ := tx.Amount.Float64()
	if amount > 10000 {
		score += 0.3
	} else if amount > 1000 {
		score += 0.1
	}

	// Time-based risk
	hour := tx.Timestamp.Hour()
	if hour >= 23 || hour <= 5 {
		score += 0.2
	}

	// Custom features
	if riskFeature, exists := tx.GetFeatureValue("user_risk"); exists {
		score += riskFeature * 0.5
	}

	return math.Min(score, 1.0)
}

// calculateMerchantRiskScore calculates risk score for a merchant
func (f *FraudRingDetector) calculateMerchantRiskScore(tx *models.TransactionData) float64 {
	score := 0.0

	// Payment method risk
	switch tx.PaymentMethod {
	case "digital_wallet":
		score += 0.2
	case "credit_card":
		score += 0.1
	}

	// Custom features
	if riskFeature, exists := tx.GetFeatureValue("merchant_risk"); exists {
		score += riskFeature * 0.6
	}

	return math.Min(score, 1.0)
}

// calculateEdgeWeight calculates the weight of an edge based on transaction properties
func (f *FraudRingDetector) calculateEdgeWeight(tx *models.TransactionData) float64 {
	weight := 1.0

	// Amount weight
	amount, _ := tx.Amount.Float64()
	amountWeight := math.Log10(amount+1) / 6.0 // Normalize to log scale
	weight += amountWeight * f.config.AmountWeight

	// Time weight (recent transactions have higher weight)
	timeWeight := 1.0 - (time.Since(tx.Timestamp).Hours() / (24.0 * 7.0)) // Week decay
	if timeWeight < 0 {
		timeWeight = 0
	}
	weight += timeWeight * f.config.TemporalWeight

	// Risk features weight
	if riskFeature, exists := tx.GetFeatureValue("edge_risk"); exists {
		weight += riskFeature * 0.3
	}

	return weight
}

// calculateConnectionWeight calculates weight for user connections
func (f *FraudRingDetector) calculateConnectionWeight(edgeType string, groupSize int) float64 {
	baseWeight := 0.5

	switch edgeType {
	case "shared_device":
		baseWeight = 0.8 // High suspicion for shared devices
	case "shared_location":
		baseWeight = 0.3 // Lower suspicion for shared locations
	}

	// Smaller groups are more suspicious
	groupWeight := 1.0 / math.Sqrt(float64(groupSize))

	return baseWeight * groupWeight
}

// identifyRiskIndicators identifies risk indicators for a transaction
func (f *FraudRingDetector) identifyRiskIndicators(tx *models.TransactionData) []string {
	indicators := make([]string, 0)

	amount, _ := tx.Amount.Float64()
	if amount > 10000 {
		indicators = append(indicators, "high_amount")
	}

	hour := tx.Timestamp.Hour()
	if hour >= 23 || hour <= 5 {
		indicators = append(indicators, "unusual_time")
	}

	if tx.PaymentMethod == "digital_wallet" {
		indicators = append(indicators, "high_risk_payment_method")
	}

	if tx.DeviceFingerprint != nil {
		indicators = append(indicators, "device_tracked")
	}

	return indicators
}

// findConnectedComponents finds connected components in the network graph
func (f *FraudRingDetector) findConnectedComponents(networkGraph *interfaces.NetworkGraph) []interfaces.Community {
	visited := make(map[string]bool)
	communities := make([]interfaces.Community, 0)

	// Create adjacency list
	adjacency := make(map[string][]string)
	for _, node := range networkGraph.Nodes {
		adjacency[node.ID] = make([]string, 0)
	}

	for _, edge := range networkGraph.Edges {
		adjacency[edge.Source] = append(adjacency[edge.Source], edge.Target)
		adjacency[edge.Target] = append(adjacency[edge.Target], edge.Source)
	}

	// DFS to find connected components
	for _, node := range networkGraph.Nodes {
		if !visited[node.ID] {
			component := f.dfsComponent(node.ID, adjacency, visited)
			if len(component) >= f.config.MinRingSize {
				community := interfaces.Community{
					Members: component,
				}
				communities = append(communities, community)
			}
		}
	}

	return communities
}

// dfsComponent performs DFS to find a connected component
func (f *FraudRingDetector) dfsComponent(nodeID string, adjacency map[string][]string, visited map[string]bool) []string {
	visited[nodeID] = true
	component := []string{nodeID}

	for _, neighbor := range adjacency[nodeID] {
		if !visited[neighbor] {
			component = append(component, f.dfsComponent(neighbor, adjacency, visited)...)
		}
	}

	return component
}

// calculateCommunityFraudScore calculates fraud score for a community
func (f *FraudRingDetector) calculateCommunityFraudScore(members []string, networkGraph *interfaces.NetworkGraph, graph *TransactionGraph) float64 {
	score := 0.0

	// Connectivity score
	connectivityScore := f.calculateConnectivityScore(members, networkGraph)
	score += connectivityScore * f.config.ConnectivityWeight

	// Risk score based on member attributes
	riskScore := f.calculateMemberRiskScore(members, graph)
	score += riskScore * 0.4

	// Temporal clustering score
	temporalScore := f.calculateTemporalClusteringScore(members, graph)
	score += temporalScore * f.config.TemporalWeight

	// Amount clustering score
	amountScore := f.calculateAmountClusteringScore(members, graph)
	score += amountScore * f.config.AmountWeight

	return math.Min(score, 1.0)
}

// calculateConnectivityScore calculates how well-connected a community is
func (f *FraudRingDetector) calculateConnectivityScore(members []string, networkGraph *interfaces.NetworkGraph) float64 {
	memberSet := make(map[string]bool)
	for _, member := range members {
		memberSet[member] = true
	}

	internalEdges := 0
	totalPossibleEdges := len(members) * (len(members) - 1) / 2

	for _, edge := range networkGraph.Edges {
		if memberSet[edge.Source] && memberSet[edge.Target] {
			internalEdges++
		}
	}

	if totalPossibleEdges == 0 {
		return 0.0
	}

	return float64(internalEdges) / float64(totalPossibleEdges)
}

// calculateMemberRiskScore calculates average risk score of community members
func (f *FraudRingDetector) calculateMemberRiskScore(members []string, graph *TransactionGraph) float64 {
	totalRisk := 0.0
	count := 0

	for _, member := range members {
		if user, exists := graph.Users[member]; exists {
			totalRisk += user.RiskScore
			count++
		}
		if merchant, exists := graph.Merchants[member]; exists {
			totalRisk += merchant.RiskScore
			count++
		}
	}

	if count == 0 {
		return 0.0
	}

	return totalRisk / float64(count)
}

// calculateTemporalClusteringScore calculates how clustered transactions are in time
func (f *FraudRingDetector) calculateTemporalClusteringScore(members []string, graph *TransactionGraph) float64 {
	memberSet := make(map[string]bool)
	for _, member := range members {
		memberSet[member] = true
	}

	timestamps := make([]time.Time, 0)
	for _, tx := range graph.Transactions {
		if memberSet[tx.UserID] || memberSet[tx.MerchantID] {
			timestamps = append(timestamps, tx.Timestamp)
		}
	}

	if len(timestamps) < 2 {
		return 0.0
	}

	// Sort timestamps
	sort.Slice(timestamps, func(i, j int) bool {
		return timestamps[i].Before(timestamps[j])
	})

	// Calculate temporal clustering (smaller time spans = higher clustering)
	timeSpan := timestamps[len(timestamps)-1].Sub(timestamps[0]).Hours()
	maxTimeSpan := 24.0 * 7.0 // One week

	clusteringScore := 1.0 - (timeSpan / maxTimeSpan)
	if clusteringScore < 0 {
		clusteringScore = 0
	}

	return clusteringScore
}

// calculateAmountClusteringScore calculates how similar transaction amounts are
func (f *FraudRingDetector) calculateAmountClusteringScore(members []string, graph *TransactionGraph) float64 {
	memberSet := make(map[string]bool)
	for _, member := range members {
		memberSet[member] = true
	}

	amounts := make([]float64, 0)
	for _, tx := range graph.Transactions {
		if memberSet[tx.UserID] || memberSet[tx.MerchantID] {
			amount, _ := tx.Amount.Float64()
			amounts = append(amounts, amount)
		}
	}

	if len(amounts) < 2 {
		return 0.0
	}

	// Calculate coefficient of variation (lower = more clustered)
	mean := 0.0
	for _, amount := range amounts {
		mean += amount
	}
	mean /= float64(len(amounts))

	variance := 0.0
	for _, amount := range amounts {
		diff := amount - mean
		variance += diff * diff
	}
	variance /= float64(len(amounts))

	if mean == 0 {
		return 0.0
	}

	coefficientOfVariation := math.Sqrt(variance) / mean
	clusteringScore := 1.0 / (1.0 + coefficientOfVariation)

	return clusteringScore
}

// calculateRiskLevel determines risk level from fraud score
func (f *FraudRingDetector) calculateRiskLevel(fraudScore float64) string {
	switch {
	case fraudScore >= 0.8:
		return "critical"
	case fraudScore >= 0.6:
		return "high"
	case fraudScore >= 0.4:
		return "medium"
	default:
		return "low"
	}
}

// calculateCommunityCentrality calculates centrality measure for a community
func (f *FraudRingDetector) calculateCommunityCentrality(members []string, networkGraph *interfaces.NetworkGraph) float64 {
	memberSet := make(map[string]bool)
	for _, member := range members {
		memberSet[member] = true
	}

	// Count edges involving community members
	internalEdges := 0
	externalEdges := 0

	for _, edge := range networkGraph.Edges {
		sourceInCommunity := memberSet[edge.Source]
		targetInCommunity := memberSet[edge.Target]

		if sourceInCommunity && targetInCommunity {
			internalEdges++
		} else if sourceInCommunity || targetInCommunity {
			externalEdges++
		}
	}

	totalEdges := internalEdges + externalEdges
	if totalEdges == 0 {
		return 0.0
	}

	// Centrality based on ratio of internal to total edges
	return float64(internalEdges) / float64(totalEdges)
}

// countCommunityTransactions counts transactions involving community members
func (f *FraudRingDetector) countCommunityTransactions(members []string, graph *TransactionGraph) int {
	memberSet := make(map[string]bool)
	for _, member := range members {
		memberSet[member] = true
	}

	count := 0
	for _, tx := range graph.Transactions {
		if memberSet[tx.UserID] || memberSet[tx.MerchantID] {
			count++
		}
	}

	return count
}

// calculateCommunityAmount calculates total amount for community transactions
func (f *FraudRingDetector) calculateCommunityAmount(members []string, graph *TransactionGraph) float64 {
	memberSet := make(map[string]bool)
	for _, member := range members {
		memberSet[member] = true
	}

	total := 0.0
	for _, tx := range graph.Transactions {
		if memberSet[tx.UserID] || memberSet[tx.MerchantID] {
			amount, _ := tx.Amount.Float64()
			total += amount
		}
	}

	return total
}

// identifyCommunityRiskIndicators identifies risk indicators for a community
func (f *FraudRingDetector) identifyCommunityRiskIndicators(members []string, networkGraph *interfaces.NetworkGraph, graph *TransactionGraph) []string {
	indicators := make([]string, 0)

	// High connectivity
	connectivityScore := f.calculateConnectivityScore(members, networkGraph)
	if connectivityScore > 0.7 {
		indicators = append(indicators, "high_connectivity")
	}

	// Temporal clustering
	temporalScore := f.calculateTemporalClusteringScore(members, graph)
	if temporalScore > 0.8 {
		indicators = append(indicators, "temporal_clustering")
	}

	// Amount patterns
	amountScore := f.calculateAmountClusteringScore(members, graph)
	if amountScore > 0.7 {
		indicators = append(indicators, "amount_patterns")
	}

	// Shared devices/locations
	if f.hasSharedAttributes(members, graph) {
		indicators = append(indicators, "shared_attributes")
	}

	return indicators
}

// hasSharedAttributes checks if community members share suspicious attributes
func (f *FraudRingDetector) hasSharedAttributes(members []string, graph *TransactionGraph) bool {
	memberSet := make(map[string]bool)
	for _, member := range members {
		memberSet[member] = true
	}

	deviceFingerprints := make(map[string]int)
	locations := make(map[string]int)

	for _, tx := range graph.Transactions {
		if memberSet[tx.UserID] {
			if tx.DeviceFingerprint != nil {
				deviceFingerprints[*tx.DeviceFingerprint]++
			}

			if tx.Location != nil {
				locationKey := fmt.Sprintf("%.2f,%.2f", tx.Location.Latitude, tx.Location.Longitude)
				locations[locationKey]++
			}
		}
	}

	// Check for shared devices or locations
	for _, count := range deviceFingerprints {
		if count > 1 {
			return true
		}
	}

	for _, count := range locations {
		if count > 2 { // Allow some location sharing
			return true
		}
	}

	return false
}

// enhanceFraudRingAnalysis enhances the fraud ring analysis with additional details
func (f *FraudRingDetector) enhanceFraudRingAnalysis(result *interfaces.QuantumCommunityResult, graph *TransactionGraph) {
	// Add detailed analysis to each fraud ring
	for i := range result.FraudRings {
		ring := &result.FraudRings[i]

		// Recalculate with more precision
		ring.TransactionCount = f.countCommunityTransactions(ring.Members, graph)
		ring.TotalAmount = f.calculateCommunityAmount(ring.Members, graph)

		// Add more detailed risk indicators
		additionalIndicators := f.analyzeRingPatterns(ring.Members, graph)
		ring.RiskIndicators = append(ring.RiskIndicators, additionalIndicators...)
	}
}

// analyzeRingPatterns analyzes patterns specific to fraud rings
func (f *FraudRingDetector) analyzeRingPatterns(members []string, graph *TransactionGraph) []string {
	indicators := make([]string, 0)

	memberSet := make(map[string]bool)
	for _, member := range members {
		memberSet[member] = true
	}

	// Analyze transaction patterns
	rapidTransactions := 0
	highAmountTransactions := 0

	for _, tx := range graph.Transactions {
		if memberSet[tx.UserID] || memberSet[tx.MerchantID] {
			amount, _ := tx.Amount.Float64()

			if amount > 5000 {
				highAmountTransactions++
			}

			// Check for rapid transactions (within 1 hour)
			for _, otherTx := range graph.Transactions {
				if tx.TransactionID != otherTx.TransactionID &&
					(memberSet[otherTx.UserID] || memberSet[otherTx.MerchantID]) &&
					math.Abs(tx.Timestamp.Sub(otherTx.Timestamp).Minutes()) < 60 {
					rapidTransactions++
					break
				}
			}
		}
	}

	if rapidTransactions > len(members) {
		indicators = append(indicators, "rapid_transaction_pattern")
	}

	if highAmountTransactions > len(members)/2 {
		indicators = append(indicators, "high_value_pattern")
	}

	return indicators
}

// sendRealTimeAlerts sends real-time alerts for detected fraud rings
func (f *FraudRingDetector) sendRealTimeAlerts(ctx context.Context, result *interfaces.QuantumCommunityResult) {
	for _, fraudRing := range result.FraudRings {
		if fraudRing.ConfidenceScore >= f.config.AlertThreshold {
			go func(ring interfaces.FraudRing) {
				if err := f.alertService.SendFraudRingAlert(ctx, &ring); err != nil {
					// Log error but don't fail the main process
					fmt.Printf("Failed to send fraud ring alert: %v\n", err)
				}
			}(fraudRing)
		}
	}

	for _, community := range result.Communities {
		if community.FraudScore >= f.config.AlertThreshold {
			go func(comm interfaces.Community) {
				if err := f.alertService.SendCommunityAlert(ctx, &comm); err != nil {
					// Log error but don't fail the main process
					fmt.Printf("Failed to send community alert: %v\n", err)
				}
			}(community)
		}
	}
}
