package main

import (
	"encoding/json"
	"net/http"

	"finsavvyai-desktop/api"
	"finsavvyai-desktop/config"
)

func (s *Server) handleClusterStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	status, err := s.clusterService.GetClusterStatus(r.Context())
	if err != nil {
		s.logger.WithError(err).Error("Failed to get cluster status")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func (s *Server) handleClusterNodes(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	nodes, err := s.clusterService.GetNodes(r.Context())
	if err != nil {
		s.logger.WithError(err).Error("Failed to get cluster nodes")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"nodes": nodes})
}

func (s *Server) handleAddNode(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var nodeConfig api.ClusterNodeConfig
	if err := json.NewDecoder(r.Body).Decode(&nodeConfig); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	nodeID, err := s.clusterService.AddNode(r.Context(), &nodeConfig)
	if err != nil {
		s.logger.WithError(err).Error("Failed to add node")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"node_id": nodeID})

	// Broadcast update to WebSocket clients
	s.wsHub.Broadcast("node_added", nodeID)
}

func (s *Server) handleRemoveNode(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	nodeID := r.URL.Query().Get("id")
	if nodeID == "" {
		http.Error(w, "Missing node ID", http.StatusBadRequest)
		return
	}

	err := s.clusterService.RemoveNode(r.Context(), nodeID)
	if err != nil {
		s.logger.WithError(err).Error("Failed to remove node")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})

	// Broadcast update to WebSocket clients
	s.wsHub.Broadcast("node_removed", nodeID)
}

func (s *Server) handleStartCluster(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	err := s.clusterService.StartCluster(r.Context())
	if err != nil {
		s.logger.WithError(err).Error("Failed to start cluster")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "started"})

	// Broadcast update to WebSocket clients
	s.wsHub.Broadcast("cluster_started", nil)
}

func (s *Server) handleStopCluster(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	err := s.clusterService.StopCluster(r.Context())
	if err != nil {
		s.logger.WithError(err).Error("Failed to stop cluster")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "stopped"})

	// Broadcast update to WebSocket clients
	s.wsHub.Broadcast("cluster_stopped", nil)
}

func (s *Server) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.config)
}

func (s *Server) handleUpdateConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var newConfig config.Config
	if err := json.NewDecoder(r.Body).Decode(&newConfig); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := s.configSaver(newConfig); err != nil {
		s.logger.WithError(err).Error("Failed to save configuration")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	*s.config = newConfig

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})

	// Broadcast update to WebSocket clients
	s.wsHub.Broadcast("config_updated", newConfig)
}

