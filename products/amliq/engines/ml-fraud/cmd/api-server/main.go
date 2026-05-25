package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"quantumbeam/internal/audit"
	"quantumbeam/internal/fraud"
	secmw "quantumbeam/internal/middleware"
	"quantumbeam/internal/models"
	"quantumbeam/internal/rules"
)

func main() {
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialise auth dependencies (JWT, RBAC, brute-force)
	deps := initAuth()

	router := gin.New()

	// Global middleware
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(secmw.SecurityHeadersGin())
	router.Use(fraud.RequestIDMiddleware())
	router.Use(fraud.CORSMiddlewareWithOrigins(
		parseAllowedOrigins(os.Getenv("CORS_ALLOWED_ORIGINS")),
	))
	router.Use(fraud.RateLimitMiddleware(
		getEnvInt("RATE_LIMIT_RPM", 120),
	))

	// --- Public endpoints (no auth) ---
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().Unix(),
			"service":   "quantumbeam-api",
			"version":   "1.0.0",
		})
	})

	// --- Auth endpoints with brute-force protection ---
	authGroup := router.Group("/api/v1/auth")
	authGroup.Use(deps.authMiddleware.BruteForceProtection())
	authGroup.POST("/login", placeholderLogin)
	authGroup.POST("/refresh", placeholderRefresh)

	// --- Services ---
	quantumBackend := fraud.NewQuantumBackendService()
	intelligentRouter := fraud.NewRouter(quantumBackend)
	fraudService := fraud.NewService(quantumBackend, intelligentRouter)

	// --- Authenticated routes ---
	v1 := router.Group("/v1")
	v1.GET("/status", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message":            "QuantumBeam API v1",
			"quantum_backends":   "ready",
			"classical_fallback": "ready",
			"fraud_detection":    "active",
		})
	})

	// Fraud routes: require JWT + at least viewer role
	fraudGroup := v1.Group("")
	fraudGroup.Use(deps.authMiddleware.JWTAuth())
	fraudGroup.Use(deps.authMiddleware.RequireRole(models.UserRoleViewer))
	fraud.RegisterRoutes(fraudGroup, fraudService, intelligentRouter)

	// Admin routes (placeholder): require admin role
	adminGroup := v1.Group("/admin")
	adminGroup.Use(deps.authMiddleware.JWTAuth())
	adminGroup.Use(deps.authMiddleware.RequireRole(models.UserRoleAdmin))
	adminGroup.GET("/users", placeholderAdminHandler)

	// --- Rule Engine (enterprise-only) ---
	ruleRepo := rules.NewMemoryStore()
	ruleEngine := rules.NewEngine(ruleRepo)
	ruleHandler := rules.NewHandler(ruleRepo, ruleEngine)

	rulesGroup := router.Group("/api/v1/rules")
	rulesGroup.Use(deps.authMiddleware.JWTAuth())
	rulesGroup.Use(deps.authMiddleware.RequireRole(models.UserRoleEnterprise))
	rules.RegisterRoutes(rulesGroup, ruleHandler)

	// --- Audit Log Viewer (compliance) ---
	auditRepo := audit.NewMemoryStore()
	auditHandler := audit.NewHandler(auditRepo)

	auditGroup := router.Group("/api/v1/audit")
	auditGroup.Use(deps.authMiddleware.JWTAuth())
	audit.RegisterRoutes(auditGroup, auditHandler)

	// Enterprise routes (placeholder): require enterprise role
	quantumGroup := v1.Group("/quantum")
	quantumGroup.Use(deps.authMiddleware.JWTAuth())
	quantumGroup.Use(deps.authMiddleware.RequireRole(models.UserRoleEnterprise))
	quantumGroup.GET("/settings", placeholderQuantumHandler)

	// --- Start server ---
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{Addr: ":" + port, Handler: router}

	go func() {
		log.Printf("Starting QuantumBeam API server on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}
	log.Println("Server exited")
}

func placeholderLogin(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "login endpoint placeholder"})
}

func placeholderRefresh(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "refresh endpoint placeholder"})
}

func placeholderAdminHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "admin endpoint"})
}

func placeholderQuantumHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "quantum settings"})
}

func parseAllowedOrigins(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		origin := strings.TrimSpace(part)
		if origin != "" {
			origins = append(origins, origin)
		}
	}
	return origins
}

func getEnvInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}
