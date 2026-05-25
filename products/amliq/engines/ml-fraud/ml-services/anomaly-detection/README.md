# Anomaly Detection System

This directory contains the complete anomaly detection system for QuantumBeam, implementing both statistical and machine learning-based approaches to detect unusual patterns in application metrics and behavior.

## Architecture Overview

The anomaly detection system consists of:

1. **Statistical Anomaly Detector** - Fast, lightweight statistical algorithms
2. **ML Anomaly Detector** - Advanced machine learning models for complex patterns
3. **Alert Integration** - Automatic alert generation and correlation
4. **Model Management** - Automated training, evaluation, and deployment

## Components

### Statistical Anomaly Detector (`statistical-anomaly-detection.py`)

Implements multiple statistical algorithms:

- **Z-Score**: Identifies outliers based on standard deviations
- **IQR (Interquartile Range)**: Detects outliers using quartile ranges
- **EWMA (Exponentially Weighted Moving Average)**: Time-weighted average detection
- **Moving Average**: Simple moving average with standard deviation analysis
- **Seasonal Decomposition**: Handles seasonal patterns in data

**Features:**
- Real-time anomaly detection
- Low computational overhead
- Configurable thresholds and windows
- Automatic model retention management
- FastAPI server for model management
- Integration with Prometheus and AlertManager

### ML Anomaly Detector (`ml-anomaly-detection.py`)

Implements advanced machine learning models:

- **Isolation Forest**: Unsupervised anomaly detection using random forests
- **LSTM (Long Short-Term Memory)**: Neural network for time series patterns
- **Autoencoder**: Deep learning model for reconstruction-based detection
- **PCA (Principal Component Analysis)**: Dimensionality reduction for anomaly detection

**Features:**
- Automated feature engineering
- Model training and evaluation
- Ensemble predictions
- Model performance monitoring
- Scheduled model retraining
- Support for multiple algorithms simultaneously

### Deployment Configuration (`anomaly-detector-service.yaml`)

Complete Kubernetes deployment including:

- **Deployments**: Auto-scaling pods for both detectors
- **Services**: HTTP and gRPC endpoints
- **ConfigMaps**: Centralized configuration management
- **Persistent Storage**: Model and data storage
- **Monitoring**: Prometheus metrics and health checks
- **CronJobs**: Automated model training
- **Autoscaling**: Horizontal pod autoscaling based on resource usage

## Installation and Deployment

### Prerequisites

- Kubernetes cluster
- Prometheus for metrics collection
- Redis for state management
- AlertManager for alerting

### Deployment Steps

1. **Create secrets:**
```bash
# Create Redis URL secret
echo -n "redis://redis.observability.svc.cluster.local:6379/0" | base64
# Update the redis_url in anomaly-detector-secrets Secret
```

2. **Deploy the system:**
```bash
kubectl apply -f anomaly-detector-service.yaml
```

3. **Monitor deployment:**
```bash
kubectl get pods -n monitoring -l component=anomaly-detection
kubectl logs -n monitoring -l app=statistical-anomaly-detector
kubectl logs -n monitoring -l app=ml-anomaly-detector
```

## Configuration

### Statistical Detector Configuration

Key parameters in `config.yaml`:

```yaml
statistical_detector:
  z_score_threshold: 3.0          # Z-score threshold for anomalies
  z_score_window: 100             # Window size for calculation
  iqr_multiplier: 1.5             # IQR multiplier for outlier detection
  ewma_alpha: 0.3                 # EWMA smoothing factor
  ma_window: 20                   # Moving average window
  seasonal_period: 24             # Seasonal decomposition period
```

### ML Detector Configuration

Key parameters in `config.yaml`:

```yaml
ml_detector:
  training_window_hours: 168      # Training data window (1 week)
  training_interval_hours: 24     # Model retraining interval
  isolation_forest_contamination: 0.1  # Expected anomaly ratio
  lstm_sequence_length: 50        # LSTM input sequence length
  lstm_epochs: 100                # LSTM training epochs
  autoencoder_epochs: 200         # Autoencoder training epochs
```

## Usage

### Statistical Anomaly Detector API

**Health Check:**
```bash
curl http://statistical-anomaly-detector:8000/health
```

**Add Data Point:**
```bash
curl -X POST http://statistical-anomaly-detector:8000/data \
  -H "Content-Type: application/json" \
  -d '{
    "metric_name": "request_rate",
    "value": 1500.5,
    "labels": {"service": "api", "method": "GET"},
    "timestamp": 1694670000
  }'
```

**Check for Anomalies:**
```bash
curl -X POST http://statistical-anomaly-detector:8000/anomaly-check \
  -H "Content-Type: application/json" \
  -d '{
    "metric_name": "request_rate",
    "labels": {"service": "api", "method": "GET"}
  }'
```

