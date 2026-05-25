package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"

	quantumbeam "github.com/quantumbeam/monitoring/internal/alerting"
	"github.com/quantumbeam/monitoring/internal/logging"
	"github.com/quantumbeam/monitoring/internal/metrics"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	configFile = flag.String("config", "/etc/monitoring/config.yaml", "Path to configuration file")
	port       = flag.String("port", "8090", "Port to run the monitoring service on")
	metricsPort = flag.String("metrics-port", "8091", "Port to expose metrics")
	logLevel   = flag.String("log-level", "info", "Log level (trace, debug, info, warn, error, fatal, panic)")
)

// Config holds the complete monitoring service configuration
type Config struct {
	Service struct {
		Name        string `yaml:"name"`
		Version     string `yaml:"version"`
		Environment string `yaml:"environment"`
	} `yaml:"service"`

	Logging logging.Config `yaml:"logging"`

	Metrics metrics.Config `yaml:"metrics"`

	Alerting quantumbeam.Config `yaml:"alerting"`

	HealthCheck struct {
		Interval time.Duration `yaml:"interval"`
		Timeout  time.Duration `yaml:"timeout"`
	} `yaml:"health_check"`
}

func main() {
	flag.Parse()

	// Load configuration
	config, err := loadConfig(*configFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load configuration: %v\n", err)
		os.Exit(1)
	}

	// Override log level from command line
	if *logLevel != "" {
		config.Logging.Level = logging.LogLevel(*logLevel)
	}

	// Initialize logger
	logger := logging.NewLogger(&config.Logging)
	logger.Info(nil, "Starting QuantumBeam Monitoring Service", map[string]interface{}{
		"version":     config.Service.Version,
		"environment": config.Service.Environment,
		"port":        *port,
		"metrics_port": *metricsPort,
	})

	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize metrics collector
	metricsCollector := metrics.NewMetricsCollector()

	// Initialize alert manager
	alertManager, err := quantumbeam.NewAlertManager(&config.Alerting)
	if err != nil {
		logger.Fatal(nil, "Failed to create alert manager", err)
	}

	// Load default alert rules
	alertManager.LoadDefaultRules()

	// Initialize HTTP handlers
	setupHTTPHandlers(logger, metricsCollector, alertManager)

	// Start metrics server
	go func() {
		logger.Info(nil, "Starting metrics server", map[string]interface{}{
			"port": *metricsPort,
		})

		if err := metricsCollector.Server(ctx, ":"+*metricsPort); err != nil {
			logger.Error(nil, "Metrics server failed", err)
		}
	}()

	// Start alert evaluation
	go func() {
		logger.Info(nil, "Starting alert evaluation", map[string]interface{}{
			"interval": config.Alerting.EvaluationInterval,
		})

		if err := alertManager.Start(ctx); err != nil {
			logger.Error(nil, "Alert evaluation failed", err)
		}
	}()

	// Start health check monitoring
	go startHealthCheckMonitoring(ctx, logger, metricsCollector, &config.HealthCheck)

	// Start system metrics collection
	go startSystemMetricsCollection(ctx, logger, metricsCollector)

	// Start main HTTP server
	server := &http.Server{
		Addr:    ":" + *port,
		Handler: createMainRouter(),
	}

	go func() {
		logger.Info(nil, "Starting monitoring service", map[string]interface{}{
			"port": *port,
		})

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error(nil, "HTTP server failed", err)
		}
	}()

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	logger.Info(nil, "Monitoring service started successfully", nil)

	// Block until we receive a signal
	<-sigChan
	logger.Info(nil, "Shutting down monitoring service...", nil)

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error(nil, "Failed to shutdown HTTP server", err)
	}

	cancel() // Cancel the main context

	logger.Info(nil, "Monitoring service stopped", nil)
}

