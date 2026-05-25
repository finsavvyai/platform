package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/cloudflare/cloudflare-go"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
	"github.com/sirupsen/logrus"
)

// Env represents the Cloudflare Workers environment
type Env struct {
	DB_PRIMARY       *cloudflare.D1Database     `cf:"d1_database"`
	DB_SECONDARY     *cloudflare.D1Database     `cf:"d1_database"`
	DB_COMPLIANCE    *cloudflare.D1Database     `cf:"d1_database"`
	R2_STORAGE       *cloudflare.R2Bucket       `cf:"r2_bucket"`
	KV_CACHE         *cloudflare.KVNamespace    `cf:"kv_namespace"`
	QUEUE_BILLING    *cloudflare.Queue          `cf:"queue"`
	QUEUE_RISK       *cloudflare.Queue          `cf:"queue"`
	QUEUE_COMPLIANCE *cloudflare.Queue          `cf:"queue"`
	VECTORIZE_RAG    *cloudflare.VectorizeIndex `cf:"vectorize_index"`
}

// AppConfig represents application configuration
type AppConfig struct {
	Environment string `env:"ENVIRONMENT,default=development"`
	Region      string `env:"REGION,default=us"`
	Port        int    `env:"PORT,default=8080"`
	LogLevel    string `env:"LOG_LEVEL,default=info"`
	CORSOrigins string `env:"CORS_ORIGINS,default=*"`
}

// Application represents the main application structure
type Application struct {
	config     *AppConfig
	env        *Env
	router     *mux.Router
	logger     *logrus.Logger
	services   map[string]interface{}
	middleware []mux.MiddlewareFunc
}

// NewApplication creates a new application instance
func NewApplication(env *Env) (*Application, error) {
	config := &AppConfig{
		Environment: os.Getenv("ENVIRONMENT"),
		Region:      os.Getenv("REGION"),
		Port:        8080,
		LogLevel:    os.Getenv("LOG_LEVEL"),
		CORSOrigins: os.Getenv("CORS_ORIGINS"),
	}

	// Initialize logger
	logger := logrus.New()
	level, err := logrus.ParseLevel(config.LogLevel)
	if err != nil {
		level = logrus.InfoLevel
	}
	logger.SetLevel(level)

	// Set JSON formatter for production
	if config.Environment == "production" {
		logger.SetFormatter(&logrus.JSONFormatter{})
	}

	app := &Application{
		config:   config,
		env:      env,
		router:   mux.NewRouter(),
		logger:   logger,
		services: make(map[string]interface{}),
	}

	// Initialize middleware
	app.initializeMiddleware()

	// Initialize services
	if err := app.initializeServices(); err != nil {
		return nil, fmt.Errorf("failed to initialize services: %w", err)
	}

	// Initialize routes
	app.initializeRoutes()

	return app, nil
}

// initializeMiddleware sets up application middleware
func (app *Application) initializeMiddleware() {
	// CORS middleware
	corsHandler := cors.New(cors.Options{
		AllowedOrigins:   []string{app.config.CORSOrigins},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
		MaxAge:           300,
	})

	app.middleware = []mux.MiddlewareFunc{
		corsHandler.Handler,
		app.loggingMiddleware,
		app.recoveryMiddleware,
		app.requestContextMiddleware,
	}
}

// initializeServices sets up all application services
func (app *Application) initializeServices() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	app.logger.Info("Initializing application services...")

	// Initialize Billing Service
	billingService, err := NewBillingService(ctx, app.env)
	if err != nil {
		return fmt.Errorf("failed to initialize billing service: %w", err)
	}
	app.services["billing"] = billingService

	// Initialize Compliance Service
	complianceService, err := NewComplianceService(ctx, app.env)
	if err != nil {
		return fmt.Errorf("failed to initialize compliance service: %w", err)
	}
	app.services["compliance"] = complianceService

	// Initialize Intelligence Service
	intelligenceService, err := NewIntelligenceService(ctx, app.env)
	if err != nil {
		return fmt.Errorf("failed to initialize intelligence service: %w", err)
	}
	app.services["intelligence"] = intelligenceService

	// Initialize Risk Service
	riskService, err := NewRiskService(ctx, app.env)
	if err != nil {
		return fmt.Errorf("failed to initialize risk service: %w", err)
	}
	app.services["risk"] = riskService

	app.logger.Info("All services initialized successfully")
	return nil
}

