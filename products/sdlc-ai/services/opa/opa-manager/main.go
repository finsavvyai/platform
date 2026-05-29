package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/gorilla/mux"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"

	"github.com/sdlc-ai/platform/services/opa/internal/bundler"
	"github.com/sdlc-ai/platform/services/opa/internal/manager"
	"github.com/sdlc-ai/platform/services/opa/internal/storage"
)

type Server struct {
	logger        *logrus.Logger
	router        *mux.Router
	db            *sqlx.DB
	redis         *redis.Client
	policyManager *manager.PolicyManager
	bundleManager *bundler.BundleManager
	httpServer    *http.Server
}

func main() {
	// Load configuration
	config := loadConfig()

	// Initialize logger
	logger := initLogger(config.LogLevel)

	// Initialize server
	server, err := NewServer(config, logger)
	if err != nil {
		log.Fatalf("Failed to initialize server: %v", err)
	}

	// Start server
	if err := server.Start(); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func NewServer(config Config, logger *logrus.Logger) (*Server, error) {
	// Initialize database
	db, err := initDatabase(config.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize database: %w", err)
	}

	// Initialize Redis
	redisClient := initRedis(config.RedisURL)

	// Initialize storage
	policyStorage := storage.NewPostgresStorage(db)
	bundleStorage := storage.NewBundleStorage(db)

	// Initialize managers
	policyManager := manager.NewPolicyManager(policyStorage, logger)
	bundleManager := bundler.NewBundleManager(bundleStorage, config.OPAURL, logger)

	// Initialize router
	router := mux.NewRouter()

	server := &Server{
		logger:        logger,
		router:        router,
		db:            db,
		redis:         redisClient,
		policyManager: policyManager,
		bundleManager: bundleManager,
	}

	server.setupRoutes()

	return server, nil
}

func (s *Server) Start() error {
	// Start background services
	go s.startBackgroundServices()

	// Start HTTP server
	s.httpServer = &http.Server{
		Addr:         ":8080",
		Handler:      s.router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	s.logger.Info("Starting OPA Manager server on :8080")

	// Graceful shutdown
	go func() {
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.logger.Fatalf("HTTP server failed: %v", err)
		}
	}()

	return s.waitForShutdown()
}

func (s *Server) setupRoutes() {
	// Health check
	s.router.HandleFunc("/health", s.handleHealth).Methods("GET")
	s.router.HandleFunc("/ready", s.handleReady).Methods("GET")

	// Policy management
	policyRouter := s.router.PathPrefix("/api/v1/policies").Subrouter()
	policyRouter.HandleFunc("", s.handleListPolicies).Methods("GET")
	policyRouter.HandleFunc("", s.handleCreatePolicy).Methods("POST")
	policyRouter.HandleFunc("/{id}", s.handleGetPolicy).Methods("GET")
	policyRouter.HandleFunc("/{id}", s.handleUpdatePolicy).Methods("PUT")
	policyRouter.HandleFunc("/{id}", s.handleDeletePolicy).Methods("DELETE")
	policyRouter.HandleFunc("/{id}/activate", s.handleActivatePolicy).Methods("POST")
	policyRouter.HandleFunc("/{id}/deactivate", s.handleDeactivatePolicy).Methods("POST")
	policyRouter.HandleFunc("/{id}/test", s.handleTestPolicy).Methods("POST")
	policyRouter.HandleFunc("/{id}/versions", s.handleGetPolicyVersions).Methods("GET")
	policyRouter.HandleFunc("/{id}/versions/{versionId}/restore", s.handleRestorePolicyVersion).Methods("POST")

	// Bundle management
	bundleRouter := s.router.PathPrefix("/api/v1/bundles").Subrouter()
	bundleRouter.HandleFunc("", s.handleCreateBundle).Methods("POST")
	bundleRouter.HandleFunc("", s.handleListBundles).Methods("GET")
	bundleRouter.HandleFunc("/{id}", s.handleGetBundle).Methods("GET")
	bundleRouter.HandleFunc("/{id}/deploy", s.handleDeployBundle).Methods("POST")
	bundleRouter.HandleFunc("/{id}", s.handleDeleteBundle).Methods("DELETE")

	// OPA integration
	opaRouter := s.router.PathPrefix("/api/v1/opa").Subrouter()
	opaRouter.HandleFunc("/status", s.handleOPAStatus).Methods("GET")
	opaRouter.HandleFunc("/reload", s.handleOPAReload).Methods("POST")
	opaRouter.HandleFunc("/policies", s.handleListOPAPolicies).Methods("GET")

	// Metrics and monitoring
	s.router.HandleFunc("/metrics", s.handleMetrics).Methods("GET")
}

func (s *Server) startBackgroundServices() {
	// Start bundle monitoring
	go s.bundleManager.StartBundleMonitoring()

	// Start policy synchronization
	go s.policyManager.StartPolicySync()

	// Start health monitoring
	go s.startHealthMonitoring()
}

func (s *Server) waitForShutdown() error {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	s.logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Shutdown HTTP server
	if err := s.httpServer.Shutdown(ctx); err != nil {
		s.logger.Errorf("HTTP server shutdown error: %v", err)
	}

	// Close database
	if err := s.db.Close(); err != nil {
		s.logger.Errorf("Database close error: %v", err)
	}

	// Close Redis
	if err := s.redis.Close(); err != nil {
		s.logger.Errorf("Redis close error: %v", err)
	}

	s.logger.Info("Server shutdown complete")
	return nil
}

// HTTP Handlers

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
		"version":   "1.0.0",
	})
}

