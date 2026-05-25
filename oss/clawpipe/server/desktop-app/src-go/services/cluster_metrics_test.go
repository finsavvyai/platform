package services

import (
	"context"
	"testing"

	"finsavvyai-desktop/api"
	"finsavvyai-desktop/config"

	"github.com/sirupsen/logrus"
)

func TestGetMetrics_Empty(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewClusterService(cfg, logger)

	m, err := svc.GetMetrics(context.Background())
	if err != nil {
		t.Fatalf("GetMetrics error: %v", err)
	}
	if m.TotalRequests != 0 {
		t.Errorf("TotalRequests = %d, want 0", m.TotalRequests)
	}
	if m.AvgResponseTime != 0 {
		t.Errorf("AvgResponseTime = %f, want 0", m.AvgResponseTime)
	}
}

func TestGetMetrics_WithNodes(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewClusterService(cfg, logger)

	svc.nodes["a"] = &api.ClusterNode{
		ID: "a", Status: "online", Load: 10,
		TotalRequests: 100, SuccessRequests: 95, ResponseTime: 0.5,
	}
	svc.nodes["b"] = &api.ClusterNode{
		ID: "b", Status: "online", Load: 20,
		TotalRequests: 200, SuccessRequests: 190, ResponseTime: 0.3,
	}

	m, err := svc.GetMetrics(context.Background())
	if err != nil {
		t.Fatalf("GetMetrics error: %v", err)
	}
	if m.TotalRequests != 300 {
		t.Errorf("TotalRequests = %d, want 300", m.TotalRequests)
	}
	if m.ActiveRequests != 30 {
		t.Errorf("ActiveRequests = %d, want 30", m.ActiveRequests)
	}
	if m.AvgResponseTime == 0 {
		t.Error("AvgResponseTime should be > 0 with online nodes")
	}
}

func TestGetMetrics_MixedNodeStatus(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewClusterService(cfg, logger)

	svc.nodes["online"] = &api.ClusterNode{
		ID: "online", Status: "online", Load: 5,
		TotalRequests: 50, SuccessRequests: 50, ResponseTime: 0.1,
	}
	svc.nodes["offline"] = &api.ClusterNode{
		ID: "offline", Status: "offline", Load: 0,
		TotalRequests: 10, SuccessRequests: 8, ResponseTime: 1.0,
	}

	m, err := svc.GetMetrics(context.Background())
	if err != nil {
		t.Fatalf("GetMetrics error: %v", err)
	}
	// Only online node load counts for active requests
	if m.ActiveRequests != 5 {
		t.Errorf("ActiveRequests = %d, want 5", m.ActiveRequests)
	}
	if m.TotalRequests != 60 {
		t.Errorf("TotalRequests = %d, want 60", m.TotalRequests)
	}
}

func TestStartCluster(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewClusterService(cfg, logger)

	if err := svc.StartCluster(context.Background()); err != nil {
		t.Fatalf("StartCluster error: %v", err)
	}
	if !svc.isRunning {
		t.Error("isRunning = false after StartCluster")
	}
}

func TestStopCluster(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewClusterService(cfg, logger)
	svc.isRunning = true

	if err := svc.StopCluster(context.Background()); err != nil {
		t.Fatalf("StopCluster error: %v", err)
	}
	if svc.isRunning {
		t.Error("isRunning = true after StopCluster")
	}
}

func TestStartStopRoundTrip(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewClusterService(cfg, logger)

	svc.StartCluster(context.Background())
	if !svc.isRunning {
		t.Error("should be running after start")
	}
	svc.StopCluster(context.Background())
	if svc.isRunning {
		t.Error("should not be running after stop")
	}
}