// setupHTTPHandlers sets up the HTTP handlers for the monitoring service
func setupHTTPHandlers(logger *logging.Logger, metricsCollector *metrics.MetricsCollector, alertManager *quantumbeam.AlertManager) {
	// Health check endpoint
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"healthy","timestamp":"%s"}`, time.Now().UTC().Format(time.RFC3339))
	})

	// Readiness check endpoint
	http.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		// TODO: Check dependencies (Prometheus, Redis, RabbitMQ)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ready","timestamp":"%s"}`, time.Now().UTC().Format(time.RFC3339))
	})

	// Alert management endpoints
	http.HandleFunc("/api/v1/alerts", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			// TODO: Return active alerts
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintf(w, `{"alerts":[]}`)
		case http.MethodPost:
			// TODO: Create new alert rule
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			fmt.Fprintf(w, `{"status":"created"}`)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/api/v1/alerts/", func(w http.ResponseWriter, r *http.Request) {
		// TODO: Handle individual alert operations
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok"}`)
	})

	// Rules management endpoints
	http.HandleFunc("/api/v1/rules", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			// TODO: Return alert rules
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintf(w, `{"rules":[]}`)
		case http.MethodPost:
			// TODO: Create new alert rule
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			fmt.Fprintf(w, `{"status":"created"}`)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Notification status endpoint
	http.HandleFunc("/api/v1/notifications", func(w http.ResponseWriter, r *http.Request) {
		// TODO: Return notification status
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"notifications":[]}`)
	})

	// System status endpoint
	http.HandleFunc("/api/v1/status", func(w http.ResponseWriter, r *http.Request) {
		status := map[string]interface{}{
			"service":     "monitoring",
			"version":     "1.0.0",
			"uptime":      time.Since(time.Now()).String(), // TODO: Track actual uptime
			"timestamp":   time.Now().UTC().Format(time.RFC3339),
			"environment": "production",
			"components": map[string]interface{}{
				"prometheus": "healthy",
				"redis":      "healthy",
				"rabbitmq":   "healthy",
			},
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(status)
	})

	// Metrics endpoint (handled by Prometheus client)
	http.Handle("/metrics", promhttp.Handler())
}

// createMainRouter creates the main HTTP router with middleware
func createMainRouter() http.Handler {
	mux := http.NewServeMux()

	// Add CORS middleware
	mux = corsMiddleware(mux)

	// Add request logging middleware
	mux = loggingMiddleware(mux)

	// Add metrics middleware
	mux = metricsMiddleware(mux)

	return mux
}

// Middleware functions

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Create a response writer wrapper to capture status code
		wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(wrapped, r)

		duration := time.Since(start)

		// Log the request
		fmt.Printf("[%s] %s %s %d %v\n",
			time.Now().Format(time.RFC3339),
			r.Method,
			r.URL.Path,
			wrapped.statusCode,
			duration)
	})
}

func metricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// TODO: Record HTTP metrics
		next.ServeHTTP(w, r)
	})
}

// responseWriter is a wrapper around http.ResponseWriter that captures the status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Health check monitoring
func startHealthCheckMonitoring(ctx context.Context, logger *logging.Logger, metricsCollector *metrics.MetricsCollector, config *config.HealthCheck) {
	ticker := time.NewTicker(config.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			checkDependencies(ctx, logger, metricsCollector, config.Timeout)
		}
	}
}

func checkDependencies(ctx context.Context, logger *logging.Logger, metricsCollector *metrics.MetricsCollector, timeout time.Duration) {
	// TODO: Implement dependency health checks
	// - Prometheus connectivity
	// - Redis connectivity
	// - RabbitMQ connectivity
	// - External quantum backends
}

// System metrics collection
func startSystemMetricsCollection(ctx context.Context, logger *logging.Logger, metricsCollector *metrics.MetricsCollector) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			collectSystemMetrics(ctx, logger, metricsCollector)
		}
	}
}

func collectSystemMetrics(ctx context.Context, logger *logging.Logger, metricsCollector *metrics.MetricsCollector) {
	// TODO: Implement system metrics collection
	// - CPU usage
	// - Memory usage
	// - Disk usage
	// - Network I/O
	// - Database connections
	// - Redis connections
	// - Message queue sizes
}

// loadConfig loads configuration from file
func loadConfig(filename string) (*Config, error) {
	// TODO: Implement configuration loading
	// For now, return default configuration
	return &Config{
		Service: struct {
			Name        string `yaml:"name"`
			Version     string `yaml:"version"`
			Environment string `yaml:"environment"`
		}{
			Name:        "monitoring-service",
			Version:     "1.0.0",
			Environment: "development",
		},
		Logging: logging.Config{
			Service:     "monitoring-service",
			Version:     "1.0.0",
			Environment: "development",
			Level:       logging.LevelInfo,
			Format:      "json",
			Output:      "stdout",
			MaxSize:     100,
			MaxBackups:  10,
			MaxAge:      30,
			Compress:    true,
			EnableAudit: true,
		},
		Metrics: metrics.Config{
			Service:     "monitoring-service",
			Version:     "1.0.0",
			Environment: "development",
		},
		Alerting: quantumbeam.Config{
			PrometheusURL:      "http://localhost:9090",
			RedisAddr:          "localhost:6379",
			RabbitMQURL:        "amqp://localhost:5672",
			SMTPServer:         "localhost",
			SMTPPort:           587,
			SMTPUsername:       "",
			SMTPPassword:       "",
			SlackWebhookURL:    "",
			DefaultFromEmail:   "alerts@quantumbeam.io",
			MaxRetries:         3,
			RetryDelay:         5 * time.Second,
			EvaluationInterval: 30 * time.Second,
			NotificationTimeout: 30 * time.Second,
		},
		HealthCheck: struct {
			Interval time.Duration `yaml:"interval"`
			Timeout  time.Duration `yaml:"timeout"`
		}{
			Interval: 30 * time.Second,
			Timeout:  10 * time.Second,
		},
	}, nil
}