func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	// Check dependencies
	healthy := true
	checks := map[string]string{}

	// Check database
	if err := s.db.Ping(); err != nil {
		healthy = false
		checks["database"] = "unhealthy: " + err.Error()
	} else {
		checks["database"] = "healthy"
	}

	// Check Redis
	if err := s.redis.Ping(r.Context()).Err(); err != nil {
		healthy = false
		checks["redis"] = "unhealthy: " + err.Error()
	} else {
		checks["redis"] = "healthy"
	}

	// Check OPA
	if err := s.checkOPAHealth(r.Context()); err != nil {
		healthy = false
		checks["opa"] = "unhealthy: " + err.Error()
	} else {
		checks["opa"] = "healthy"
	}

	status := "ready"
	if !healthy {
		status = "not ready"
		w.WriteHeader(http.StatusServiceUnavailable)
	}

	respondJSON(w, map[string]interface{}{
		"status":    status,
		"timestamp": time.Now().UTC(),
		"checks":    checks,
	})
}

func (s *Server) handleListPolicies(w http.ResponseWriter, r *http.Request) {
	policies, err := s.policyManager.ListPolicies(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list policies", err)
		return
	}

	respondJSON(w, map[string]interface{}{
		"policies": policies,
		"total":    len(policies),
	})
}

func (s *Server) handleCreatePolicy(w http.ResponseWriter, r *http.Request) {
	var req CreatePolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	policy, err := s.policyManager.CreatePolicy(r.Context(), &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create policy", err)
		return
	}

	w.WriteHeader(http.StatusCreated)
	respondJSON(w, policy)
}

func (s *Server) handleGetPolicy(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	policy, err := s.policyManager.GetPolicy(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "Policy not found", err)
		return
	}

	respondJSON(w, policy)
}

func (s *Server) handleUpdatePolicy(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req UpdatePolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	policy, err := s.policyManager.UpdatePolicy(r.Context(), id, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update policy", err)
		return
	}

	respondJSON(w, policy)
}

func (s *Server) handleDeletePolicy(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	if err := s.policyManager.DeletePolicy(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete policy", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleActivatePolicy(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	if err := s.policyManager.ActivatePolicy(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to activate policy", err)
		return
	}

	respondJSON(w, map[string]interface{}{
		"message": "Policy activated successfully",
	})
}

func (s *Server) handleDeactivatePolicy(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	if err := s.policyManager.DeactivatePolicy(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to deactivate policy", err)
		return
	}

	respondJSON(w, map[string]interface{}{
		"message": "Policy deactivated successfully",
	})
}

func (s *Server) handleTestPolicy(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req TestPolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := s.policyManager.TestPolicy(r.Context(), id, req.Input)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to test policy", err)
		return
	}

	respondJSON(w, result)
}

func (s *Server) handleGetPolicyVersions(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	if limit == 0 {
		limit = 10
	}

	versions, err := s.policyManager.GetPolicyVersions(r.Context(), id, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get policy versions", err)
		return
	}

	respondJSON(w, map[string]interface{}{
		"versions": versions,
		"limit":    limit,
		"offset":   offset,
	})
}

func (s *Server) handleRestorePolicyVersion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	versionId := vars["versionId"]

	if err := s.policyManager.RestorePolicyVersion(r.Context(), id, versionId); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to restore policy version", err)
		return
	}

	respondJSON(w, map[string]interface{}{
		"message": "Policy version restored successfully",
	})
}

func (s *Server) handleCreateBundle(w http.ResponseWriter, r *http.Request) {
	var req CreateBundleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	bundle, err := s.bundleManager.CreateBundle(r.Context(), &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create bundle", err)
		return
	}

	w.WriteHeader(http.StatusCreated)
	respondJSON(w, bundle)
}

func (s *Server) handleListBundles(w http.ResponseWriter, r *http.Request) {
	bundles, err := s.bundleManager.ListBundles(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list bundles", err)
		return
	}

	respondJSON(w, map[string]interface{}{
		"bundles": bundles,
		"total":   len(bundles),
	})
}

func (s *Server) handleGetBundle(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	bundle, err := s.bundleManager.GetBundle(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "Bundle not found", err)
		return
	}

	respondJSON(w, bundle)
}

func (s *Server) handleDeployBundle(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	if err := s.bundleManager.DeployBundle(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to deploy bundle", err)
		return
	}

	respondJSON(w, map[string]interface{}{
		"message": "Bundle deployed successfully",
	})
}

