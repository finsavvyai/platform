//go:build legacy_migrated
// +build legacy_migrated

package integration

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"quantumbeam/internal/monitoring/anomaly"
)

// FraudDetectionMetrics holds fraud detection specific metrics
type FraudDetectionMetrics struct {
	TransactionsProcessed prometheus.Counter
	TransactionsAmount    prometheus.Counter
	FraudCasesDetected    prometheus.Counter
	FraudAmountPrevented  prometheus.Counter
	ProcessingTime        prometheus.Histogram
	ModelAccuracy         prometheus.Histogram
	FalsePositives        prometheus.Counter
	TruePositives         prometheus.Counter
	FalseNegatives        prometheus.Counter
	ModelPredictions      prometheus.Counter
	QuantumAlgorithmCalls prometheus.Counter
	QuantumAlgorithmTime  prometheus.Histogram
	DatabaseQueries       prometheus.Counter
	DatabaseQueryTime     prometheus.Histogram
	CacheHits             prometheus.Counter
	CacheMisses           prometheus.Counter
	CustomRulesTriggered  prometheus.Counter
	MLPredictions         prometheus.Counter
}

// NewFraudDetectionMetrics creates new fraud detection metrics
func NewFraudDetectionMetrics() *FraudDetectionMetrics {
	return &FraudDetectionMetrics{
		TransactionsProcessed: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "fraud_detection_transactions_processed_total",
				Help: "Total number of transactions processed",
			},
			[]string{"service", "transaction_type", "status"},
		),
		TransactionsAmount: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "fraud_detection_transaction_amount_total",
				Help: "Total amount of transactions processed",
			},
			[]string{"service", "transaction_type", "currency"},
		),
		FraudCasesDetected: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "fraud_detection_cases_detected_total",
				Help: "Total number of fraud cases detected",
			},
			[]string{"service", "fraud_type", "model"},
		),
		FraudAmountPrevented: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "fraud_detection_amount_prevented_total",
				Help: "Total amount of fraud prevented",
			},
			[]string{"service", "fraud_type", "currency"},
		),
		ProcessingTime: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "fraud_detection_processing_duration_seconds",
				Help:    "Time taken to process fraud detection",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"service", "model", "step"},
		),
		ModelAccuracy: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "fraud_detection_model_accuracy",
				Help:    "Accuracy of fraud detection models",
				Buckets: []float64{0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1.0},
			},
			[]string{"service", "model", "model_version"},
		),
		FalsePositives: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "fraud_detection_false_positives_total",
				Help: "Total number of false positive predictions",
			},
			[]string{"service", "model", "fraud_type"},
		),
		TruePositives: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "fraud_detection_true_positives_total",
				Help: "Total number of true positive predictions",
			},
			[]string{"service", "model", "fraud_type"},
		),
		FalseNegatives: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "fraud_detection_false_negatives_total",
				Help: "Total number of false negative predictions",
			},
			[]string{"service", "model", "fraud_type"},
		),
		ModelPredictions: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "fraud_detection_model_predictions_total",
				Help: "Total number of model predictions",
			},
			[]string{"service", "model", "prediction_type"},
		),
		QuantumAlgorithmCalls: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "quantum_algorithm_calls_total",
				Help: "Total number of quantum algorithm calls",
			},
			[]string{"service", "algorithm", "status"},
		),
		QuantumAlgorithmTime: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "quantum_algorithm_execution_time_seconds",
				Help:    "Time taken to execute quantum algorithms",
				Buckets: []float64{0.001, 0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0},
			},
			[]string{"service", "algorithm"},
		),
		DatabaseQueries: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "fraud_detection_database_queries_total",
				Help: "Total number of database queries",
			},
			[]string{"service", "query_type", "table"},
		),
		DatabaseQueryTime: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "fraud_detection_database_query_duration_seconds",
				Help:    "Time taken to execute database queries",
				Buckets: []float64{0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0},
			},
			[]string{"service", "query_type", "table"},
		),
		CacheHits: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "fraud_detection_cache_hits_total",
				Help: "Total number of cache hits",
			},
			[]string{"service", "cache_type"},
		),
		CacheMisses: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "fraud_detection_cache_misses_total",
				Help: "Total number of cache misses",
			},
			[]string{"service", "cache_type"},
		),
		CustomRulesTriggered: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "fraud_detection_custom_rules_triggered_total",
				Help: "Total number of custom rules triggered",
			},
			[]string{"service", "rule_name", "severity"},
		),
		MLPredictions: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "fraud_detection_ml_predictions_total",
				Help: "Total number of ML predictions",
			},
			[]string{"service", "model", "prediction_result"},
		),
	}
}

