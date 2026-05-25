package services

import (
	"context"
	"fmt"
	"time"

	"finsavvyai-desktop/api"
)

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
