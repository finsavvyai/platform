package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"quantumbeam/internal/backup/integration"
	"github.com/sirupsen/logrus"
)

// BackupServer provides HTTP API for backup management
type BackupServer struct {
	client *integration.BackupIntegrationClient
	logger *logrus.Logger
	server *http.Server
}

// BackupAPIRequest represents a backup API request
type BackupAPIRequest struct {
	ApplicationID string                 `json:"application_id"`
	BackupType    string                 `json:"backup_type"`
	Data          map[string]interface{} `json:"data"`
	Metadata      map[string]string      `json:"metadata"`
	Priority      string                 `json:"priority,omitempty"`
	RetentionDays int                    `json:"retention_days,omitempty"`
}

// BackupAPIResponse represents a backup API response
type BackupAPIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}

// RestoreAPIRequest represents a restore API request
type RestoreAPIRequest struct {
	BackupID      string `json:"backup_id"`
	RestoreKey    string `json:"restore_key"`
	TargetPath    string `json:"target_path,omitempty"`
	ApplicationID string `json:"application_id"`
}

// NewBackupServer creates a new backup API server
func NewBackupServer(client *integration.BackupIntegrationClient, port int, logger *logrus.Logger) *BackupServer {
	if logger == nil {
		logger = logrus.New()
	}

	router := mux.NewRouter()
	server := &BackupServer{
		client: client,
		logger: logger,
		server: &http.Server{
			Addr:         fmt.Sprintf(":%d", port),
			Handler:      router,
			ReadTimeout:  30 * time.Second,
			WriteTimeout: 30 * time.Second,
			IdleTimeout:  60 * time.Second,
		},
	}

	server.setupRoutes(router)
	return server
}

// setupRoutes configures the API routes
func (s *BackupServer) setupRoutes(router *mux.Router) {
	// Backup management routes
	router.HandleFunc("/api/v1/backups", s.createBackupHandler).Methods("POST")
	router.HandleFunc("/api/v1/backups", s.listBackupsHandler).Methods("GET")
	router.HandleFunc("/api/v1/backups/{backupId}", s.getBackupHandler).Methods("GET")
	router.HandleFunc("/api/v1/backups/{backupId}", s.deleteBackupHandler).Methods("DELETE")

	// Restore management routes
	router.HandleFunc("/api/v1/restores", s.createRestoreHandler).Methods("POST")
	router.HandleFunc("/api/v1/restores/{restoreId}", s.getRestoreHandler).Methods("GET")
	router.HandleFunc("/api/v1/restores", s.listRestoresHandler).Methods("GET")

	// Status and monitoring routes
	router.HandleFunc("/api/v1/backups/storage-stats", s.getStorageStatsHandler).Methods("GET")
	router.HandleFunc("/api/v1/backups/application/{appId}/status", s.getApplicationBackupStatusHandler).Methods("GET")
	router.HandleFunc("/api/v1/backups/health", s.healthCheckHandler).Methods("GET")

	// Metrics route
	router.Handle("/metrics", promhttp.Handler()).Methods("GET")

	// Health check routes
	router.HandleFunc("/health", s.basicHealthCheckHandler).Methods("GET")
	router.HandleFunc("/ready", s.readinessCheckHandler).Methods("GET")

	// Middleware for logging and metrics
	router.Use(s.loggingMiddleware)
	router.Use(s.metricsMiddleware)
}

// Start starts the backup API server
func (s *BackupServer) Start() error {
	s.logger.Info("Starting backup API server")
	return s.server.ListenAndServe()
}

// Stop stops the backup API server
func (s *BackupServer) Stop(ctx context.Context) error {
	s.logger.Info("Stopping backup API server")
	return s.server.Shutdown(ctx)
}

// HTTP Handlers

func (s *BackupServer) createBackupHandler(w http.ResponseWriter, r *http.Request) {
	var req BackupAPIRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.sendErrorResponse(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// Validate required fields
	if req.ApplicationID == "" || req.BackupType == "" {
		s.sendErrorResponse(w, http.StatusBadRequest, "application_id and backup_type are required")
		return
	}

	// Create backup request
	backupReq := integration.BackupRequest{
		ApplicationID: req.ApplicationID,
		BackupType:    req.BackupType,
		Data:          req.Data,
		Metadata:      req.Metadata,
		Priority:      req.Priority,
		RetentionDays: req.RetentionDays,
	}

	// Create backup
	resp, err := s.client.CreateBackup(r.Context(), backupReq)
	if err != nil {
		s.sendErrorResponse(w, http.StatusInternalServerError, "Failed to create backup: "+err.Error())
		return
	}

	s.sendSuccessResponse(w, http.StatusAccepted, resp, "Backup request submitted successfully")
}

func (s *BackupServer) getBackupHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	backupID := vars["backupId"]

	if backupID == "" {
		s.sendErrorResponse(w, http.StatusBadRequest, "backup_id is required")
		return
	}

	resp, err := s.client.GetBackupStatus(r.Context(), backupID)
	if err != nil {
		s.sendErrorResponse(w, http.StatusNotFound, "Failed to get backup status: "+err.Error())
		return
	}

	s.sendSuccessResponse(w, http.StatusOK, resp, "Backup status retrieved successfully")
}

