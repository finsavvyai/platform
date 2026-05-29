//go:build legacy_migrated
// +build legacy_migrated

package anomaly

import (
	"encoding/json"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// ModelType represents different types of anomaly detection models
type ModelType string

const (
	ModelTypeStatistical ModelType = "statistical"
	ModelTypeIsolation   ModelType = "isolation_forest"
	ModelTypeLSTM        ModelType = "lstm"
	ModelTypeProphet     ModelType = "prophet"
	ModelTypeEnsemble    ModelType = "ensemble"
)

// AlertSeverity represents the severity of an anomaly alert
type AlertSeverity string

const (
	SeverityLow      AlertSeverity = "low"
	SeverityMedium   AlertSeverity = "medium"
	SeverityHigh     AlertSeverity = "high"
	SeverityCritical AlertSeverity = "critical"
)

// AlertStatus represents the status of an alert
type AlertStatus string

const (
	StatusActive       AlertStatus = "active"
	StatusAcknowledged AlertStatus = "acknowledged"
	StatusResolved     AlertStatus = "resolved"
	StatusSuppressed   AlertStatus = "suppressed"
)

// MetricData represents a single metric data point
type MetricData struct {
	Timestamp time.Time         `json:"timestamp"`
	Value     float64           `json:"value"`
	Labels    map[string]string `json:"labels"`
	Name      string            `json:"name"`
}

// AnomalyResult represents the result of anomaly detection
type AnomalyResult struct {
	Timestamp  time.Time              `json:"timestamp"`
	MetricName string                 `json:"metric_name"`
	Labels     map[string]string      `json:"labels"`
	Value      float64                `json:"value"`
	Expected   float64                `json:"expected"`
	Deviation  float64                `json:"deviation"`
	Confidence float64                `json:"confidence"`
	IsAnomaly  bool                   `json:"is_anomaly"`
	ModelType  ModelType              `json:"model_type"`
	Reason     string                 `json:"reason"`
	Metadata   map[string]interface{} `json:"metadata"`
}

// Alert represents an anomaly alert
type Alert struct {
	ID          string            `json:"id"`
	Timestamp   time.Time         `json:"timestamp"`
	Severity    AlertSeverity     `json:"severity"`
	Status      AlertStatus       `json:"status"`
	Title       string            `json:"title"`
	Description string            `json:"description"`
	MetricName  string            `json:"metric_name"`
	Labels      map[string]string `json:"labels"`
	Value       float64           `json:"value"`
	Expected    float64           `json:"expected"`
	Confidence  float64           `json:"confidence"`
	ModelType   ModelType         `json:"model_type"`
	Source      string            `json:"source"`
	IncidentID  string            `json:"incident_id,omitempty"`
	Escalated   bool              `json:"escalated"`
	Suppressed  bool              `json:"suppressed"`
	Actions     []AlertAction     `json:"actions"`
	Notes       []AlertNote       `json:"notes"`
	CreatedBy   string            `json:"created_by"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// AlertAction represents an action taken on an alert
type AlertAction struct {
	Timestamp time.Time              `json:"timestamp"`
	Type      string                 `json:"type"`
	Actor     string                 `json:"actor"`
	Message   string                 `json:"message"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// AlertNote represents a note added to an alert
type AlertNote struct {
	Timestamp time.Time              `json:"timestamp"`
	Author    string                 `json:"author"`
	Message   string                 `json:"message"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// Incident represents an incident created from alerts
type Incident struct {
	ID          string                 `json:"id"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Severity    AlertSeverity          `json:"severity"`
	Status      string                 `json:"status"`
	Source      string                 `json:"source"`
	Timestamp   time.Time              `json:"timestamp"`
	StartTime   time.Time              `json:"start_time"`
	EndTime     *time.Time             `json:"end_time,omitempty"`
	Duration    time.Duration          `json:"duration"`
	Alerts      []string               `json:"alerts"`
	Impact      string                 `json:"impact"`
	Escalated   bool                   `json:"escalated"`
	Resolved    bool                   `json:"resolved"`
	ResolvedBy  string                 `json:"resolved_by,omitempty"`
	ResolvedAt  *time.Time             `json:"resolved_at,omitempty"`
	Actions     []IncidentAction       `json:"actions"`
	Labels      map[string]string      `json:"labels"`
	Metadata    map[string]interface{} `json:"metadata"`
	CreatedBy   string                 `json:"created_by"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// IncidentAction represents an action taken on an incident
type IncidentAction struct {
	Timestamp time.Time              `json:"timestamp"`
	Type      string                 `json:"type"`
	Actor     string                 `json:"actor"`
	Message   string                 `json:"message"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// Model represents an anomaly detection model
type Model struct {
	ID           string                 `json:"id"`
	Name         string                 `json:"name"`
	Type         ModelType              `json:"type"`
	MetricName   string                 `json:"metric_name"`
	Labels       map[string]string      `json:"labels"`
	Parameters   map[string]interface{} `json:"parameters"`
	IsTrained    bool                   `json:"is_trained"`
	TrainedAt    *time.Time             `json:"trained_at,omitempty"`
	Accuracy     float64                `json:"accuracy"`
	Threshold    float64                `json:"threshold"`
	Version      string                 `json:"version"`
	Status       string                 `json:"status"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
	LastUsed     *time.Time             `json:"last_used,omitempty"`
	TrainingData []MetricData           `json:"-"`
	Predictions  []AnomalyResult        `json:"-"`
}

// ModelTrainingRequest represents a request to train a model
type ModelTrainingRequest struct {
	ModelID      string                 `json:"model_id"`
	MetricName   string                 `json:"metric_name"`
	Labels       map[string]string      `json:"labels"`
	TrainingData []MetricData           `json:"training_data"`
	Parameters   map[string]interface{} `json:"parameters"`
	ForceRetrain bool                   `json:"force_retrain"`
}

// ModelTrainingResult represents the result of model training
type ModelTrainingResult struct {
	ModelID      string             `json:"model_id"`
	Success      bool               `json:"success"`
	Accuracy     float64            `json:"accuracy"`
	Error        string             `json:"error,omitempty"`
	TrainingTime time.Duration      `json:"training_time"`
	SamplesUsed  int                `json:"samples_used"`
	Version      string             `json:"version"`
	Metrics      map[string]float64 `json:"metrics"`
}

// NotificationConfig represents notification configuration
type NotificationConfig struct {
	Enabled    bool                  `json:"enabled"`
	Channels   []NotificationChannel `json:"channels"`
	Templates  map[string]string     `json:"templates"`
	Rules      []NotificationRule    `json:"rules"`
	RateLimits []RateLimit           `json:"rate_limits"`
}

// NotificationChannel represents a notification channel
type NotificationChannel struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"` // slack, email, pagerduty, webhook
	Name     string                 `json:"name"`
	Config   map[string]interface{} `json:"config"`
	Enabled  bool                   `json:"enabled"`
	Settings map[string]interface{} `json:"settings"`
}

// NotificationRule represents a notification rule
type NotificationRule struct {
	ID         string                  `json:"id"`
	Name       string                  `json:"name"`
	Conditions []NotificationCondition `json:"conditions"`
	Channels   []string                `json:"channels"`
	Enabled    bool                    `json:"enabled"`
	Priority   int                     `json:"priority"`
	Settings   map[string]interface{}  `json:"settings"`
}

// NotificationCondition represents a notification condition
type NotificationCondition struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"`
	Value    interface{} `json:"value"`
}

// RateLimit represents rate limiting configuration
type RateLimit struct {
	ID      string        `json:"id"`
	Window  time.Duration `json:"window"`
	Limit   int           `json:"limit"`
	Message string        `json:"message"`
}

// Metrics represents anomaly detection metrics
type Metrics struct {
	// Model metrics
	ModelsTrained prometheus.Counter
	ModelsActive  prometheus.Gauge
	ModelAccuracy prometheus.Histogram

	// Detection metrics
	AnomaliesDetected prometheus.Counter
	DetectionLatency  prometheus.Histogram
	ConfidenceScores  prometheus.Histogram

	// Alert metrics
	AlertsCreated    prometheus.Counter
	AlertsResolved   prometheus.Counter
	AlertEscalations prometheus.Counter
	AlertSuppression prometheus.Counter

	// Incident metrics
	IncidentsCreated  prometheus.Counter
	IncidentDurations prometheus.Histogram

	// Notification metrics
	NotificationsSent  prometheus.Counter
	NotificationErrors prometheus.Counter

	// System metrics
	ProcessingTime prometheus.Histogram
	ErrorCounts    prometheus.Counter
	QueueSizes     prometheus.Gauge
}

// NewMetrics creates new metrics for anomaly detection
func NewMetrics() *Metrics {
	return &Metrics{
		ModelsTrained: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "anomaly_models_trained_total",
			Help: "Total number of models trained",
		}),
		ModelsActive: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "anomaly_models_active",
			Help: "Number of active anomaly detection models",
		}),
		ModelAccuracy: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "anomaly_model_accuracy",
			Help:    "Accuracy of anomaly detection models",
			Buckets: []float64{0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1.0},
		}),
		AnomaliesDetected: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "anomalies_detected_total",
			Help: "Total number of anomalies detected",
		}),
		DetectionLatency: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "anomaly_detection_latency_seconds",
			Help:    "Time taken to detect anomalies",
			Buckets: prometheus.DefBuckets,
		}),
		ConfidenceScores: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "anomaly_confidence_scores",
			Help:    "Confidence scores of anomaly detections",
			Buckets: []float64{0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1.0},
		}),
		AlertsCreated: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "anomaly_alerts_created_total",
			Help: "Total number of anomaly alerts created",
		}),
		AlertsResolved: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "anomaly_alerts_resolved_total",
			Help: "Total number of anomaly alerts resolved",
		}),
		AlertEscalations: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "anomaly_alert_escalations_total",
			Help: "Total number of alert escalations",
		}),
		AlertSuppression: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "anomaly_alert_suppressions_total",
			Help: "Total number of suppressed alerts",
		}),
		IncidentsCreated: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "anomaly_incidents_created_total",
			Help: "Total number of incidents created",
		}),
		IncidentDurations: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "anomaly_incident_duration_seconds",
			Help:    "Duration of incidents",
			Buckets: []float64{60, 300, 900, 1800, 3600, 7200, 14400, 28800},
		}),
		NotificationsSent: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "anomaly_notifications_sent_total",
			Help: "Total number of notifications sent",
		}),
		NotificationErrors: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "anomaly_notification_errors_total",
			Help: "Total number of notification errors",
		}),
		ProcessingTime: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "anomaly_processing_time_seconds",
			Help:    "Time taken to process anomaly detection",
			Buckets: prometheus.DefBuckets,
		}),
		ErrorCounts: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "anomaly_errors_total",
			Help: "Total number of anomaly detection errors",
		}),
		QueueSizes: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "anomaly_queue_size",
			Help: "Size of anomaly detection queue",
		}),
	}
}

