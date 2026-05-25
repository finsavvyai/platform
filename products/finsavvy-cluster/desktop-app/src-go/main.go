package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"finsavvyai-desktop/api"
	"finsavvyai-desktop/config"
	"finsavvyai-desktop/services"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow connections from any origin for development
		},
	}
)

type Server struct {
	config         *config.Config
	clusterService *services.ClusterService
	wsHub          *services.WSHub
	logger         *logrus.Logger
	httpServer     *http.Server
}

func main() {
	logger := logrus.New()
	logger.SetLevel(logrus.InfoLevel)
	logger.SetFormatter(&logrus.JSONFormatter{})

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger.WithError(err).Fatal("Failed to load configuration")
	}

	// Get port from environment or use default
	port := 8080
	if portStr := os.Getenv("PORT"); portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}

	// Initialize server
	server := &Server{
		config:         cfg,
		clusterService: services.NewClusterService(cfg, logger),
		wsHub:          services.NewWSHub(logger),
		logger:         logger,
	}

	// Start WebSocket hub
	go server.wsHub.Run()

	// Start HTTP server
	server.httpServer = &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: server,
	}

	// Start server in background
	go func() {
		logger.WithField("port", port).Info("Starting FinSavvyAI desktop backend server")
		if err := server.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.WithError(err).Fatal("Server failed to start")
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	// Graceful shutdown
	if err := server.httpServer.Shutdown(nil); err != nil {
		logger.WithError(err).Error("Server shutdown error")
	}

	logger.Info("Server stopped")
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	switch r.URL.Path {
	case "/api/cluster/status":
		s.handleClusterStatus(w, r)
	case "/api/cluster/nodes":
		if r.Method == "GET" {
			s.handleClusterNodes(w, r)
		} else if r.Method == "POST" {
			s.handleAddNode(w, r)
		}
	case "/api/cluster/nodes/delete":
		if r.Method == "DELETE" {
			s.handleRemoveNode(w, r)
		}
	case "/api/cluster/start":
		s.handleStartCluster(w, r)
	case "/api/cluster/stop":
		s.handleStopCluster(w, r)
	case "/api/config":
		if r.Method == "GET" {
			s.handleGetConfig(w, r)
		} else if r.Method == "POST" {
			s.handleUpdateConfig(w, r)
		}
	case "/ws":
		s.handleWebSocket(w, r)
	default:
		http.NotFound(w, r)
	}
}

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

	if err := config.Save(newConfig); err != nil {
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

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.logger.WithError(err).Error("Failed to upgrade WebSocket connection")
		return
	}

	client := &services.WSClient{
		Conn:   conn,
		Send:   make(chan []byte, 256),
		Hub:    s.wsHub,
		Logger: s.logger,
	}

	s.wsHub.Register(client)

	go client.WritePump()
	go client.ReadPump()

	s.logger.Info("New WebSocket client connected")
}
