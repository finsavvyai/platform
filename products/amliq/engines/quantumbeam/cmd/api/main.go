package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/contrib/instrumentation/github.com/go-chi/chi/v5/chihttp"

	"quantumbeam.io/internal/monitoring/anomaly"
	"quantumbeam.io/internal/monitoring/dashboards"
	"quantumbeam.io/internal/monitoring/integration"
)

func main() {
	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Setup monitoring
	monitoringConfig := integration.DefaultMonitoringConfig()
	monitoringConfig.TracingServiceName = "quantumbeam-api-server"

	// Customize configuration from environment
	if port := os.Getenv("METRICS_PORT"); port != "" {
		if p, err := parsePort(port); err == nil {
			monitoringConfig.MetricsPort = p
		}
	}

	if endpoint := os.Getenv("JAEGER_ENDPOINT"); endpoint != "" {
		monitoringConfig.TracingEndpoint = endpoint
	}

	if grafanaURL := os.Getenv("GRAFANA_URL"); grafanaURL != "" {
		monitoringConfig.DashboardConfig.GrafanaURL = grafanaURL
	}
	if grafanaKey := os.Getenv("GRAFANA_API_KEY"); grafanaKey != "" {
		monitoringConfig.DashboardConfig.GrafanaAPIKey = grafanaKey
	}

	// Initialize monitoring integration
	monitoring, err := integration.NewMonitoringIntegration(monitoringConfig)
	if err != nil {
		log.Fatalf("Failed to initialize monitoring: %v", err)
	}
	defer monitoring.Shutdown(ctx)

	// Initialize fraud detection middleware
	fdMiddleware := integration.NewFraudDetectionMiddleware(
		monitoringConfig.TracingServiceName,
		monitoring.GetAnomalyDetector(),
	)

	// Setup main router
	router := setupRouter(monitoring, fdMiddleware)

	// Start monitoring server in background
	go func() {
		if err := monitoring.StartMonitoringServer(ctx); err != nil {
			log.Printf("Monitoring server error: %v", err)
		}
	}()

	// Setup main HTTP server
	server := &http.Server{
		Addr:         ":8080",
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server
	go func() {
		log.Printf("Starting QuantumBeam API server on :8080")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

func setupRouter(monitoring *integration.MonitoringIntegration, fdMiddleware *integration.FraudDetectionMiddleware) chi.Router {
	r := chi.NewRouter()

	// Standard middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(middleware.AllowContentType("application/json", "text/plain"))

	// OpenTelemetry middleware
	r.Use(chihttp.Middleware("quantumbeam-api"))

	// Monitoring middleware
	r.Use(monitoring.Middleware())
	r.Use(fdMiddleware.Middleware())

	// CORS middleware
	r.Use(middleware.SetHeader("Access-Control-Allow-Origin", "*"))
	r.Use(middleware.SetHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"))
	r.Use(middleware.SetHeader("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-CSRF-Token, X-Transaction-ID, X-Transaction-Type, X-Amount, X-Currency"))

	// Health and monitoring endpoints
	r.Get("/health", healthHandler)
	r.Get("/ready", readyHandler)
	r.Handle("/metrics", promhttp.Handler())

	// API routes
	r.Route("/api/v1", func(r chi.Router) {
		// Authentication routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/login", loginHandler)
			r.Post("/logout", logoutHandler)
			r.Post("/refresh", refreshHandler)
		})

		// Transaction routes
		r.Route("/transactions", func(r chi.Router) {
			r.Use(authMiddleware)
			r.Get("/", listTransactionsHandler)
			r.Post("/", createTransactionHandler)
			r.Get("/{id}", getTransactionHandler)
			r.Put("/{id}", updateTransactionHandler)
			r.Delete("/{id}", deleteTransactionHandler)
		})

		// Fraud detection routes
		r.Route("/fraud", func(r chi.Router) {
			r.Use(authMiddleware)
			r.Post("/analyze", analyzeTransactionHandler)
			r.Get("/predictions", getPredictionsHandler)
			r.Get("/models", getModelsHandler)
			r.Post("/models/{id}/train", trainModelHandler)
			r.Get("/rules", getRulesHandler)
			r.Post("/rules", createRuleHandler)
		})

		// Quantum algorithms routes
		r.Route("/quantum", func(r chi.Router) {
			r.Use(authMiddleware)
			r.Post("/optimize", optimizeHandler)
			r.Get("/algorithms", getAlgorithmsHandler)
			r.Post("/algorithms/{id}/execute", executeAlgorithmHandler)
		})

		// Analytics routes
		r.Route("/analytics", func(r chi.Router) {
			r.Use(authMiddleware)
			r.Get("/dashboard", dashboardHandler)
			r.Get("/reports", reportsHandler)
			r.Post("/export", exportHandler)
		})

		// Admin routes
		r.Route("/admin", func(r chi.Router) {
			r.Use(authMiddleware, adminMiddleware)
			r.Get("/users", getUsersHandler)
			r.Post("/users", createUserHandler)
			r.Put("/users/{id}", updateUserHandler)
			r.Delete("/users/{id}", deleteUserHandler)
			r.Get("/settings", getSettingsHandler)
			r.Put("/settings", updateSettingsHandler)
		})
	})

	// Monitoring and management routes
	r.Route("/monitoring", func(r chi.Router) {
		r.Get("/status", monitoringStatusHandler)
		r.Get("/anomalies", anomaliesHandler)
		r.Post("/anomalies/train", trainAnomalyModelHandler)
		r.Get("/alerts", alertsHandler)
		r.Post("/alerts/{id}/acknowledge", acknowledgeAlertHandler)
		r.Get("/dashboards", dashboardsHandler)
		r.Post("/dashboards/sync", syncDashboardsHandler)
	})

	// Webhook routes
	r.Route("/webhooks", func(r chi.Router) {
		r.Post("/payment", paymentWebhookHandler)
		r.Post("/fraud-alert", fraudAlertWebhookHandler)
		r.Post("/system", systemWebhookHandler)
	})

	return r
}

// Health check handler
func healthHandler(w http.ResponseWriter, r *http.Request) {
	health := map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
		"service":   "quantumbeam-api",
		"version":   "1.0.0",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	if err := json.NewEncoder(w).Encode(health); err != nil {
		log.Printf("Failed to encode health response: %v", err)
	}
}

// Readiness check handler
func readyHandler(w http.ResponseWriter, r *http.Request) {
	checks := map[string]bool{
		"database":   checkDatabase(),
		"redis":      checkRedis(),
		"monitoring": checkMonitoring(),
		"queue":      checkQueue(),
	}

	allReady := true
	for _, ready := range checks {
		if !ready {
			allReady = false
			break
		}
	}

	status := "ready"
	statusCode := http.StatusOK
	if !allReady {
		status = "not_ready"
		statusCode = http.StatusServiceUnavailable
	}

	readiness := map[string]interface{}{
		"status":    status,
		"timestamp": time.Now().UTC(),
		"checks":    checks,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(readiness); err != nil {
		log.Printf("Failed to encode readiness response: %v", err)
	}
}

// Monitoring status handler
func monitoringStatusHandler(w http.ResponseWriter, r *http.Request) {
	status := map[string]interface{}{
		"monitoring": map[string]interface{}{
			"metrics_enabled":    true,
			"tracing_enabled":    true,
			"anomaly_enabled":    true,
			"dashboards_enabled": true,
		},
		"timestamp": time.Now().UTC(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(status)
}

// Anomalies handler
func anomaliesHandler(w http.ResponseWriter, r *http.Request) {
	// This would integrate with the anomaly detection system
	anomalies := []map[string]interface{}{
		{
			"id":          "anomaly-1",
			"timestamp":   time.Now().Add(-1 * time.Hour),
			"metric_name": "fraud_detection_processing_duration_seconds",
			"value":       15.5,
			"threshold":   10.0,
			"severity":    "high",
			"status":      "active",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(anomalies)
}

// Placeholder handlers for API routes
func loginHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"token": "sample-token"})
}

func logoutHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "logged out"})
}

func refreshHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"token": "new-token"})
}

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simple auth middleware - in production, validate JWT token
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func adminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simple admin middleware - in production, check admin role
		next.ServeHTTP(w, r)
	})
}

func listTransactionsHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode([]map[string]interface{}{})
}

func createTransactionHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"id": "txn-123"})
}

func getTransactionHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": chi.URLParam(r, "id")})
}

func updateTransactionHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": chi.URLParam(r, "id")})
}

func deleteTransactionHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func analyzeTransactionHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"transaction_id": chi.URLParam(r, "id"),
		"fraud_score":    0.85,
		"is_fraud":       true,
		"confidence":     0.92,
	})
}

func getPredictionsHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode([]map[string]interface{}{})
}

func getModelsHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode([]map[string]interface{}{})
}

func trainModelHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{"message": "training started"})
}

func getRulesHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode([]map[string]interface{}{})
}

func createRuleHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"id": "rule-123"})
}

func optimizeHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"result": "optimized"})
}

func getAlgorithmsHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode([]map[string]interface{}{})
}

func executeAlgorithmHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"result": "executed"})
}

func dashboardHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"dashboard": "data"})
}

func reportsHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode([]map[string]interface{}{})
}

func exportHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"file": "export.csv"})
}

func getUsersHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode([]map[string]interface{}{})
}

func createUserHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"id": "user-123"})
}

func updateUserHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": chi.URLParam(r, "id")})
}

func deleteUserHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func getSettingsHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{})
}

func updateSettingsHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{})
}

func trainAnomalyModelHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{"message": "training started"})
}

func alertsHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode([]map[string]interface{}{})
}

func acknowledgeAlertHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "acknowledged"})
}

func dashboardsHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode([]string{"system-health", "fraud-detection-kpi"})
}

func syncDashboardsHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "synced"})
}

func paymentWebhookHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func fraudAlertWebhookHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func systemWebhookHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

// Helper functions for health checks
func checkDatabase() bool {
	// In production, actually check database connectivity
	return true
}

func checkRedis() bool {
	// In production, actually check Redis connectivity
	return true
}

func checkMonitoring() bool {
	// Check if monitoring components are running
	return true
}

func checkQueue() bool {
	// In production, actually check queue connectivity
	return true
}

func parsePort(portStr string) (int, error) {
	var port int
	_, err := fmt.Sscanf(portStr, "%d", &port)
	return port, err
}