// RegisterMetrics registers fraud detection metrics with Prometheus
func (m *FraudDetectionMetrics) RegisterMetrics() error {
	metrics := []prometheus.Collector{
		m.TransactionsProcessed,
		m.TransactionsAmount,
		m.FraudCasesDetected,
		m.FraudAmountPrevented,
		m.ProcessingTime,
		m.ModelAccuracy,
		m.FalsePositives,
		m.TruePositives,
		m.FalseNegatives,
		m.ModelPredictions,
		m.QuantumAlgorithmCalls,
		m.QuantumAlgorithmTime,
		m.DatabaseQueries,
		m.DatabaseQueryTime,
		m.CacheHits,
		m.CacheMisses,
		m.CustomRulesTriggered,
		m.MLPredictions,
	}

	for _, metric := range metrics {
		if err := prometheus.Register(metric); err != nil {
			if _, ok := err.(prometheus.AlreadyRegisteredError); !ok {
				return err
			}
		}
	}

	return nil
}

// FraudDetectionContext holds context for fraud detection operations
type FraudDetectionContext struct {
	TransactionID   string
	TransactionType string
	Amount          float64
	Currency        string
	UserID          string
	AccountID       string
	StartTime       time.Time
	ModelName       string
	ModelVersion    string
	AlgorithmType   string
	Step            string
	ServiceName     string
	Labels          map[string]string
}

// FraudDetectionMiddleware provides middleware for fraud detection monitoring
type FraudDetectionMiddleware struct {
	metrics         *FraudDetectionMetrics
	tracer          trace.Tracer
	anomalyDetector *anomaly.Detector
	serviceName     string
}

// NewFraudDetectionMiddleware creates new fraud detection middleware
func NewFraudDetectionMiddleware(serviceName string, detector *anomaly.Detector) *FraudDetectionMiddleware {
	metrics := NewFraudDetectionMetrics()
	if err := metrics.RegisterMetrics(); err != nil {
		// Log error but don't fail creation
		fmt.Printf("Failed to register fraud detection metrics: %v\n", err)
	}

	return &FraudDetectionMiddleware{
		metrics:         metrics,
		tracer:          otel.Tracer(serviceName + "-fraud-detection"),
		anomalyDetector: detector,
		serviceName:     serviceName,
	}
}

// Middleware returns the middleware function
func (m *FraudDetectionMiddleware) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip monitoring for health and metrics endpoints
			if strings.HasPrefix(r.URL.Path, "/health") ||
				strings.HasPrefix(r.URL.Path, "/metrics") ||
				strings.HasPrefix(r.URL.Path, "/ready") {
				next.ServeHTTP(w, r)
				return
			}

			// Extract fraud detection context from headers or URL params
			fdContext := m.extractContext(r)

			// Start tracing span
			ctx, span := m.tracer.Start(r.Context(), "fraud_detection",
				trace.WithAttributes(
					attribute.String("service", m.serviceName),
					attribute.String("transaction_id", fdContext.TransactionID),
					attribute.String("transaction_type", fdContext.TransactionType),
					attribute.String("model", fdContext.ModelName),
					attribute.String("algorithm", fdContext.AlgorithmType),
					attribute.String("step", fdContext.Step),
				),
			)
			defer span.End()

			// Add fraud detection context to request context
			ctx = context.WithValue(ctx, "fraud_detection_context", fdContext)

			// Wrap response writer
			wrapped := &fraudDetectionResponseWriter{
				ResponseWriter: w,
				context:        fdContext,
				middleware:     m,
				span:           span,
			}

			// Process request
			next.ServeHTTP(wrapped, r.WithContext(ctx))
		})
	}
}

