# QuantumBeam Anomaly Detection System

This directory contains a comprehensive anomaly detection system for monitoring the QuantumBeam production environment. The system uses multiple statistical and machine learning approaches to detect unusual patterns in metrics and alert operators when anomalies are found.

## 🎯 Overview

The anomaly detection system provides:
- **Multiple Detection Algorithms**: Spike detection, drop detection, trend changes, statistical outliers, pattern breaks, and seasonal deviations
- **Machine Learning Models**: Isolation Forest, LSTM neural networks, and Autoencoder models
- **Real-time Alerting**: Configurable alert rules with multiple notification channels
- **Web Interface**: REST API for configuration and monitoring
- **Integration**: Seamless integration with Prometheus metrics and existing monitoring stack

## 📊 Detection Methods

### 1. Spike Detection
Detects sudden increases in metric values:
- Uses statistical analysis with configurable threshold factors
- Compares recent values against historical baselines
- Accounts for standard deviation and trends

### 2. Drop Detection
Identifies sudden decreases in important metrics:
- Monitors for metric drops that might indicate service issues
- Configurable sensitivity levels
- Suitable for monitoring business metrics like fraud detection rates

### 3. Trend Change Detection
Detects changes in metric trends over time:
- Uses linear regression to identify trend changes
- Compares short-term vs long-term slopes
- Helps identify gradual degradation or improvement

### 4. Statistical Outlier Detection
Identifies anomalous values using statistical methods:
- Modified Z-score approach for robustness
- Median Absolute Deviation (MAD) for outlier detection
- Handles non-normal distributions

### 5. Pattern Break Detection
Detects breaks in established patterns:
- Analyzes seasonal patterns and cycles
- Identifies deviations from expected behavior
- Useful for metrics with predictable patterns

### 6. Seasonal Deviation Detection
Detects deviations from seasonal patterns:
- Time series decomposition into trend, seasonal, and residual components
- Focuses on residual analysis for anomaly detection
- Accounts for expected seasonal variations

## 🤖 Machine Learning Models

### Isolation Forest
- Unsupervised learning algorithm for anomaly detection
- Efficient for high-dimensional data
- Uses random forest approach to isolate anomalies

### LSTM Neural Network
- Deep learning model for time series prediction
- Captures temporal dependencies in sequential data
- Suitable for complex patterns and seasonality

### Autoencoder
- Neural network for unsupervised anomaly detection
- Learns to reconstruct normal data patterns
- High reconstruction errors indicate anomalies

## ⚙️ Configuration

### Basic Configuration
```go
config := AnomalyDetectorConfig{
    PrometheusURL:      "http://prometheus:9090",
    EvaluationInterval: 5 * time.Minute,
    LookbackWindow:     24 * time.Hour,
    MinDataPoints:      10,
    ThresholdFactor:    2.0,
    Enabled:            true,
}
```

### Metric Configuration
```go
metric := MetricConfig{
    Name:            "error_rate",
    Query:           "sum(rate(http_requests_total{status_code=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100",
    Type:            TypeSpike,
    Severity:        SeverityCritical,
    ThresholdFactor: 2.0,
    Enabled:         true,
}
```

### Alert Rule Configuration
```go
rule := &AlertRule{
    ID:            "high_error_rate",
    Name:          "High Error Rate Alert",
    MetricPattern: "error_rate",
    AnomalyTypes:  []AnomalyType{TypeSpike},
    MinSeverity:   SeverityHigh,
    MaxFrequency:  15 * time.Minute,
    Channels:      []string{"slack", "email"},
    Enabled:       true,
}
```

## 🚀 Getting Started

### 1. Initialize the Anomaly Detector
```go
detector, err := NewAnomalyDetector(config)
if err != nil {
    log.Fatal(err)
}
```

### 2. Configure Notification Channels
```go
alerter := NewAnomalyAlerter(AlerterConfig{
    Enabled:         true,
    DefaultChannels: []string{"slack", "email"},
})

// Add Slack channel
slackChannel := NewSlackNotificationChannel(
    "slack-alerts",
    "https://hooks.slack.com/services/...",
    "#alerts",
    "QuantumBeam Anomaly Detector",
)
alerter.AddChannel(slackChannel)
```

### 3. Start Detection
```go
// Start the detector and alerter
if err := detector.Start(); err != nil {
    log.Fatal(err)
}
if err := alerter.Start(); err != nil {
    log.Fatal(err)
}

// Connect detector to alerter
go func() {
    for alert := range detector.GetAlerts() {
        alerter.GetAlerts() <- alert
    }
}()
```

### 4. Setup Web Interface
```go
webInterface := NewWebInterface(detector, alerter)
router := webInterface.GetRouter()

// Start HTTP server
log.Fatal(http.ListenAndServe(":8080", router))
```

## 📡 API Endpoints

### Metrics Management
- `GET /api/v1/anomaly/metrics` - List all configured metrics
- `POST /api/v1/anomaly/metrics` - Add a new metric
- `DELETE /api/v1/anomaly/metrics/:name` - Remove a metric
- `GET /api/v1/anomaly/metrics/:name/data` - Get cached metric data
- `GET /api/v1/anomaly/metrics/:name/stats` - Get metric statistics

