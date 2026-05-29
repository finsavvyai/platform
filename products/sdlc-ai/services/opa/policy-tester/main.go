package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"

	"github.com/sdlc-ai/platform/services/opa/internal/storage"
	"github.com/sdlc-ai/platform/services/opa/internal/testing"
)

type Server struct {
	logger       *logrus.Logger
	router       *mux.Router
	policyTester *testing.PolicyTester
	httpServer   *http.Server
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
	// Initialize OPA client
	opaClient := testing.NewOPAClient(config.OPAURL, logger)

	// Initialize storage
	policyStorage := storage.NewPostgresStorage(nil) // Will be initialized with DB

	// Initialize policy tester
	policyTester := testing.NewPolicyTester(opaClient, policyStorage, logger)

	// Initialize router
	router := mux.NewRouter()

	server := &Server{
		logger:       logger,
		router:       router,
		policyTester: policyTester,
	}

	server.setupRoutes()

	return server, nil
}

func (s *Server) Start() error {
	// Start HTTP server
	s.httpServer = &http.Server{
		Addr:         ":8082",
		Handler:      s.router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	s.logger.Info("Starting Policy Tester server on :8082")

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

	// Test execution
	testRouter := s.router.PathPrefix("/api/v1/tests").Subrouter()
	testRouter.HandleFunc("", s.handleCreateTest).Methods("POST")
	testRouter.HandleFunc("", s.handleListTests).Methods("GET")
	testRouter.HandleFunc("/{id}", s.handleGetTest).Methods("GET")
	testRouter.HandleFunc("/{id}/run", s.handleRunTest).Methods("POST")
	testRouter.HandleFunc("/{id}/results", s.handleGetTestResults).Methods("GET")
	testRouter.HandleFunc("/{id}/report", s.handleGenerateTestReport).Methods("GET")

	// Policy testing
	policyTestRouter := s.router.PathPrefix("/api/v1/policies").Subrouter()
	policyTestRouter.HandleFunc("/{id}/test", s.handleTestPolicy).Methods("POST")
	policyTestRouter.HandleFunc("/{id}/validate", s.handleValidatePolicy).Methods("POST")
	policyTestRouter.HandleFunc("/{id}/coverage", s.handleGetPolicyCoverage).Methods("GET")

	// Batch testing
	batchRouter := s.router.PathPrefix("/api/v1/batch").Subrouter()
	batchRouter.HandleFunc("/test", s.handleBatchTest).Methods("POST")
	batchRouter.HandleFunc("/validate", s.handleBatchValidate).Methods("POST")
	batchRouter.HandleFunc("/coverage", s.handleBatchCoverage).Methods("POST")

	// Test suites
	suiteRouter := s.router.PathPrefix("/api/v1/suites").Subrouter()
	suiteRouter.HandleFunc("", s.handleCreateTestSuite).Methods("POST")
	suiteRouter.HandleFunc("", s.handleListTestSuites).Methods("GET")
	suiteRouter.HandleFunc("/{id}", s.handleGetTestSuite).Methods("GET")
	suiteRouter.HandleFunc("/{id}/run", s.handleRunTestSuite).Methods("POST")
	suiteRouter.HandleFunc("/{id}/results", s.handleGetTestSuiteResults).Methods("GET")

	// Test data management
	dataRouter := s.router.PathPrefix("/api/v1/test-data").Subrouter()
	dataRouter.HandleFunc("", s.handleCreateTestData).Methods("POST")
	dataRouter.HandleFunc("", s.handleListTestData).Methods("GET")
	dataRouter.HandleFunc("/{id}", s.handleGetTestData).Methods("GET")
	dataRouter.HandleFunc("/{id}", s.handleUpdateTestData).Methods("PUT")
	dataRouter.HandleFunc("/{id}", s.handleDeleteTestData).Methods("DELETE")

	// Reports and analytics
	reportRouter := s.router.PathPrefix("/api/v1/reports").Subrouter()
	reportRouter.HandleFunc("/coverage", s.handleCoverageReport).Methods("GET")
	reportRouter.HandleFunc("/performance", s.handlePerformanceReport).Methods("GET")
	reportRouter.HandleFunc("/summary", s.handleTestSummaryReport).Methods("GET")
	reportRouter.HandleFunc("/trends", s.handleTestTrendsReport).Methods("GET")

	// Metrics
	s.router.HandleFunc("/metrics", s.handleMetrics).Methods("GET")
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

	// Check OPA connection
	if err := s.policyTester.CheckOPAHealth(r.Context()); err != nil {
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

func (s *Server) handleCreateTest(w http.ResponseWriter, r *http.Request) {
	var req CreateTestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	test, err := s.policyTester.CreateTest(r.Context(), &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create test", err)
		return
	}

	w.WriteHeader(http.StatusCreated)
	respondJSON(w, test)
}

func (s *Server) handleListTests(w http.ResponseWriter, r *http.Request) {
	filter := &testing.TestFilter{
		PolicyID: r.URL.Query().Get("policy_id"),
		Status:   r.URL.Query().Get("status"),
		Type:     r.URL.Query().Get("type"),
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 50
	}
	filter.Limit = limit

	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	filter.Offset = offset

	tests, err := s.policyTester.ListTests(r.Context(), filter)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list tests", err)
		return
	}

	respondJSON(w, map[string]interface{}{
		"tests":  tests,
		"limit":  limit,
		"offset": offset,
	})
}

func (s *Server) handleGetTest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	test, err := s.policyTester.GetTest(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "Test not found", err)
		return
	}

	respondJSON(w, test)
}

