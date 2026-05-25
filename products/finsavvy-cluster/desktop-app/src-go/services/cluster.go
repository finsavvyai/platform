package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"finsavvyai-desktop/api"
	"finsavvyai-desktop/config"

	"github.com/sirupsen/logrus"
)

type ClusterService struct {
	config    *config.Config
	client    *http.Client
	logger    *logrus.Logger
	nodes     map[string]*api.ClusterNode
	isRunning bool
}

func NewClusterService(cfg *config.Config, logger *logrus.Logger) *ClusterService {
	return &ClusterService{
		config: cfg,
		client: &http.Client{
			Timeout: time.Duration(cfg.Cluster.Timeout) * time.Second,
		},
		logger: logger,
		nodes:  make(map[string]*api.ClusterNode),
	}
}

func (s *ClusterService) GetClusterStatus(ctx context.Context) (*api.ClusterStatus, error) {
	masterURL := fmt.Sprintf("http://%s:%d", s.config.Cluster.MasterHost, s.config.Cluster.MasterPort)

	// Try to connect to Python cluster master
	resp, err := s.client.Get(masterURL + "/cluster/status")
	if err != nil {
		s.logger.WithError(err).Warn("Failed to connect to cluster master")
		return s.getOfflineStatus(), nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		s.logger.WithField("status", resp.StatusCode).Warn("Cluster master returned non-OK status")
		return s.getOfflineStatus(), nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var status api.ClusterStatus
	if err := json.Unmarshal(body, &status); err != nil {
		return nil, fmt.Errorf("failed to decode cluster status: %w", err)
	}

	// Note: IsRunning field will be set by the returned status
	return &status, nil
}

func (s *ClusterService) GetNodes(ctx context.Context) ([]*api.ClusterNode, error) {
	masterURL := fmt.Sprintf("http://%s:%d", s.config.Cluster.MasterHost, s.config.Cluster.MasterPort)

	resp, err := s.client.Get(masterURL + "/cluster/nodes")
	if err != nil {
		s.logger.WithError(err).Warn("Failed to get nodes from cluster master")
		return s.getLocalNodes(), nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		s.logger.WithField("status", resp.StatusCode).Warn("Cluster master returned non-OK status for nodes")
		return s.getLocalNodes(), nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var response struct {
		Nodes []*api.ClusterNode `json:"nodes"`
	}

	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to decode nodes response: %w", err)
	}

	// Update local cache
	for _, node := range response.Nodes {
		s.nodes[node.ID] = node
	}

	return response.Nodes, nil
}

func (s *ClusterService) AddNode(ctx context.Context, nodeConfig *api.ClusterNodeConfig) (string, error) {
	// Generate node ID
	nodeID := fmt.Sprintf("node-%d", time.Now().Unix())

	// Create node object
	node := &api.ClusterNode{
		ID:              nodeID,
		Name:            nodeConfig.Name,
		Host:            nodeConfig.Host,
		Port:            nodeConfig.Port,
		Models:          nodeConfig.Models,
		Status:          "offline",
		Load:            0,
		MaxLoad:         100,
		LastHeartbeat:   time.Now(),
		Capabilities:    make(map[string]string),
		ResponseTime:    0,
		TotalRequests:   0,
		SuccessRequests: 0,
	}

	// Add to local cache
	s.nodes[nodeID] = node

	// Try to register with cluster master
	masterURL := fmt.Sprintf("http://%s:%d", s.config.Cluster.MasterHost, s.config.Cluster.MasterPort)

	registerData := map[string]interface{}{
		"id":           nodeID,
		"name":         nodeConfig.Name,
		"host":         nodeConfig.Host,
		"port":         nodeConfig.Port,
		"models":       nodeConfig.Models,
		"capabilities": node.Capabilities,
		"max_load":     node.MaxLoad,
	}

	jsonData, err := json.Marshal(registerData)
	if err != nil {
		return "", fmt.Errorf("failed to marshal node data: %w", err)
	}

	resp, err := s.client.Post(masterURL+"/cluster/join", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		s.logger.WithError(err).Warn("Failed to register node with cluster master")
		return nodeID, nil // Return node ID even if master registration fails
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		s.logger.WithField("status", resp.StatusCode).Warn("Cluster master returned non-OK status for node registration")
		return nodeID, nil // Return node ID even if master registration fails
	}

	s.logger.WithField("node_id", nodeID).Info("Node successfully registered with cluster")
	return nodeID, nil
}

func (s *ClusterService) RemoveNode(ctx context.Context, nodeID string) error {
	// Remove from local cache
	delete(s.nodes, nodeID)

	// Try to remove from cluster master (if API is available)
	masterURL := fmt.Sprintf("http://%s:%d", s.config.Cluster.MasterHost, s.config.Cluster.MasterPort)

	req, err := http.NewRequestWithContext(ctx, "DELETE", masterURL+"/cluster/nodes/"+nodeID, nil)
	if err != nil {
		return fmt.Errorf("failed to create delete request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		s.logger.WithError(err).Warn("Failed to remove node from cluster master")
		return nil // Don't fail if master removal fails
	}
	defer resp.Body.Close()

	s.logger.WithField("node_id", nodeID).Info("Node removed from cluster")
	return nil
}

func (s *ClusterService) StartCluster(ctx context.Context) error {
	// This would typically start the Python cluster master
	s.logger.Info("Starting cluster...")
	s.isRunning = true
	return nil
}

func (s *ClusterService) StopCluster(ctx context.Context) error {
	// This would typically stop the Python cluster master
	s.logger.Info("Stopping cluster...")
	s.isRunning = false
	return nil
}

func (s *ClusterService) GetMetrics(ctx context.Context) (*api.ClusterMetrics, error) {
	// Calculate metrics from nodes
	var totalRequests int64
	var activeRequests int
	var totalResponseTime float64
	var totalSuccessRate float64
	var onlineNodes int

	for _, node := range s.nodes {
		totalRequests += node.TotalRequests
		if node.Status == "online" {
			onlineNodes++
			activeRequests += int(node.Load)
		}
		totalResponseTime += node.ResponseTime
		if node.TotalRequests > 0 {
			successRate := float64(node.SuccessRequests) / float64(node.TotalRequests) * 100
			totalSuccessRate += successRate
		}
	}

	var avgResponseTime float64
	var successRate float64

	if onlineNodes > 0 {
		avgResponseTime = totalResponseTime / float64(onlineNodes)
		successRate = totalSuccessRate / float64(onlineNodes)
	}

	metrics := &api.ClusterMetrics{
		TotalRequests:   totalRequests,
		ActiveRequests:  activeRequests,
		AvgResponseTime: avgResponseTime,
		SuccessRate:     successRate,
		Uptime:          time.Now().Unix() - 1234567890,  // Mock uptime
		Throughput:      float64(totalRequests) / 3600.0, // Requests per hour
	}

	return metrics, nil
}

func (s *ClusterService) getOfflineStatus() *api.ClusterStatus {
	return &api.ClusterStatus{
		ClusterID:   "finsavvy-home-cluster",
		MasterURL:   fmt.Sprintf("http://%s:%d", s.config.Cluster.MasterHost, s.config.Cluster.MasterPort),
		TotalNodes:  len(s.nodes),
		OnlineNodes: 0,
		TotalModels: 0,
		Timestamp:   time.Now().Format(time.RFC3339),
		IsRunning:   false,
	}
}

func (s *ClusterService) getLocalNodes() []*api.ClusterNode {
	nodes := make([]*api.ClusterNode, 0, len(s.nodes))
	for _, node := range s.nodes {
		nodes = append(nodes, node)
	}
	return nodes
}