// extractContext extracts fraud detection context from request
func (m *FraudDetectionMiddleware) extractContext(r *http.Request) FraudDetectionContext {
	ctx := FraudDetectionContext{
		ServiceName: m.serviceName,
		StartTime:   time.Now(),
		Labels:      make(map[string]string),
	}

	// Extract from headers
	ctx.TransactionID = r.Header.Get("X-Transaction-ID")
	ctx.TransactionType = r.Header.Get("X-Transaction-Type")
	ctx.UserID = r.Header.Get("X-User-ID")
	ctx.AccountID = r.Header.Get("X-Account-ID")
	ctx.ModelName = r.Header.Get("X-Model-Name")
	ctx.ModelVersion = r.Header.Get("X-Model-Version")
	ctx.AlgorithmType = r.Header.Get("X-Algorithm-Type")
	ctx.Step = r.Header.Get("X-Step")

	// Extract amount and currency from headers
	if amountStr := r.Header.Get("X-Amount"); amountStr != "" {
		if amount, err := strconv.ParseFloat(amountStr, 64); err == nil {
			ctx.Amount = amount
		}
	}
	ctx.Currency = r.Header.Get("X-Currency")

	// Extract from URL parameters if not in headers
	if ctx.TransactionID == "" {
		ctx.TransactionID = r.URL.Query().Get("transaction_id")
	}
	if ctx.TransactionType == "" {
		ctx.TransactionType = r.URL.Query().Get("transaction_type")
	}
	if ctx.UserID == "" {
		ctx.UserID = r.URL.Query().Get("user_id")
	}

	// Set defaults
	if ctx.TransactionType == "" {
		ctx.TransactionType = "unknown"
	}
	if ctx.AlgorithmType == "" {
		ctx.AlgorithmType = "ml"
	}
	if ctx.Step == "" {
		ctx.Step = "processing"
	}
	if ctx.Currency == "" {
		ctx.Currency = "USD"
	}

	return ctx
}

// fraudDetectionResponseWriter wraps ResponseWriter for fraud detection monitoring
type fraudDetectionResponseWriter struct {
	http.ResponseWriter
	context    FraudDetectionContext
	middleware *FraudDetectionMiddleware
	span       trace.Span
}

func (w *fraudDetectionResponseWriter) WriteHeader(statusCode int) {
	// Calculate processing time
	duration := time.Since(w.context.StartTime)

	// Record metrics based on response
	w.recordMetrics(statusCode, duration)

	// Check for anomalies
	w.checkAnomalies(statusCode, duration)

	// Update span
	w.updateSpan(statusCode, duration)

	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *fraudDetectionResponseWriter) recordMetrics(statusCode int, duration time.Duration) {
	m := w.middleware.metrics

	// Record transaction processing
	status := "success"
	if statusCode >= 400 {
		status = "error"
	}

	m.TransactionsProcessed.WithLabelValues(
		w.context.ServiceName,
		w.context.TransactionType,
		status,
	).Inc()

	// Record transaction amount
	if w.context.Amount > 0 {
		m.TransactionsAmount.WithLabelValues(
			w.context.ServiceName,
			w.context.TransactionType,
			w.context.Currency,
		).Add(w.context.Amount)
	}

	// Record processing time
	m.ProcessingTime.WithLabelValues(
		w.context.ServiceName,
		w.context.ModelName,
		w.context.Step,
	).Observe(duration.Seconds())

	// Record fraud detection specific metrics
	if statusCode >= 200 && statusCode < 300 {
		// Check if this is a fraud detection response
		if strings.Contains(w.Header().Get("Content-Type"), "application/json") {
			// This would typically be a fraud detection result
			m.ModelPredictions.WithLabelValues(
				w.context.ServiceName,
				w.context.ModelName,
				"processed",
			).Inc()
		}
	}
}

func (w *fraudDetectionResponseWriter) checkAnomalies(statusCode int, duration time.Duration) {
	if w.middleware.anomalyDetector == nil {
		return
	}

	// Check for processing time anomalies
	if duration > 10*time.Second {
		result := anomaly.AnomalyResult{
			Timestamp:  time.Now(),
			MetricName: "fraud_detection_processing_duration_seconds",
			Labels: map[string]string{
				"service":          w.context.ServiceName,
				"transaction_type": w.context.TransactionType,
				"model":            w.context.ModelName,
				"step":             w.context.Step,
			},
			Value:     duration.Seconds(),
			IsAnomaly: true,
			ModelType: anomaly.ModelTypeStatistical,
			Reason:    "Fraud detection processing time exceeded threshold",
		}

		if err := w.middleware.anomalyDetector.ProcessResult(result); err != nil {
			fmt.Printf("Failed to process anomaly result: %v\n", err)
		}
	}

	// Check for error rate anomalies
	if statusCode >= 500 {
		result := anomaly.AnomalyResult{
			Timestamp:  time.Now(),
			MetricName: "fraud_detection_errors_total",
			Labels: map[string]string{
				"service":          w.context.ServiceName,
				"transaction_type": w.context.TransactionType,
				"model":            w.context.ModelName,
				"status_code":      fmt.Sprintf("%d", statusCode),
			},
			Value:     1,
			IsAnomaly: true,
			ModelType: anomaly.ModelTypeStatistical,
			Reason:    "Fraud detection service error",
		}

		if err := w.middleware.anomalyDetector.ProcessResult(result); err != nil {
			fmt.Printf("Failed to process anomaly result: %v\n", err)
		}
	}
}