// RegisterMetrics registers metrics with Prometheus
func (m *Metrics) RegisterMetrics() error {
	metrics := []prometheus.Collector{
		m.ModelsTrained,
		m.ModelsActive,
		m.ModelAccuracy,
		m.AnomaliesDetected,
		m.DetectionLatency,
		m.ConfidenceScores,
		m.AlertsCreated,
		m.AlertsResolved,
		m.AlertEscalations,
		m.AlertSuppression,
		m.IncidentsCreated,
		m.IncidentDurations,
		m.NotificationsSent,
		m.NotificationErrors,
		m.ProcessingTime,
		m.ErrorCounts,
		m.QueueSizes,
	}

	for _, metric := range metrics {
		if err := prometheus.Register(metric); err != nil {
			if _, ok := err.(prometheus.AlreadyRegisteredError); ok {
				continue // Metric already registered, skip
			}
			return err
		}
	}

	return nil
}

// UnmarshalJSON implements custom JSON unmarshaling for Alert
func (a *Alert) UnmarshalJSON(data []byte) error {
	type Alias Alert
	aux := &struct {
		Timestamp string `json:"timestamp"`
		CreatedAt string `json:"created_at"`
		UpdatedAt string `json:"updated_at"`
		*Alias
	}{
		Alias: (*Alias)(a),
	}

	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	if aux.Timestamp != "" {
		if t, err := time.Parse(time.RFC3339, aux.Timestamp); err == nil {
			a.Timestamp = t
		}
	}
	if aux.CreatedAt != "" {
		if t, err := time.Parse(time.RFC3339, aux.CreatedAt); err == nil {
			a.CreatedAt = t
		}
	}
	if aux.UpdatedAt != "" {
		if t, err := time.Parse(time.RFC3339, aux.UpdatedAt); err == nil {
			a.UpdatedAt = t
		}
	}

	return nil
}

// MarshalJSON implements custom JSON marshaling for Alert
func (a *Alert) MarshalJSON() ([]byte, error) {
	type Alias Alert
	return json.Marshal(&struct {
		Timestamp string `json:"timestamp"`
		CreatedAt string `json:"created_at"`
		UpdatedAt string `json:"updated_at"`
		*Alias
	}{
		Timestamp: a.Timestamp.Format(time.RFC3339),
		CreatedAt: a.CreatedAt.Format(time.RFC3339),
		UpdatedAt: a.UpdatedAt.Format(time.RFC3339),
		Alias:     (*Alias)(a),
	})
}