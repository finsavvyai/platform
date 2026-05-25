# QuantumBeam ML Service

The ML Service provides classical machine learning capabilities for fraud detection, including ensemble models, real-time predictions, and model management.

## Features

- **Fraud Detection Models**: Random Forest, XGBoost, Neural Networks, and LSTM
- **Real-time Predictions**: Sub-50ms inference latency
- **Batch Processing**: Handle up to 1000 transactions per batch
- **Model Versioning**: Track and manage multiple model versions
- **Explainability**: SHAP-based explanations for predictions
- **Feature Store**: Centralized feature management and caching
- **Auto-retraining**: Scheduled model retraining with latest data
- **Comprehensive Monitoring**: Prometheus metrics, MLflow tracking

## Quick Start

### Prerequisites

- Python 3.11+
- Docker and Docker Compose
- GPU support (optional, for model training)

### Setup

1. **Clone and navigate to the service directory:**
   ```bash
   cd services/ml
   ```

2. **Run the setup script:**
   ```bash
   ./setup_venv.sh
   ```

3. **Activate the virtual environment:**
   ```bash
   source activate.sh
   ```

4. **Update configuration:**
   Edit `.env` file with your configuration

5. **Run the service:**
   ```bash
   ./run.sh
   ```

### Docker Setup

1. **Build and run with Docker Compose:**
   ```bash
   cd ../../
   docker-compose up ml-service -d
   ```

2. **View logs:**
   ```bash
   docker-compose logs -f ml-service
   ```

## API Documentation

Once the service is running, visit:

- **API Documentation**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc
- **Health Check**: http://localhost:8001/health

### Key Endpoints

- `GET /health` - Service health check
- `GET /ready` - Dependency readiness check
- `POST /predict` - Single transaction fraud prediction
- `GET /models` - List available models
- `POST /models/retrain` - Trigger model retraining
- `GET /metrics` - Service metrics

## Example Usage

### Single Prediction

```python
import httpx

# Prepare request
request_data = {
    "transaction_data": {
        "amount": 250.00,
        "merchant_id": "merchant_123",
        "customer_id": "customer_456",
        "time_of_day": 14,
        "day_of_week": 2,
        "merchant_category": "electronics",
        "location": "US",
        "device_type": "mobile"
    },
    "model_version": "latest",
    "include_explainability": True
}

# Make request
response = httpx.post("http://localhost:8001/predict", json=request_data)
result = response.json()

print(f"Is Fraud: {result['is_fraud']}")
print(f"Fraud Probability: {result['fraud_probability']:.2%}")
print(f"Risk Score: {result['risk_score']}")
print(f"Model Version: {result['model_version']}")

if result['explanation']:
    print(f"Explanation: {result['explanation']['explanation_text']}")
```

### Batch Prediction

```python
import httpx

# Prepare batch request
transactions = [
    {"amount": 100.00, "merchant_id": "merch_1"},
    {"amount": 5000.00, "merchant_id": "merch_2"},
    # ... up to 1000 transactions
]

request_data = {
    "transactions": transactions,
    "model_version": "1.0.0"
}

# Make request
response = httpx.post("http://localhost:8001/predict/batch", json=request_data)
results = response.json()

for result in results["predictions"]:
    print(f"Transaction: {result['transaction_id']}")
    print(f"Fraud Risk: {result['risk_score']}")
```

## Model Management

### Listing Models

```bash
curl http://localhost:8001/models
```

### Retraining Models

```bash
curl -X POST http://localhost:8001/models/retrain
```

### Model Performance

The service tracks the following metrics:

- **Accuracy**: Overall prediction accuracy
- **Precision**: True positive rate
- **Recall**: Detection rate
- **F1 Score**: Harmonic mean of precision and recall
- **AUC-ROC**: Area under ROC curve

## Development

### Running Tests

```bash
./test.sh
```

Or manually:

```bash
# Activate virtual environment
source venv/bin/activate

# Run unit tests
pytest tests/unit/ -v

# Run integration tests
pytest tests/integration/ -v

# Run with coverage
pytest --cov=src --cov-report=html
```

### Code Quality

```bash
# Linting
ruff check src/ tests/

# Formatting
black src/ tests/
isort src/ tests/

# Type checking
mypy src/
```

### Project Structure