func (s *Server) handleRunTest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req RunTestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := s.policyTester.RunTest(r.Context(), id, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to run test", err)
		return
	}

	respondJSON(w, result)
}

func (s *Server) handleGetTestResults(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	results, err := s.policyTester.GetTestResults(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get test results", err)
		return
	}

	respondJSON(w, results)
}

func (s *Server) handleGenerateTestReport(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	report, err := s.policyTester.GenerateTestReport(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to generate test report", err)
		return
	}

	respondJSON(w, report)
}

func (s *Server) handleTestPolicy(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req TestPolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := s.policyTester.TestPolicy(r.Context(), id, req.InputData)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to test policy", err)
		return
	}

	respondJSON(w, result)
}

func (s *Server) handleValidatePolicy(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	result, err := s.policyTester.ValidatePolicy(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to validate policy", err)
		return
	}

	respondJSON(w, result)
}

func (s *Server) handleGetPolicyCoverage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	coverage, err := s.policyTester.GetPolicyCoverage(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get policy coverage", err)
		return
	}

	respondJSON(w, coverage)
}

func (s *Server) handleBatchTest(w http.ResponseWriter, r *http.Request) {
	var req BatchTestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := s.policyTester.BatchTest(r.Context(), &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to run batch test", err)
		return
	}

	respondJSON(w, result)
}

func (s *Server) handleBatchValidate(w http.ResponseWriter, r *http.Request) {
	var req BatchValidateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := s.policyTester.BatchValidate(r.Context(), &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to run batch validation", err)
		return
	}

	respondJSON(w, result)
}

func (s *Server) handleBatchCoverage(w http.ResponseWriter, r *http.Request) {
	var req BatchCoverageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := s.policyTester.BatchCoverage(r.Context(), &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to run batch coverage", err)
		return
	}

	respondJSON(w, result)
}

func (s *Server) handleCreateTestSuite(w http.ResponseWriter, r *http.Request) {
	var req CreateTestSuiteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	suite, err := s.policyTester.CreateTestSuite(r.Context(), &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create test suite", err)
		return
	}

	w.WriteHeader(http.StatusCreated)
	respondJSON(w, suite)
}

func (s *Server) handleListTestSuites(w http.ResponseWriter, r *http.Request) {
	suites, err := s.policyTester.ListTestSuites(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list test suites", err)
		return
	}

	respondJSON(w, map[string]interface{}{
		"suites": suites,
		"total":  len(suites),
	})
}

func (s *Server) handleGetTestSuite(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	suite, err := s.policyTester.GetTestSuite(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "Test suite not found", err)
		return
	}

	respondJSON(w, suite)
}

func (s *Server) handleRunTestSuite(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req RunTestSuiteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := s.policyTester.RunTestSuite(r.Context(), id, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to run test suite", err)
		return
	}

	respondJSON(w, result)
}

func (s *Server) handleGetTestSuiteResults(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	results, err := s.policyTester.GetTestSuiteResults(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get test suite results", err)
		return
	}

	respondJSON(w, results)
}

func (s *Server) handleCreateTestData(w http.ResponseWriter, r *http.Request) {
	var req CreateTestDataRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	testData, err := s.policyTester.CreateTestData(r.Context(), &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create test data", err)
		return
	}

	w.WriteHeader(http.StatusCreated)
	respondJSON(w, testData)
}

func (s *Server) handleListTestData(w http.ResponseWriter, r *http.Request) {
	testData, err := s.policyTester.ListTestData(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list test data", err)
		return
	}

	respondJSON(w, map[string]interface{}{
		"test_data": testData,
		"total":     len(testData),
	})
}