func (w *fraudDetectionResponseWriter) updateSpan(statusCode int, duration time.Duration) {
	// Add span attributes
	w.span.SetAttributes(
		attribute.Int("http.status_code", statusCode),
		attribute.Float64("processing_duration_seconds", duration.Seconds()),
		attribute.String("transaction_type", w.context.TransactionType),
		attribute.String("model", w.context.ModelName),
		attribute.String("algorithm", w.context.AlgorithmType),
	)

	// Set span status
	if statusCode >= 400 {
		w.span.SetStatus(codes.Error, fmt.Sprintf("HTTP %d", statusCode))
	} else {
		w.span.SetStatus(codes.Ok, "Success")
	}
}

// Helper functions for recording specific fraud detection events

// RecordFraudDetection records a fraud detection event
func (m *FraudDetectionMetrics) RecordFraudDetection(service, fraudType, model, modelVersion string, amount float64, currency string) {
	m.FraudCasesDetected.WithLabelValues(service, fraudType, model).Inc()

	if amount > 0 {
		m.FraudAmountPrevented.WithLabelValues(service, fraudType, currency).Add(amount)
	}
}

// RecordModelAccuracy records model accuracy
func (m *FraudDetectionMetrics) RecordModelAccuracy(service, model, modelVersion string, accuracy float64) {
	m.ModelAccuracy.WithLabelValues(service, model, modelVersion).Observe(accuracy)
}

// RecordPrediction records a model prediction
func (m *FraudDetectionMetrics) RecordPrediction(service, model, predictionType string) {
	m.ModelPredictions.WithLabelValues(service, model, predictionType).Inc()
}

// RecordQuantumAlgorithmCall records a quantum algorithm call
func (m *FraudDetectionMetrics) RecordQuantumAlgorithmCall(service, algorithm, status string, duration time.Duration) {
	m.QuantumAlgorithmCalls.WithLabelValues(service, algorithm, status).Inc()
	m.QuantumAlgorithmTime.WithLabelValues(service, algorithm).Observe(duration.Seconds())
}

// RecordDatabaseQuery records a database query
func (m *FraudDetectionMetrics) RecordDatabaseQuery(service, queryType, table string, duration time.Duration) {
	m.DatabaseQueries.WithLabelValues(service, queryType, table).Inc()
	m.DatabaseQueryTime.WithLabelValues(service, queryType, table).Observe(duration.Seconds())
}

// RecordCacheOperation records a cache operation
func (m *FraudDetectionMetrics) RecordCacheHit(service, cacheType string) {
	m.CacheHits.WithLabelValues(service, cacheType).Inc()
}

func (m *FraudDetectionMetrics) RecordCacheMiss(service, cacheType string) {
	m.CacheMisses.WithLabelValues(service, cacheType).Inc()
}

// RecordCustomRuleTriggered records a custom rule being triggered
func (m *FraudDetectionMetrics) RecordCustomRuleTriggered(service, ruleName, severity string) {
	m.CustomRulesTriggered.WithLabelValues(service, ruleName, severity).Inc()
}

// RecordConfusionMatrix records confusion matrix values
func (m *FraudDetectionMetrics) RecordConfusionMatrix(service, model, fraudType string, tp, fp, fn int) {
	m.TruePositives.WithLabelValues(service, model, fraudType).Add(float64(tp))
	m.FalsePositives.WithLabelValues(service, model, fraudType).Add(float64(fp))
	m.FalseNegatives.WithLabelValues(service, model, fraudType).Add(float64(fn))
}

// GetContext retrieves fraud detection context from request context
func GetContext(r *http.Request) *FraudDetectionContext {
	if ctx, ok := r.Context().Value("fraud_detection_context").(FraudDetectionContext); ok {
		return &ctx
	}
	return nil
}