**Model Management:**
```bash
# Get model info
curl http://statistical-anomaly-detector:8000/models/request_rate

# Update model parameters
curl -X PUT http://statistical-anomaly-detector:8000/models/request_rate \
  -H "Content-Type: application/json" \
  -d '{
    "z_score_threshold": 3.5,
    "iqr_multiplier": 1.8
  }'
```

### ML Anomaly Detector API

**Health Check:**
```bash
curl http://ml-anomaly-detector:8000/health
```

**Train Models:**
```bash
curl -X POST http://ml-anomaly-detector:8000/train \
  -H "Content-Type: application/json" \
  -d '{
    "metric_names": ["request_rate", "error_rate", "response_time"],
    "models": ["isolation_forest", "lstm", "autoencoder"]
  }'
```

**Check for Anomalies:**
```bash
curl -X POST http://ml-anomaly-detector:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "metric_name": "request_rate",
    "labels": {"service": "api", "method": "GET"},
    "timestamp": 1694670000
  }'
```

**Model Information:**
```bash
# Get all model info
curl http://ml-anomaly-detector:8000/models

# Get specific model info
curl http://ml-anomaly-detector:8000/models/request_rate/isolation_forest

# Delete a model
curl -X DELETE http://ml-anomaly-detector:8000/models/request_rate/lstm
```

## Monitoring and Metrics

### Prometheus Metrics

Both services expose Prometheus metrics on port 8000:

- `anomaly_detector_requests_total` - Total API requests
- `anomaly_detector_request_duration_seconds` - Request duration
- `anomaly_detector_anomalies_detected_total` - Total anomalies detected
- `anomaly_detector_models_loaded` - Number of loaded models
- `anomaly_detector_last_training_timestamp` - Last model training time

### Grafana Dashboard

Use the provided `anomaly-detection-dashboard.json` for comprehensive monitoring of:

- Anomaly detection rates
- Model performance metrics
- API response times
- System resource usage
- Training job status

## Alerting

### AlertManager Integration

Both detectors automatically send alerts to AlertManager when anomalies are detected:

```yaml
# Example alert rule
- alert: AnomalyDetected
  expr: anomaly_detector_anomalies_detected_total > 0
  labels:
    severity: warning
    service: anomaly-detection
  annotations:
    summary: "Anomaly detected in {{ $labels.metric_name }}"
    description: "Anomaly detected with score {{ $value }} in {{ $labels.metric_name }}"
```

### Custom Alerting

The detectors support custom alert thresholds and cooldown periods:

```yaml
alerting:
  anomaly_score_threshold: 0.7
  consecutive_anomalies_threshold: 2
  alert_cooldown_minutes: 15
  max_alerts_per_hour: 10
```

## Performance Considerations

### Resource Requirements

- **Statistical Detector**: Low CPU and memory usage
- **ML Detector**: Higher resource usage during training
- **Storage**: Model storage scales with number of metrics

### Scaling

- Both services support horizontal scaling
- Use separate pods for different metric groups
- Consider model caching for frequently accessed models

### Model Retention

- Automatic cleanup of old models
- Configurable retention periods
- Graceful degradation during model updates

## Troubleshooting

### Common Issues

1. **High Memory Usage**: Reduce model retention periods or increase memory limits
2. **Slow Training**: Increase training intervals or reduce training data window
3. **False Positives**: Adjust anomaly thresholds or use ensemble predictions
4. **Model Training Failures**: Check Prometheus connectivity and data availability

### Debug Commands

```bash
# Check service health
kubectl exec -n monitoring deployment/statistical-anomaly-detector -- curl localhost:8000/health

# Check Redis connectivity
kubectl exec -n monitoring deployment/statistical-anomaly-detector -- python -c "
import redis
r = redis.Redis(host='redis.observability.svc.cluster.local')
print(r.ping())
"

# View training logs
kubectl logs -n monitoring job/ml-model-trainer-<timestamp>

# Check metrics
curl http://statistical-anomaly-detector:8000/metrics
```

## Contributing

### Adding New Algorithms

1. Implement the algorithm in the appropriate detector class
2. Add configuration parameters to `config.yaml`
3. Update API endpoints to support the new algorithm
4. Add relevant Prometheus metrics
5. Update documentation

### Model Improvements

1. Add new features to the feature engineering pipeline
2. Experiment with different hyperparameters
3. Implement ensemble methods
4. Add model interpretability features

## Security Considerations

- API authentication and authorization
- Secure storage of model artifacts
- Network policies for service communication
- Audit logging for model training and predictions
- Input validation for all API endpoints

## License

This anomaly detection system is part of the QuantumBeam platform and follows the same licensing terms.