### Alert Management
- `GET /api/v1/anomaly/alerts` - Get recent alerts
- `POST /api/v1/anomaly/silences` - Create a silence rule
- `DELETE /api/v1/anomaly/silences/:id` - Remove a silence rule
- `GET /api/v1/anomaly/rules` - List alert rules
- `POST /api/v1/anomaly/rules` - Create an alert rule
- `PUT /api/v1/anomaly/rules/:id` - Update an alert rule
- `DELETE /api/v1/anomaly/rules/:id` - Delete an alert rule

### System Status
- `GET /api/v1/anomaly/health` - Health check
- `GET /api/v1/anomaly/statistics` - System statistics
- `GET /api/v1/anomaly/status` - Overall system status

## 🎛️ Default Metrics

The system monitors these metrics by default:

### Infrastructure Metrics
- **HTTP Request Rate**: Spikes in request volume
- **Error Rate**: Increases in HTTP error rates
- **Response Time**: Anomalous response time patterns
- **CPU Usage**: Unexpected CPU usage spikes
- **Memory Usage**: Memory usage anomalies
- **Database Connections**: Unusual connection patterns

### Business Metrics
- **Fraud Detection Rate**: Drops in detection performance
- **Model Accuracy**: Decreases in model accuracy
- **Transaction Processing**: Anomalies in transaction volumes
- **Cache Hit Rate**: Drops in cache performance

### Security Metrics
- **Authentication Failures**: Spikes in failed logins
- **Rate Limiting**: Unusual rate limiting patterns
- **SSL Certificate**: Certificate expiry monitoring

## 🔧 Advanced Configuration

### Custom Detection Models
```go
factory := &ModelFactory{}
model, err := factory.CreateModel("isolation_forest", map[string]interface{}{
    "num_trees":  100,
    "max_depth":  10,
    "sample_size": 256,
})
```

### Custom Detection Methods
```go
type CustomDetector struct{}
func (d *CustomDetector) Detect(data []DataPoint, config MetricConfig) (*Anomaly, error) {
    // Custom detection logic
}
```

### Advanced Alert Rules
```go
rule := &AlertRule{
    Conditions: map[string]interface{}{
        "min_deviation":  50.0,
        "min_confidence": 0.8,
        "max_value":      1000.0,
    },
}
```

## 📈 Performance Considerations

### Resource Usage
- **Memory**: Caches data points for lookback window analysis
- **CPU**: Statistical calculations and ML model inference
- **Network**: Prometheus queries and notification delivery

### Optimization Tips
1. **Batch Processing**: Processes metrics in configurable batches
2. **Rate Limiting**: Limits alert frequency to prevent alert fatigue
3. **Caching**: Caches metric data to reduce Prometheus queries
4. **Concurrent Processing**: Parallel processing of multiple metrics

### Scaling
- Horizontal scaling via multiple detector instances
- Shared alert state via external storage (Redis, etc.)
- Load balancing across detector instances

## 🔍 Monitoring and Troubleshooting

### Health Checks
```bash
curl http://localhost:8080/api/v1/anomaly/health
```

### Statistics
```bash
curl http://localhost:8080/api/v1/anomaly/statistics
```

### System Status
```bash
curl http://localhost:8080/api/v1/anomaly/status
```

### Common Issues
1. **No Alerts Generated**: Check metric configuration and thresholds
2. **High False Positives**: Adjust threshold factors and detection sensitivity
3. **Missing Data**: Verify Prometheus connectivity and query syntax
4. **Alert Fatigue**: Configure appropriate frequency limits and silences

## 🔒 Security Considerations

### API Security
- Authentication and authorization for API endpoints
- Rate limiting on API calls
- Input validation and sanitization

### Data Privacy
- Sensitive metric value masking
- Secure storage of alert configurations
- Audit logging of configuration changes

## 📚 Examples and Use Cases

### Use Case 1: Error Rate Monitoring
Monitor error rate spikes for immediate incident response:
```go
metric := MetricConfig{
    Name:            "error_rate",
    Query:           "sum(rate(http_requests_total{status_code=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100",
    Type:            TypeSpike,
    Severity:        SeverityCritical,
    ThresholdFactor: 2.0,
}
```

### Use Case 2: Model Performance Degradation
Detect ML model accuracy drops:
```go
metric := MetricConfig{
    Name:            "model_accuracy",
    Query:           "model_accuracy_score",
    Type:            TypeDrop,
    Severity:        SeverityHigh,
    ThresholdFactor: 1.5,
}
```

### Use Case 3: Resource Usage Anomalies
Monitor unusual resource consumption:
```go
metric := MetricConfig{
    Name:            "cpu_usage",
    Query:           "cpu_usage_percent",
    Type:            TypeAnomalousValue,
    Severity:        SeverityMedium,
    ThresholdFactor: 2.5,
}
```

## 🤝 Contributing

### Adding New Detection Methods
1. Implement the `DetectionMethod` interface
2. Add the method to the detector initialization
3. Add tests for the new method
4. Update documentation

### Adding New ML Models
1. Implement the `StatisticalModel` interface
2. Add model to the factory
3. Include training and prediction logic
4. Add configuration options

### Testing
```bash
# Run unit tests
go test ./...

# Run integration tests
go test -tags=integration ./...

# Run with coverage
go test -cover ./...
```

## 📞 Support

For issues and support:
1. Check system health and status endpoints
2. Review logs for error messages
3. Verify Prometheus connectivity
4. Check metric query syntax
5. Validate alert rule configurations

---

**Note**: This anomaly detection system is designed for production use with enterprise-grade reliability and scalability considerations.