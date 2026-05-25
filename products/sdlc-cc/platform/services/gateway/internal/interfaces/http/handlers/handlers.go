package handlers

import (
	"net/http"
	"runtime"
	"time"

	"github.com/go-chi/render"
	"go.opentelemetry.io/otel"

	appmw "github.com/sdlc-ai/platform/services/gateway/internal/app/middleware"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/repositories"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/services"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database"
	dv "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/domain_verification"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/storage"
	"github.com/sdlc-ai/platform/services/gateway/internal/policy"
)

// Dependencies holds all the dependencies for handlers
type Dependencies struct {
	Config           *config.Config
	DB               *database.Connection
	PolicyEngine     *policy.PolicyEngine
	Repos            *repositories.RepositoryRegistry
	AuthService      *services.AuthenticationService
	JWTService       services.JWTService
	StorageProvider  storage.StorageProvider
	BlacklistService services.BlacklistService
	// RBAC is optional. When non-nil, route registrations may wrap
	// mutating handlers with RequirePermission so they 403 callers
	// who lack the permission. When nil, gating degrades to a
	// passthrough so dev environments still serve every route.
	RBAC *appmw.RBAC
	// PolicyRepo + SyntaxValidator back the /policies CRUD handlers.
	// Both nil-tolerant: missing repo -> 503 NOT_CONFIGURED; missing
	// validator -> validation skipped (dev convenience).
	PolicyRepo      *storage.PolicyRepository
	SyntaxValidator *policy.SyntaxValidator
	// DomainStore backs the /api/v1/domains CRUD handlers. nil falls
	// back to the in-process MemStore so dev/no-DB still works; prod
	// passes a *dv.PgxStore so records survive restarts and SSO
	// auto-redirect can serve real traffic.
	DomainStore dv.Store
	// Audit writes one row for every admin mutation. Nil-tolerant:
	// when missing the mutation still succeeds and the gap is logged.
	// Policy/domain handlers call Append synchronously and fail the
	// request if it returns an error (fail-closed).
	Audit AuditAppender
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status    string            `json:"status"`
	Timestamp time.Time         `json:"timestamp"`
	Version   string            `json:"version"`
	Checks    map[string]string `json:"checks,omitempty"`
}

// HealthCheck performs a basic health check
func HealthCheck(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "HealthCheck")
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
		if deps.DB != nil {
			if err := deps.DB.Ping(ctx); err != nil {
				checks["database"] = "unhealthy: " + err.Error()
				status = "unhealthy"
			} else {
				checks["database"] = "healthy"
			}
		}

		// Check policy engine
		if deps.PolicyEngine != nil {
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
		_, span := otel.Tracer("gateway").Start(r.Context(), "LivenessCheck")
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
		_, span := otel.Tracer("gateway").Start(r.Context(), "DependenciesHealthCheck")
		defer span.End()

		checks := make(map[string]interface{})
		overallStatus := "healthy"

		// Database checks
		if deps.DB != nil {
			dbChecks := make(map[string]interface{})
			dbChecks["connectivity"] = map[string]interface{}{
				"status": "healthy",
			}
			stats := deps.DB.Stats()
			dbChecks["connection_pool"] = map[string]interface{}{
				"max_connections":     stats.MaxConns(),
				"current_connections": stats.TotalConns(),
				"idle_connections":    stats.IdleConns(),
				"acquire_count":       stats.AcquireCount(),
				"acquire_duration":    stats.AcquireDuration().String(),
			}
			checks["database"] = dbChecks
		}

		// Policy engine checks
		if deps.PolicyEngine != nil {
			policyChecks := make(map[string]interface{})
			policyChecks["status"] = "healthy"
			checks["policy_engine"] = policyChecks
		}

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

// GetVersion returns version information
func GetVersion(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "GetVersion")
		defer span.End()

		render.JSON(w, r, map[string]interface{}{
			"version":    deps.Config.Version,
			"commit":     deps.Config.GitCommit,
			"build":      deps.Config.BuildTime,
			"go_version": runtime.Version(),
		})
	}
}
