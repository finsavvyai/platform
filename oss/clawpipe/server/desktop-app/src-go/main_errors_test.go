package main

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"finsavvyai-desktop/api"
	"finsavvyai-desktop/config"
	"finsavvyai-desktop/services"

	"github.com/sirupsen/logrus"
)

// failingClusterService always returns errors.
type failingClusterService struct{}

func (f *failingClusterService) GetClusterStatus(
	_ context.Context,
) (*api.ClusterStatus, error) {
	return nil, errors.New("cluster unreachable")
}

func (f *failingClusterService) GetNodes(
	_ context.Context,
) ([]*api.ClusterNode, error) {
	return nil, errors.New("nodes unavailable")
}

func (f *failingClusterService) AddNode(
	_ context.Context, _ *api.ClusterNodeConfig,
) (string, error) {
	return "", errors.New("add failed")
}

func (f *failingClusterService) RemoveNode(
	_ context.Context, _ string,
) error {
	return errors.New("remove failed")
}

func (f *failingClusterService) StartCluster(
	_ context.Context,
) error {
	return errors.New("start failed")
}

func (f *failingClusterService) StopCluster(
	_ context.Context,
) error {
	return errors.New("stop failed")
}

func newFailingServer() *Server {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	hub := services.NewWSHub(logger)
	go hub.Run()

	return &Server{
		config:         cfg,
		clusterService: &failingClusterService{},
		wsHub:          hub,
		logger:         logger,
		configSaver: func(_ config.Config) error {
			return errors.New("save failed")
		},
	}
}

func TestClusterStatus_ServiceError(t *testing.T) {
	srv := newFailingServer()
	req := httptest.NewRequest("GET", "/api/cluster/status", nil)
	w := httptest.NewRecorder()
	srv.handleClusterStatus(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d",
			w.Code, http.StatusInternalServerError)
	}
}

func TestClusterNodes_ServiceError(t *testing.T) {
	srv := newFailingServer()
	req := httptest.NewRequest("GET", "/api/cluster/nodes", nil)
	w := httptest.NewRecorder()
	srv.handleClusterNodes(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d",
			w.Code, http.StatusInternalServerError)
	}
}

func TestAddNode_ServiceError(t *testing.T) {
	srv := newFailingServer()
	body := `{"name":"n","host":"h","port":1,"models":["m"]}`
	req := httptest.NewRequest("POST", "/api/cluster/nodes",
		strings.NewReader(body))
	w := httptest.NewRecorder()
	srv.handleAddNode(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d",
			w.Code, http.StatusInternalServerError)
	}
}

func TestRemoveNode_ServiceError(t *testing.T) {
	srv := newFailingServer()
	req := httptest.NewRequest("DELETE",
		"/api/cluster/nodes/delete?id=n1", nil)
	w := httptest.NewRecorder()
	srv.handleRemoveNode(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d",
			w.Code, http.StatusInternalServerError)
	}
}

func TestStartCluster_ServiceError(t *testing.T) {
	srv := newFailingServer()
	req := httptest.NewRequest("POST", "/api/cluster/start", nil)
	w := httptest.NewRecorder()
	srv.handleStartCluster(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d",
			w.Code, http.StatusInternalServerError)
	}
}

func TestStopCluster_ServiceError(t *testing.T) {
	srv := newFailingServer()
	req := httptest.NewRequest("POST", "/api/cluster/stop", nil)
	w := httptest.NewRecorder()
	srv.handleStopCluster(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d",
			w.Code, http.StatusInternalServerError)
	}
}

func TestUpdateConfig_SaveError(t *testing.T) {
	srv := newFailingServer()
	body := `{"server":{"host":"x","port":0},` +
		`"cluster":{"master_host":"x","master_port":0,"timeout":1}}`
	req := httptest.NewRequest("POST", "/api/config",
		strings.NewReader(body))
	w := httptest.NewRecorder()
	srv.handleUpdateConfig(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d",
			w.Code, http.StatusInternalServerError)
	}
}
