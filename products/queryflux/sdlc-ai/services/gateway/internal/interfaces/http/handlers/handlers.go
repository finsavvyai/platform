//go:build ignore

package handlers

import (
	"encoding/json"
	"net/http"
	"runtime"
	"time"

	"github.com/go-chi/render"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database"
	"github.com/sdlc-ai/platform/services/gateway/internal/openclaw"
	"github.com/sdlc-ai/platform/services/gateway/internal/policy"
)

// Dependencies holds all the dependencies for handlers
type Dependencies struct {
	Config       *config.Config
	DB           *database.Connection
	PolicyEngine *policy.PolicyEngine
	OpenClaw     *openclaw.Client
	Memory       *openclaw.MemoryService
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status    string            `json:"status"`
	Timestamp time.Time         `json:"timestamp"`
	Version   string            `json:"version"`
	Checks    map[string]string `json:"checks,omitempty"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
	Code    int    `json:"code"`
}

// HealthCheck performs a basic health check
func HealthCheck(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "HealthCheck")
		defer span.End()

		response := HealthResponse{
			Status:    "healthy",
			Timestamp: time.Now(),
			Version:   deps.Config.Version,
		}

		render.JSON(w, r, response)
	}
}

// ReadinessCheck checks if the service is ready to serve traffic
func ReadinessCheck(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "ReadinessCheck")
		defer span.End()

		checks := make(map[string]string)
		status := "healthy"

		// Check database connectivity
		if err := deps.DB.Ping(ctx); err != nil {
			checks["database"] = "unhealthy: " + err.Error()
			status = "unhealthy"
		} else {
			checks["database"] = "healthy"
		}

		// Check policy engine
		if err := deps.PolicyEngine.HealthCheck(ctx); err != nil {
			checks["policy_engine"] = "unhealthy: " + err.Error()
			status = "unhealthy"
		} else {
			checks["policy_engine"] = "healthy"
		}

		response := HealthResponse{
			Status:    status,
			Timestamp: time.Now(),
			Version:   deps.Config.Version,
			Checks:    checks,
		}

		if status == "unhealthy" {
			w.WriteHeader(http.StatusServiceUnavailable)
		}

		render.JSON(w, r, response)
	}
}

// LivenessCheck checks if the service is alive
func LivenessCheck(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "LivenessCheck")
		defer span.End()

		response := HealthResponse{
			Status:    "alive",
			Timestamp: time.Now(),
			Version:   deps.Config.Version,
		}

		render.JSON(w, r, response)
	}
}

// DependenciesHealthCheck performs detailed health checks of all dependencies
func DependenciesHealthCheck(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "DependenciesHealthCheck")
		defer span.End()

		checks := make(map[string]interface{})
		overallStatus := "healthy"

		// Database checks
		dbChecks := make(map[string]interface{})
		if err := deps.DB.Ping(ctx); err != nil {
			dbChecks["connectivity"] = map[string]interface{}{
				"status": "unhealthy",
				"error":  err.Error(),
			}
			overallStatus = "unhealthy"
		} else {
			dbChecks["connectivity"] = map[string]interface{}{
				"status": "healthy",
			}
		}

		// Check database connection pool stats
		stats := deps.DB.Stats()
		dbChecks["connection_pool"] = map[string]interface{}{
			"max_connections":     stats.MaxConns(),
			"current_connections": stats.TotalConns(),
			"idle_connections":    stats.IdleConns(),
			"acquire_count":       stats.AcquireCount(),
			"acquire_duration":    stats.AcquireDuration().String(),
		}

		checks["database"] = dbChecks

		// Policy engine checks
		policyChecks := make(map[string]interface{})
		if err := deps.PolicyEngine.HealthCheck(ctx); err != nil {
			policyChecks["status"] = "unhealthy"
			policyChecks["error"] = err.Error()
			overallStatus = "unhealthy"
		} else {
			policyChecks["status"] = "healthy"
		}

		// Get policy engine metrics
		metrics := deps.PolicyEngine.GetMetrics()
		policyChecks["metrics"] = metrics

		checks["policy_engine"] = policyChecks

		// System checks
		systemChecks := make(map[string]interface{})
		systemChecks["uptime"] = time.Since(deps.Config.StartTime).String()
		systemChecks["goroutines"] = runtimeStats()
		checks["system"] = systemChecks

		response := map[string]interface{}{
			"status":    overallStatus,
			"timestamp": time.Now(),
			"version":   deps.Config.Version,
			"checks":    checks,
		}

		if overallStatus == "unhealthy" {
			w.WriteHeader(http.StatusServiceUnavailable)
		}

		render.JSON(w, r, response)
	}
}

// runtimeStats returns basic runtime statistics
func runtimeStats() map[string]interface{} {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	return map[string]interface{}{
		"goroutines": runtime.NumGoroutine(),
		"memory": map[string]interface{}{
			"alloc":       m.Alloc,
			"total_alloc": m.TotalAlloc,
			"sys":         m.Sys,
			"num_gc":      m.NumGC,
		},
	}
}

// HandleError handles errors consistently across handlers
func HandleError(w http.ResponseWriter, r *http.Request, err error, statusCode int, message string) {
	logrus.WithError(err).WithField("status", statusCode).Error(message)

	response := ErrorResponse{
		Error:   http.StatusText(statusCode),
		Message: message,
		Code:    statusCode,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(response)
}