func (s *Server) handleGetTestData(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	testData, err := s.policyTester.GetTestData(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "Test data not found", err)
		return
	}

	respondJSON(w, testData)
}

func (s *Server) handleUpdateTestData(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req UpdateTestDataRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	testData, err := s.policyTester.UpdateTestData(r.Context(), id, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update test data", err)
		return
	}

	respondJSON(w, testData)
}

func (s *Server) handleDeleteTestData(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	if err := s.policyTester.DeleteTestData(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete test data", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleCoverageReport(w http.ResponseWriter, r *http.Request) {
	report, err := s.policyTester.GenerateCoverageReport(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to generate coverage report", err)
		return
	}

	respondJSON(w, report)
}

func (s *Server) handlePerformanceReport(w http.ResponseWriter, r *http.Request) {
	report, err := s.policyTester.GeneratePerformanceReport(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to generate performance report", err)
		return
	}

	respondJSON(w, report)
}

func (s *Server) handleTestSummaryReport(w http.ResponseWriter, r *http.Request) {
	report, err := s.policyTester.GenerateTestSummaryReport(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to generate test summary report", err)
		return
	}

	respondJSON(w, report)
}

func (s *Server) handleTestTrendsReport(w http.ResponseWriter, r *http.Request) {
	report, err := s.policyTester.GenerateTestTrendsReport(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to generate test trends report", err)
		return
	}

	respondJSON(w, report)
}

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	metrics := s.policyTester.GetMetrics()
	respondJSON(w, metrics)
}

// Helper functions

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
	viper.SetDefault("PORT", "8082")
	viper.SetDefault("LOG_LEVEL", "info")
	viper.SetDefault("OPA_URL", "http://opa:8181")
	viper.SetDefault("DATABASE_URL", "postgres://sdlc:password@postgres:5432/sdlc")

	viper.AutomaticEnv()

	return Config{
		Port:        viper.GetString("PORT"),
		LogLevel:    viper.GetString("LOG_LEVEL"),
		OPAURL:      viper.GetString("OPA_URL"),
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

	s.logger.Info("Server shutdown complete")
	return nil
}

// Config and request models

type Config struct {
	Port        string `mapstructure:"PORT"`
	LogLevel    string `mapstructure:"LOG_LEVEL"`
	OPAURL      string `mapstructure:"OPA_URL"`
	DatabaseURL string `mapstructure:"DATABASE_URL"`
}

type CreateTestRequest struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	PolicyID    string                 `json:"policy_id"`
	Type        string                 `json:"type"`
	InputData   map[string]interface{} `json:"input_data"`
	Expected    map[string]interface{} `json:"expected"`
	Tags        []string               `json:"tags"`
	CreatedBy   string                 `json:"created_by"`
}

type RunTestRequest struct {
	Environment string                 `json:"environment"`
	Variables   map[string]interface{} `json:"variables"`
	Timeout     int                    `json:"timeout"`
}

type TestPolicyRequest struct {
	InputData map[string]interface{} `json:"input_data"`
}

type BatchTestRequest struct {
	TestIDs []string               `json:"test_ids"`
	Options map[string]interface{} `json:"options"`
}

type BatchValidateRequest struct {
	PolicyIDs []string               `json:"policy_ids"`
	Options   map[string]interface{} `json:"options"`
}

type BatchCoverageRequest struct {
	PolicyIDs []string               `json:"policy_ids"`
	Options   map[string]interface{} `json:"options"`
}

type CreateTestSuiteRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	TestIDs     []string `json:"test_ids"`
	CreatedBy   string   `json:"created_by"`
}

type RunTestSuiteRequest struct {
	Parallel    bool                   `json:"parallel"`
	MaxWorkers  int                    `json:"max_workers"`
	Environment string                 `json:"environment"`
	Variables   map[string]interface{} `json:"variables"`
}

type CreateTestDataRequest struct {
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Data        map[string]interface{} `json:"data"`
	Schema      map[string]interface{} `json:"schema"`
	Description string                 `json:"description"`
	CreatedBy   string                 `json:"created_by"`
}

type UpdateTestDataRequest struct {
	Name        *string                `json:"name,omitempty"`
	Data        map[string]interface{} `json:"data,omitempty"`
	Schema      map[string]interface{} `json:"schema,omitempty"`
	Description *string                `json:"description,omitempty"`
	UpdatedBy   string                 `json:"updated_by"`
}