// initializeRoutes sets up application routes
func (app *Application) initializeRoutes() {
	// Health check
	app.router.HandleFunc("/health", app.healthCheckHandler).Methods("GET")

	// Version info
	app.router.HandleFunc("/version", app.versionHandler).Methods("GET")

	// API routes with version prefix
	apiRouter := app.router.PathPrefix("/api/v1").Subrouter()

	// Billing routes
	billingRouter := apiRouter.PathPrefix("/billing").Subrouter()
	billingRouter.HandleFunc("/invoices", app.handleWithService("billing", "invoices")).Methods("GET", "POST")
	billingRouter.HandleFunc("/invoices/{id}", app.handleWithService("billing", "invoices")).Methods("GET", "PUT", "DELETE")
	billingRouter.HandleFunc("/customers", app.handleWithService("billing", "customers")).Methods("GET", "POST")
	billingRouter.HandleFunc("/payments", app.handleWithService("billing", "payments")).Methods("GET", "POST")

	// Compliance routes
	complianceRouter := apiRouter.PathPrefix("/compliance").Subrouter()
	complianceRouter.HandleFunc("/kyc", app.handleWithService("compliance", "kyc")).Methods("GET", "POST")
	complianceRouter.HandleFunc("/sanctions", app.handleWithService("compliance", "sanctions")).Methods("GET", "POST")
	complianceRouter.HandleFunc("/cases", app.handleWithService("compliance", "cases")).Methods("GET", "POST")

	// Intelligence routes
	intelligenceRouter := apiRouter.PathPrefix("/intelligence").Subrouter()
	intelligenceRouter.HandleFunc("/transactions", app.handleWithService("intelligence", "transactions")).Methods("GET", "POST")
	intelligenceRouter.HandleFunc("/analytics", app.handleWithService("intelligence", "analytics")).Methods("GET")
	intelligenceRouter.HandleFunc("/forecasts", app.handleWithService("intelligence", "forecasts")).Methods("GET", "POST")

	// Risk routes
	riskRouter := apiRouter.PathPrefix("/risk").Subrouter()
	riskRouter.HandleFunc("/score", app.handleWithService("risk", "score")).Methods("GET", "POST")
	riskRouter.HandleFunc("/alerts", app.handleWithService("risk", "alerts")).Methods("GET")
	riskRouter.HandleFunc("/investigations", app.handleWithService("risk", "investigations")).Methods("GET", "POST")

	// Apply middleware to all routes
	for _, mw := range app.middleware {
		app.router.Use(mw)
	}
}

// handleWithService creates a service handler
func (app *Application) handleWithService(serviceName, endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		service := app.services[serviceName]
		if service == nil {
			app.respondWithError(w, http.StatusNotFound, fmt.Sprintf("service %s not found", serviceName))
			return
		}

		// TODO: Implement service-specific handlers
		app.respondWithJSON(w, http.StatusOK, map[string]string{
			"service":  serviceName,
			"endpoint": endpoint,
			"status":   "not implemented yet",
		})
	}
}

// loggingMiddleware logs HTTP requests
func (app *Application) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Log request
		app.logger.WithFields(logrus.Fields{
			"method": r.Method,
			"uri":    r.RequestURI,
			"remote": r.RemoteAddr,
		}).Info("Incoming request")

		next.ServeHTTP(w, r)

		// Log request duration
		duration := time.Since(start)
		app.logger.WithFields(logrus.Fields{
			"method":   r.Method,
			"uri":      r.RequestURI,
			"duration": duration.String(),
		}).Info("Request completed")
	})
}

// recoveryMiddleware recovers from panics
func (app *Application) recoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				app.logger.WithFields(logrus.Fields{
					"error": err,
					"uri":   r.RequestURI,
				}).Error("Request panic recovered")

				app.respondWithError(w, http.StatusInternalServerError, "Internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// requestContextMiddleware adds request context
func (app *Application) requestContextMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), "startTime", time.Now())
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// healthCheckHandler provides health status
func (app *Application) healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	status := map[string]interface{}{
		"status":      "healthy",
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
		"environment": app.config.Environment,
		"region":      app.config.Region,
		"version":     "1.0.0",
	}

	// Check database connections
	// TODO: Implement database health checks

	app.respondWithJSON(w, http.StatusOK, status)
}

// versionHandler provides version information
func (app *Application) versionHandler(w http.ResponseWriter, r *http.Request) {
	app.respondWithJSON(w, http.StatusOK, map[string]string{
		"version":    "1.0.0",
		"commit":     os.Getenv("COMMIT_SHA"),
		"build_date": os.Getenv("BUILD_DATE"),
		"go_version": "1.21",
	})
}

// respondWithJSON sends a JSON response
func (app *Application) respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		app.logger.WithError(err).Error("Failed to marshal JSON response")
		app.respondWithError(w, http.StatusInternalServerError, "Failed to encode response")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

// respondWithError sends an error response
func (app *Application) respondWithError(w http.ResponseWriter, code int, message string) {
	app.respondWithJSON(w, code, map[string]string{"error": message})
}

// Run starts the application
func (app *Application) Run() error {
	addr := fmt.Sprintf(":%d", app.config.Port)

	app.logger.WithFields(logrus.Fields{
		"address":     addr,
		"environment": app.config.Environment,
	}).Info("Starting Unified FinTech Suite Workers")

	return http.ListenAndServe(addr, app.router)
}

// main entry point for Cloudflare Workers
//
//go:export fetch
func main_fetch() int32 {
	// This function will be called by Cloudflare Workers runtime
	// It should handle the request and return the appropriate response
	return 0
}

func main() {
	env := &Env{} // In production, this would be injected by Cloudflare
	app, err := NewApplication(env)
	if err != nil {
		log.Fatalf("Failed to create application: %v", err)
	}

	if err := app.Run(); err != nil {
		log.Fatalf("Application failed: %v", err)
	}
}
