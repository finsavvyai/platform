package health

import (
	"context"
	"net/http"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// HealthHandler provides health check endpoints for the API service
type HealthHandler struct {
	db          *gorm.DB
	redis       *redis.Client
	serviceName string
	version     string
	startTime   time.Time
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(db *gorm.DB, redis *redis.Client, serviceName, version string) *HealthHandler {
	return &HealthHandler{
		db:          db,
		redis:       redis,
		serviceName: serviceName,
		version:     version,
		startTime:   time.Now(),
	}
}

// HealthResponse represents the liveness check response
type HealthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
	Version string `json:"version"`
	Uptime  string `json:"uptime"`
}

// ReadyResponse represents the readiness check response
type ReadyResponse struct {
	Status       string                 `json:"status"`
	Service      string                 `json:"service"`
	Version      string                 `json:"version"`
	Dependencies map[string]DepStatus   `json:"dependencies"`
	Timestamp    string                 `json:"timestamp"`
}

// DepStatus represents a dependency's health status
type DepStatus struct {
	Status   string `json:"status"`
	Latency  string `json:"latency,omitempty"`
	Message  string `json:"message,omitempty"`
}

// StartupResponse represents the startup check response
type StartupResponse struct {
	Status    string `json:"status"`
	Service   string `json:"service"`
	Version   string `json:"version"`
	Runtime   RuntimeInfo `json:"runtime"`
	Timestamp string `json:"timestamp"`
}

// RuntimeInfo provides Go runtime information
type RuntimeInfo struct {
	GoVersion    string `json:"go_version"`
	NumCPU       int    `json:"num_cpu"`
	NumGoroutine int    `json:"num_goroutine"`
	MemAllocMB   uint64 `json:"mem_alloc_mb"`
}

// Health is the liveness check - returns 200 if the app is running
// GET /health
func (h *HealthHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, HealthResponse{
		Status:  "ok",
		Service: h.serviceName,
		Version: h.version,
		Uptime:  time.Since(h.startTime).Round(time.Second).String(),
	})
}

// Ready is the readiness check - returns 200 only if all dependencies are healthy
// GET /health/ready
func (h *HealthHandler) Ready(c *gin.Context) {
	deps := make(map[string]DepStatus)
	allHealthy := true

	// Check PostgreSQL
	deps["postgres"] = h.checkPostgres()
	if deps["postgres"].Status != "healthy" {
		allHealthy = false
	}

	// Check Redis
	deps["redis"] = h.checkRedis()
	if deps["redis"].Status != "healthy" && deps["redis"].Status != "not_configured" {
		allHealthy = false
	}

	status := http.StatusOK
	statusText := "ready"
	if !allHealthy {
		status = http.StatusServiceUnavailable
		statusText = "not_ready"
	}

	c.JSON(status, ReadyResponse{
		Status:       statusText,
		Service:      h.serviceName,
		Version:      h.version,
		Dependencies: deps,
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
	})
}

// Startup is the startup probe - returns 200 if the app has finished initialization
// GET /health/startup
func (h *HealthHandler) Startup(c *gin.Context) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	c.JSON(http.StatusOK, StartupResponse{
		Status:  "started",
		Service: h.serviceName,
		Version: h.version,
		Runtime: RuntimeInfo{
			GoVersion:    runtime.Version(),
			NumCPU:       runtime.NumCPU(),
			NumGoroutine: runtime.NumGoroutine(),
			MemAllocMB:   m.Alloc / 1024 / 1024,
		},
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

// checkPostgres checks PostgreSQL connectivity
func (h *HealthHandler) checkPostgres() DepStatus {
	if h.db == nil {
		return DepStatus{
			Status:  "error",
			Message: "database not configured",
		}
	}

	start := time.Now()
	sqlDB, err := h.db.DB()
	if err != nil {
		return DepStatus{
			Status:  "error",
			Message: err.Error(),
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := sqlDB.PingContext(ctx); err != nil {
		return DepStatus{
			Status:  "error",
			Latency: time.Since(start).String(),
			Message: err.Error(),
		}
	}

	return DepStatus{
		Status:  "healthy",
		Latency: time.Since(start).String(),
	}
}

// checkRedis checks Redis connectivity
func (h *HealthHandler) checkRedis() DepStatus {
	if h.redis == nil {
		return DepStatus{
			Status:  "not_configured",
			Message: "redis client not initialized",
		}
	}

	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := h.redis.Ping(ctx).Err(); err != nil {
		return DepStatus{
			Status:  "error",
			Latency: time.Since(start).String(),
			Message: err.Error(),
		}
	}

	return DepStatus{
		Status:  "healthy",
		Latency: time.Since(start).String(),
	}
}

// RegisterRoutes registers health check routes on the router
func (h *HealthHandler) RegisterRoutes(router *gin.Engine) {
	router.GET("/health", h.Health)
	router.GET("/health/ready", h.Ready)
	router.GET("/health/startup", h.Startup)
}
