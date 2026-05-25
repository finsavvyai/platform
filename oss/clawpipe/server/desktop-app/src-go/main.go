package main

import (
	"context"
	"flag"
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

const appVersion = "1.0.0"

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow connections from any origin for development
		},
	}
)

// ClusterServicer abstracts cluster operations for testability.
type ClusterServicer interface {
	GetClusterStatus(ctx context.Context) (*api.ClusterStatus, error)
	GetNodes(ctx context.Context) ([]*api.ClusterNode, error)
	AddNode(ctx context.Context, cfg *api.ClusterNodeConfig) (string, error)
	RemoveNode(ctx context.Context, nodeID string) error
	StartCluster(ctx context.Context) error
	StopCluster(ctx context.Context) error
}

type Server struct {
	config         *config.Config
	clusterService ClusterServicer
	wsHub          *services.WSHub
	logger         *logrus.Logger
	httpServer     *http.Server
	configSaver    func(config.Config) error
}

func main() {
	portFlag := flag.Int("port", 0, "HTTP server port (default 8080, or PORT env)")
	versionFlag := flag.Bool("version", false, "Print version and exit")
	flag.Parse()

	if *versionFlag {
		fmt.Printf("FinSavvyAI Desktop %s\n", appVersion)
		os.Exit(0)
	}

	logger := logrus.New()
	logger.SetLevel(logrus.InfoLevel)
	logger.SetFormatter(&logrus.JSONFormatter{})

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger.WithError(err).Fatal("Failed to load configuration")
	}

	port := resolvePort()
	if *portFlag > 0 {
		port = *portFlag
	}
	server := NewServer(cfg, logger)
	server.ListenAndServe(port)
	fmt.Printf("FinSavvyAI Desktop running at http://localhost:%d\n", port)

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	server.Shutdown()
}

// resolvePort returns the port from the PORT env var, or 8080.
func resolvePort() int {
	port := 8080
	if portStr := os.Getenv("PORT"); portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}
	return port
}

// NewServer creates a fully initialized Server.
func NewServer(cfg *config.Config, logger *logrus.Logger) *Server {
	return &Server{
		config:         cfg,
		clusterService: services.NewClusterService(cfg, logger),
		wsHub:          services.NewWSHub(logger),
		logger:         logger,
		configSaver:    config.Save,
	}
}

// ListenAndServe starts the WebSocket hub and HTTP server.
func (s *Server) ListenAndServe(port int) {
	go s.wsHub.Run()

	s.httpServer = &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: s,
	}

	go func() {
		s.logger.WithField("port", port).Info(
			"Starting FinSavvyAI desktop backend server")
		if err := s.httpServer.ListenAndServe(); err != nil &&
			err != http.ErrServerClosed {
			s.logger.WithError(err).Fatal("Server failed to start")
		}
	}()
}

// Shutdown gracefully stops the HTTP server.
func (s *Server) Shutdown() {
	s.logger.Info("Shutting down server...")
	if err := s.httpServer.Shutdown(nil); err != nil {
		s.logger.WithError(err).Error("Server shutdown error")
	}
	s.logger.Info("Server stopped")
}