func (s *BackupServer) listBackupsHandler(w http.ResponseWriter, r *http.Request) {
	appID := r.URL.Query().Get("application_id")
	backupType := r.URL.Query().Get("backup_type")
	limitStr := r.URL.Query().Get("limit")

	limit := 50 // default
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	backups, err := s.client.ListBackups(r.Context(), appID, backupType, limit)
	if err != nil {
		s.sendErrorResponse(w, http.StatusInternalServerError, "Failed to list backups: "+err.Error())
		return
	}

	s.sendSuccessResponse(w, http.StatusOK, map[string]interface{}{
		"backups": backups,
		"total":   len(backups),
	}, "Backups listed successfully")
}

func (s *BackupServer) deleteBackupHandler(w http.ResponseWriter, r *http.Request) {
	// This would implement backup deletion
	// For now, return not implemented
	s.sendErrorResponse(w, http.StatusNotImplemented, "Backup deletion not implemented")
}

func (s *BackupServer) createRestoreHandler(w http.ResponseWriter, r *http.Request) {
	var req RestoreAPIRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.sendErrorResponse(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// Validate required fields
	if req.BackupID == "" || req.RestoreKey == "" || req.ApplicationID == "" {
		s.sendErrorResponse(w, http.StatusBadRequest, "backup_id, restore_key, and application_id are required")
		return
	}

	// Create restore request
	restoreReq := integration.RestoreRequest{
		BackupID:      req.BackupID,
		RestoreKey:    req.RestoreKey,
		TargetPath:    req.TargetPath,
		ApplicationID: req.ApplicationID,
	}

	resp, err := s.client.RestoreBackup(r.Context(), restoreReq)
	if err != nil {
		s.sendErrorResponse(w, http.StatusInternalServerError, "Failed to create restore: "+err.Error())
		return
	}

	s.sendSuccessResponse(w, http.StatusAccepted, resp, "Restore request submitted successfully")
}

func (s *BackupServer) getRestoreHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	restoreID := vars["restoreId"]

	if restoreID == "" {
		s.sendErrorResponse(w, http.StatusBadRequest, "restore_id is required")
		return
	}

	resp, err := s.client.GetRestoreStatus(r.Context(), restoreID)
	if err != nil {
		s.sendErrorResponse(w, http.StatusNotFound, "Failed to get restore status: "+err.Error())
		return
	}

	s.sendSuccessResponse(w, http.StatusOK, resp, "Restore status retrieved successfully")
}

func (s *BackupServer) listRestoresHandler(w http.ResponseWriter, r *http.Request) {
	// This would implement restore listing
	// For now, return empty list
	s.sendSuccessResponse(w, http.StatusOK, map[string]interface{}{
		"restores": []interface{}{},
		"total":    0,
	}, "Restores listed successfully")
}

func (s *BackupServer) getStorageStatsHandler(w http.ResponseWriter, r *http.Request) {
	appID := r.URL.Query().Get("application_id")

	err := s.client.UpdateStorageMetrics(r.Context(), appID)
	if err != nil {
		s.sendErrorResponse(w, http.StatusInternalServerError, "Failed to get storage stats: "+err.Error())
		return
	}

	// Return success (actual metrics are exposed via Prometheus)
	s.sendSuccessResponse(w, http.StatusOK, map[string]interface{}{
		"message":           "Storage metrics updated successfully",
		"metrics_available": true,
	}, "Storage stats retrieved successfully")
}

func (s *BackupServer) getApplicationBackupStatusHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	appID := vars["appId"]

	if appID == "" {
		s.sendErrorResponse(w, http.StatusBadRequest, "application_id is required")
		return
	}

	// Get recent backups for the application
	backups, err := s.client.ListBackups(r.Context(), appID, "", 10)
	if err != nil {
		s.sendErrorResponse(w, http.StatusInternalServerError, "Failed to get application backup status: "+err.Error())
		return
	}

	// Analyze backup status
	var successfulBackups, failedBackups, inProgressBackups int
	var lastSuccessfulBackup *integration.BackupResponse
	var lastBackupTime time.Time

	for _, backup := range backups {
		switch backup.Status {
		case "completed":
			successfulBackups++
			if lastSuccessfulBackup == nil || backup.CreatedAt.After(lastBackupTime) {
				lastSuccessfulBackup = &backup
				lastBackupTime = backup.CreatedAt
			}
		case "failed":
			failedBackups++
		case "in_progress":
			inProgressBackups++
		}
	}

	status := map[string]interface{}{
		"application_id":         appID,
		"total_backups":          len(backups),
		"successful_backups":     successfulBackups,
		"failed_backups":         failedBackups,
		"in_progress_backups":    inProgressBackups,
		"success_rate":           float64(successfulBackups) / float64(len(backups)) * 100,
		"last_successful_backup": lastSuccessfulBackup,
		"last_backup_time":       lastBackupTime,
		"health_status":          s.calculateHealthStatus(successfulBackups, failedBackups, lastBackupTime),
	}

	s.sendSuccessResponse(w, http.StatusOK, status, "Application backup status retrieved successfully")
}

