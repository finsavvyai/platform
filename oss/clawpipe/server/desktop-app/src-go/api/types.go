package api

import (
	"time"
)

// Cluster status response from Python API
type ClusterStatus struct {
	ClusterID   string `json:"cluster_id"`
	MasterURL   string `json:"master"`
	TotalNodes  int    `json:"total_nodes"`
	OnlineNodes int    `json:"online_nodes"`
	TotalModels int    `json:"total_models"`
	Timestamp   string `json:"timestamp"`
	IsRunning   bool   `json:"is_running"`
}

// Cluster node information
type ClusterNode struct {
	ID              string            `json:"id"`
	Name            string            `json:"name"`
	Host            string            `json:"host"`
	Port            int               `json:"port"`
	Models          []string          `json:"models"`
	Status          string            `json:"status"` // "online", "offline", "busy"
	Load            int               `json:"load"`
	MaxLoad         int               `json:"max_load"`
	LastHeartbeat   time.Time         `json:"last_heartbeat"`
	Capabilities    map[string]string `json:"capabilities"`
	ResponseTime    float64           `json:"response_time"`
	TotalRequests   int64             `json:"total_requests"`
	SuccessRequests int64             `json:"success_requests"`
}

// Configuration for adding a new node (frontend to backend)
type ClusterNodeConfig struct {
	Name   string   `json:"name"`
	Host   string   `json:"host"`
	Port   int      `json:"port"`
	Models []string `json:"models"`
}

// Metrics for monitoring
type ClusterMetrics struct {
	TotalRequests   int64   `json:"total_requests"`
	ActiveRequests  int     `json:"active_requests"`
	AvgResponseTime float64 `json:"avg_response_time"`
	SuccessRate     float64 `json:"success_rate"`
	Uptime          int64   `json:"uptime"`
	Throughput      float64 `json:"throughput"` // requests per second
}

// Node capabilities and system info
type NodeCapabilities struct {
	GPU    bool   `json:"gpu"`
	Memory uint64 `json:"memory"`
	CPU    int    `json:"cpu"`
	OS     string `json:"os"`
}