```
services/ml/
├── src/quantumbeam/ml/          # Main package
│   ├── main.py                  # FastAPI application
│   ├── core/                    # Core ML logic
│   │   ├── predictor.py
│   │   └── model_manager.py
│   ├── models/                  # Pydantic models
│   ├── preprocessing/           # Data preprocessing
│   ├── api/                     # API routes
│   ├── utils/                   # Utilities
│   └── tests/                   # Tests
├── models/                      # Trained model artifacts
├── data/                        # Training data
│   ├── raw/
│   ├── processed/
│   └── validation/
├── artifacts/                   # MLflow artifacts
├── requirements.txt             # Production dependencies
├── requirements-dev.txt         # Development dependencies
├── pyproject.toml              # Package configuration
├── Dockerfile.dev             # Development Docker image
├── .env                       # Environment configuration
├── setup_venv.sh             # Setup script
├── activate.sh               # Activation script
├── run.sh                    # Run script
└── test.sh                   # Test script
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis server host | localhost |
| `REDIS_PORT` | Redis server port | 6379 |
| `INFLUXDB_URL` | InfluxDB URL | http://localhost:8086 |
| `ELASTICSEARCH_URL` | Elasticsearch URL | http://localhost:9200 |
| `MODEL_REGISTRY_PATH` | Model storage path | ./models |
| `API_HOST` | API bind host | 0.0.0.0 |
| `API_PORT` | API port | 8001 |
| `MAX_BATCH_SIZE` | Maximum batch size | 1000 |
| `FEATURE_STORE_TTL` | Feature cache TTL | 86400 |
| `LOG_LEVEL` | Logging level | info |
| `PROMETHEUS_ENABLED` | Enable Prometheus metrics | true |
| `MLFLOW_TRACKING_URI` | MLflow tracking URI | http://localhost:5000 |

## Features

### 1. Fraud Detection Models

#### Random Forest
- Handles non-linear relationships
- Feature importance extraction
- Good for baseline performance

#### XGBoost
- Gradient boosting implementation
- High accuracy and speed
- Handles missing values

#### Neural Networks
- Deep learning models
- Captures complex patterns
- GPU acceleration support

#### LSTM Networks
- Sequential transaction analysis
- Temporal pattern detection
- Behavior modeling

### 2. Feature Engineering

#### Preprocessing Pipeline
- Data normalization
- Missing value imputation
- Categorical encoding
- Feature scaling

#### Feature Store
- Centralized feature management
- Real-time feature serving
- Feature versioning
- Caching for performance

### 3. Model Explainability

#### SHAP Values
- Local explanations
- Feature importance
- Visual explanations

#### LIME Explanations
- Local interpretable models
- Instance-level explanations

### 4. Model Monitoring

#### Performance Tracking
- Accuracy over time
- Concept drift detection
- Model degradation alerts

#### Data Drift
- Feature distribution monitoring
- Statistical tests
- Automated alerts

## Performance

### Benchmarks

- **Single Prediction**: ~15ms average
- **Batch Prediction (100)**: ~200ms
- **Model Loading**: ~500ms
- **Feature Preprocessing**: ~5ms
- **Throughput**: 500+ predictions/second

### Optimization Tips

1. **Batch Processing**: Process multiple transactions together
2. **Feature Caching**: Cache precomputed features
3. **Model Optimization**: Use ONNX for inference
4. **GPU Acceleration**: Use GPU for model training

## Monitoring

### Metrics

The service exposes Prometheus metrics at `/metrics`:

- `ml_predictions_total`
- `ml_prediction_duration_seconds`
- `ml_model_accuracy`
- `ml_feature_processing_duration`
- `ml_errors_total`

### Logging

Structured JSON logs with the following fields:

- `timestamp`: ISO 8601 timestamp
- `level`: Log level (debug, info, warning, error)
- `service`: Service name (ml-service)
- `message`: Log message
- `request_id`: Request correlation ID
- `model_version`: Model version used
- `prediction_time`: Prediction latency

### MLflow Integration

Track experiments and models:

1. Start MLflow server:
   ```bash
   mlflow server --host 0.0.0.0 --port 5000
   ```

2. View experiments at: http://localhost:5000

## Troubleshooting

### Common Issues

1. **"Model not found"**
   - Check model registry path
   - Verify model files exist
   - Check model version

2. **"Feature preprocessing failed"**
   - Validate input data format
   - Check feature schema
   - Verify data types

3. **"High prediction latency"**
   - Check model size
   - Optimize feature computation
   - Use GPU if available

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=debug
./run.sh
```

## Model Training

### Training Script

```python
# train_model.py
import mlflow
import mlflow.sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

# Load data
X, y = load_training_data()

# Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# Train model
with mlflow.start_run():
    model = RandomForestClassifier(n_estimators=100)
    model.fit(X_train, y_train)
    
    # Log metrics
    accuracy = model.score(X_test, y_test)
    mlflow.log_metric("accuracy", accuracy)
    
    # Log model
    mlflow.sklearn.log_model(model, "model")
```

### Custom Models

1. Implement model interface
2. Save model artifacts
3. Update model registry
4. Deploy to service

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.