func (s *BackupServer) healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	// Perform comprehensive health check
	health := map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().Format(time.RFC3339),
		"checks": map[string]interface{}{
			"backup_service": s.checkBackupService(r.Context()),
			"storage":        s.checkStorage(r.Context()),
			"metrics":        s.checkMetrics(),
		},
	}

	s.sendSuccessResponse(w, http.StatusOK, health, "Health check completed")
}

func (s *BackupServer) basicHealthCheckHandler(w http.ResponseWriter, r *http.Request) {
	s.sendSuccessResponse(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"timestamp": time.Now().Format(time.RFC3339),
		"service":   "backup-api",
	}, "Basic health check passed")
}

func (s *BackupServer) readinessCheckHandler(w http.ResponseWriter, r *http.Request) {
	// Check if the service is ready to accept requests
	ready := s.checkReadiness(r.Context())

	status := map[string]interface{}{
		"ready":     ready,
		"timestamp": time.Now().Format(time.RFC3339),
		"service":   "backup-api",
	}

	if ready {
		s.sendSuccessResponse(w, http.StatusOK, status, "Service is ready")
	} else {
		s.sendErrorResponse(w, http.StatusServiceUnavailable, "Service is not ready")
	}
}

// Helper functions

func (s *BackupServer) sendSuccessResponse(w http.ResponseWriter, statusCode int, data interface{}, message string) {
	response := BackupAPIResponse{
		Success: true,
		Data:    data,
		Message: message,
	}
	s.sendJSONResponse(w, statusCode, response)
}

func (s *BackupServer) sendErrorResponse(w http.ResponseWriter, statusCode int, error string) {
	response := BackupAPIResponse{
		Success: false,
		Error:   error,
	}
	s.sendJSONResponse(w, statusCode, response)
}

func (s *BackupServer) sendJSONResponse(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

func (s *BackupServer) calculateHealthStatus(successful, failed int, lastBackup time.Time) string {
	if failed > successful {
		return "unhealthy"
	}
	if failed > 0 {
		return "degraded"
	}
	if time.Since(lastBackup) > 48*time.Hour {
		return "stale"
	}
	return "healthy"
}

func (s *BackupServer) checkBackupService(ctx context.Context) map[string]interface{} {
	// Perform a test backup request
	testReq := integration.BackupRequest{
		ApplicationID: "health-check",
		BackupType:    "test",
		Data:          map[string]interface{}{"test": true},
		Metadata:      map[string]string{"purpose": "health_check"},
		Priority:      "low",
	}

	_, err := s.client.CreateBackup(ctx, testReq)

	return map[string]interface{}{
		"status": err == nil,
		"error":  s.safeError(err),
	}
}

func (s *BackupServer) checkStorage(ctx context.Context) map[string]interface{} {
	err := s.client.UpdateStorageMetrics(ctx, "")
	return map[string]interface{}{
		"status": err == nil,
		"error":  s.safeError(err),
	}
}

func (s *BackupServer) checkMetrics() map[string]interface{} {
	// Check if Prometheus metrics are available
	metricFamilies, err := prometheus.DefaultGatherer.Gather()
	return map[string]interface{}{
		"status":        err == nil,
		"metrics_count": len(metricFamilies),
		"error":         s.safeError(err),
	}
}

func (s *BackupServer) checkReadiness(ctx context.Context) bool {
	// Check if the backup service is accessible and responding
	testReq := integration.BackupRequest{
		ApplicationID: "readiness-check",
		BackupType:    "test",
		Data:          map[string]interface{}{"test": true},
		Metadata:      map[string]string{"purpose": "readiness_check"},
		Priority:      "low",
	}

	_, err := s.client.CreateBackup(ctx, testReq)
	return err == nil
}

func (s *BackupServer) safeError(err error) string {
	if err != nil {
		return err.Error()
	}
	return ""
}

// Middleware

func (s *BackupServer) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Create response writer wrapper to capture status code
		wrapped := &responseWriter{ResponseWriter: w, statusCode: 200}

		next.ServeHTTP(wrapped, r)

		duration := time.Since(start)
		s.logger.WithFields(logrus.Fields{
			"method":      r.Method,
			"path":        r.URL.Path,
			"status":      wrapped.statusCode,
			"duration_ms": duration.Milliseconds(),
			"remote_addr": r.RemoteAddr,
			"user_agent":  r.UserAgent(),
		}).Info("API request completed")
	})
}

func (s *BackupServer) metricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Prometheus metrics would be tracked here
		next.ServeHTTP(w, r)
	})
}

// responseWriter is a wrapper to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}