func (s *Server) handleDeleteBundle(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	if err := s.bundleManager.DeleteBundle(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete bundle", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleOPAStatus(w http.ResponseWriter, r *http.Request) {
	status, err := s.getOPAStatus(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get OPA status", err)
		return
	}

	respondJSON(w, status)
}

func (s *Server) handleOPAReload(w http.ResponseWriter, r *http.Request) {
	if err := s.reloadOPA(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to reload OPA", err)
		return
	}

	respondJSON(w, map[string]interface{}{
		"message": "OPA reloaded successfully",
	})
}

func (s *Server) handleListOPAPolicies(w http.ResponseWriter, r *http.Request) {
	policies, err := s.listOPAPolicies(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list OPA policies", err)
		return
	}

	respondJSON(w, map[string]interface{}{
		"policies": policies,
	})
}

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	metrics := s.collectMetrics()
	respondJSON(w, metrics)
}

// Helper functions

func initDatabase(databaseURL string) (*sqlx.DB, error) {
	db, err := sqlx.Connect("postgres", databaseURL)
	if err != nil {
		return nil, err
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	return db, nil
}

func initRedis(redisURL string) *redis.Client {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL: %v", err)
	}

	return redis.NewClient(opts)
}

func initLogger(level string) *logrus.Logger {
	logger := logrus.New()

	logLevel, err := logrus.ParseLevel(level)
	if err != nil {
		logLevel = logrus.InfoLevel
	}

	logger.SetLevel(logLevel)
	logger.SetFormatter(&logrus.JSONFormatter{})

	return logger
}

func loadConfig() Config {
	viper.SetDefault("PORT", "8080")
	viper.SetDefault("LOG_LEVEL", "info")
	viper.SetDefault("OPA_URL", "http://opa:8181")
	viper.SetDefault("REDIS_URL", "redis://redis:6379")

	viper.AutomaticEnv()

	return Config{
		Port:        viper.GetString("PORT"),
		LogLevel:    viper.GetString("LOG_LEVEL"),
		OPAURL:      viper.GetString("OPA_URL"),
		RedisURL:    viper.GetString("REDIS_URL"),
		DatabaseURL: viper.GetString("DATABASE_URL"),
	}
}

func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string, err error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	response := map[string]interface{}{
		"error": map[string]interface{}{
			"message": message,
		},
		"timestamp": time.Now().UTC(),
	}

	if err != nil {
		response["error"]["details"] = err.Error()
	}

	json.NewEncoder(w).Encode(response)
}

// Background services

func (s *Server) startHealthMonitoring() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.performHealthCheck()
		}
	}
}

func (s *Server) performHealthCheck() {
	ctx := context.Background()

	// Check OPA health
	if err := s.checkOPAHealth(ctx); err != nil {
		s.logger.WithError(err).Error("OPA health check failed")
	}

	// Check other health indicators
	// Add more health checks as needed
}

func (s *Server) checkOPAHealth(ctx context.Context) error {
	// TODO: Implement OPA health check
	return nil
}

func (s *Server) getOPAStatus(ctx context.Context) (map[string]interface{}, error) {
	// TODO: Implement OPA status check
	return map[string]interface{}{
		"status":          "healthy",
		"policies_loaded": 0,
		"last_reload":     time.Now().UTC(),
	}, nil
}

func (s *Server) reloadOPA(ctx context.Context) error {
	// TODO: Implement OPA reload
	return nil
}

func (s *Server) listOPAPolicies(ctx context.Context) ([]string, error) {
	// TODO: Implement OPA policy listing
	return []string{}, nil
}

func (s *Server) collectMetrics() map[string]interface{} {
	return map[string]interface{}{
		"policies_total":    0,
		"bundles_deployed":  0,
		"evaluations_total": 0,
		"cache_hits":        0,
		"cache_misses":      0,
	}
}

// Config and request models

type Config struct {
	Port        string `mapstructure:"PORT"`
	LogLevel    string `mapstructure:"LOG_LEVEL"`
	OPAURL      string `mapstructure:"OPA_URL"`
	RedisURL    string `mapstructure:"REDIS_URL"`
	DatabaseURL string `mapstructure:"DATABASE_URL"`
}

type CreatePolicyRequest struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Type        string                 `json:"type"`
	RegoPolicy  string                 `json:"rego_policy"`
	TenantID    string                 `json:"tenant_id"`
	CreatedBy   string                 `json:"created_by"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type UpdatePolicyRequest struct {
	Name        *string                `json:"name,omitempty"`
	Description *string                `json:"description,omitempty"`
	Type        *string                `json:"type,omitempty"`
	RegoPolicy  *string                `json:"rego_policy,omitempty"`
	IsActive    *bool                  `json:"is_active,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	UpdatedBy   string                 `json:"updated_by"`
}

type TestPolicyRequest struct {
	Input map[string]interface{} `json:"input"`
}

type CreateBundleRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	PolicyIDs   []string `json:"policy_ids"`
	TenantID    string   `json:"tenant_id"`
	CreatedBy   string   `json:"created_by"`
}
