# QuantumBeam Quantum Service

The Quantum Service provides quantum computing capabilities for fraud detection, including Variational Quantum Circuits (VQC) and Quantum Approximate Optimization Algorithm (QAOA).

## Features

- **Variational Quantum Classifier (VQC)**: Quantum-enhanced classification for fraud detection
- **Quantum Approximate Optimization Algorithm (QAOA)**: Optimization for fraud ring detection
- **Hybrid Quantum-Classical Processing**: Automatic fallback to classical ML when quantum resources are unavailable
- **Multi-Backend Support**: IBM Quantum, Amazon Braket, Azure Quantum, and local simulators
- **Real-time Processing**: Sub-50ms quantum computation latency
- **Comprehensive Monitoring**: Prometheus metrics, Jaeger tracing, and structured logging

## Quick Start

### Prerequisites

- Python 3.11+
- Docker and Docker Compose
- Access to quantum computing providers (optional, uses simulator by default)

### Setup

1. **Clone and navigate to the service directory:**
   ```bash
   cd services/quantum
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
   Edit `.env` file with your configuration, especially:
   - `IBM_QUANTUM_TOKEN`: IBM Quantum API token
   - `QUANTUM_SIMULATOR`: Set to `false` to use real quantum devices

5. **Run the service:**
   ```bash
   ./run.sh
   ```

### Docker Setup

1. **Build and run with Docker Compose:**
   ```bash
   cd ../../
   docker-compose up quantum-service -d
   ```

2. **View logs:**
   ```bash
   docker-compose logs -f quantum-service
   ```

## API Documentation

Once the service is running, visit:

- **API Documentation**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

### Key Endpoints

- `GET /health` - Service health check
- `GET /ready` - Dependency readiness check
- `GET /algorithms` - List available quantum algorithms
- `POST /compute` - Perform quantum computation
- `GET /metrics` - Service metrics

## Example Usage

### VQC Classification

```python
import httpx

# Prepare request
request_data = {
    "data": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    "algorithm": "vqc",
    "parameters": {
        "layers": 3,
        "entanglement": "full",
        "reps": 2
    }
}

# Make request
response = httpx.post("http://localhost:8000/compute", json=request_data)
result = response.json()

print(f"Classification: {result['result']['classification']}")
print(f"Confidence: {result['confidence']}")
print(f"Execution time: {result['metadata']['execution_time_ms']}ms")
```

### QAOA Optimization

```python
import httpx

# Prepare request
request_data = {
    "data": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    "algorithm": "qaoa",
    "parameters": {
        "p": 2,
        "mixer": "X",
        "max_iterations": 100
    }
}

# Make request
response = httpx.post("http://localhost:8000/compute", json=request_data)
result = response.json()

print(f"Optimal solution: {result['result']['optimal_solution']}")
print(f"Energy: {result['result']['energy']}")
print(f"Convergence: {result['result']['convergence']}")
```

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
services/quantum/
├── src/quantumbeam/quantum/     # Main package
│   ├── main.py                  # FastAPI application
│   ├── core/                    # Core quantum algorithms
│   │   ├── vqc_classifier.py
│   │   └── qaoa_detector.py
│   ├── models/                  # Pydantic models
│   ├── algorithms/              # Quantum algorithms
│   ├── api/                     # API routes
│   ├── utils/                   # Utilities
│   └── tests/                   # Tests
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
| `INFLUXDB_TOKEN` | InfluxDB auth token | - |
| `IBM_QUANTUM_TOKEN` | IBM Quantum API token | - |
| `QUANTUM_SIMULATOR` | Use quantum simulator | true |
| `API_HOST` | API bind host | 0.0.0.0 |
| `API_PORT` | API port | 8000 |
| `LOG_LEVEL` | Logging level | info |
| `PROMETHEUS_ENABLED` | Enable Prometheus metrics | true |
| `JAEGER_ENDPOINT` | Jaeger tracing endpoint | - |

## Quantum Providers

### IBM Quantum

1. Sign up at [IBM Quantum](https://quantum-computing.ibm.com/)
2. Get your API token from your account
3. Set `IBM_QUANTUM_TOKEN` in your environment

### Amazon Braket

1. Configure AWS credentials
2. Set environment variables:
   ```bash
   export AWS_BRAKET_ACCESS_KEY_ID=your_key
   export AWS_BRAKET_SECRET_ACCESS_KEY=your_secret
   export AWS_BRAKET_REGION=us-east-1
   ```

### Azure Quantum

1. Create an Azure Quantum workspace
2. Configure authentication credentials

## Monitoring

### Metrics

The service exposes Prometheus metrics at `/metrics`:

- `quantum_requests_total`
- `quantum_request_duration_seconds`
- `quantum_circuits_executed_total`
- `quantum_execution_time_seconds`
- `quantum_errors_total`

### Logging

Structured JSON logs with the following fields:

- `timestamp`: ISO 8601 timestamp
- `level`: Log level (debug, info, warning, error)
- `service`: Service name (quantum-service)
- `message`: Log message
- `request_id`: Request correlation ID
- `algorithm`: Quantum algorithm used
- `execution_time`: Execution time in ms

### Tracing

Distributed tracing with Jaeger:

1. Run Jaeger:
   ```bash
   docker run -p 16686:16686 -p 14268:14268 jaegertracing/all-in-one:latest
   ```

2. View traces at: http://localhost:16686

## Performance

### Benchmarks

- **VQC Classification**: ~45ms average
- **QAOA Optimization**: ~125ms average
- **Circuit Depth**: 5-50 layers
- **Qubits Used**: 4-20 qubits
- **Throughput**: 100+ requests/second

### Optimization Tips

1. **Use Local Simulator**: Faster for development and testing
2. **Batch Requests**: Process multiple transactions together
3. **Cache Results**: Cache quantum computations for repeated inputs
4. **Circuit Optimization**: Minimize circuit depth for faster execution

## Troubleshooting

### Common Issues

1. **"Quantum backend not available"**
   - Check quantum provider credentials
   - Verify network connectivity
   - Fall back to simulator

2. **"Circuit execution failed"**
   - Check circuit configuration
   - Verify number of qubits <= backend limit
   - Review measurement settings

3. **"High latency"**
   - Use local simulator for development
   - Optimize circuit depth
   - Check network latency to quantum providers

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=debug
./run.sh
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.