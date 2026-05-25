# DLP Scanning Pipeline for SDLC.ai

## Overview

This comprehensive Data Loss Prevention (DLP) scanning pipeline provides enterprise-grade content analysis with PII detection, regex pattern matching, ML-based content classification, and real-time violation reporting. Built as a microservice for the SDLC.ai platform, it supports multi-tenancy, regulatory compliance, and high-performance scanning.

## Features

### 🔍 Core Scanning Capabilities
- **Presidio PII Detection**: Integration with Microsoft Presidio for PII entity detection
- **Advanced Regex Engine**: High-performance pattern matching with custom patterns
- **ML Content Classification**: Machine learning-based content categorization and risk assessment
- **Custom Rule Engine**: Complex rule composition with AND/OR/NOT operators
- **Real-time Scanning**: Low-latency scanning with <100ms processing time

### 🏢 Multi-tenancy & Isolation
- **Tenant Isolation**: Complete data separation between tenants
- **Policy Inheritance**: Global policies with tenant-specific overrides
- **Resource Quotas**: Configurable limits per tenant tier
- **Per-tenant Reporting**: Individual analytics and compliance reports

### 📊 Compliance & Reporting
- **Regulatory Compliance**: GDPR, HIPAA, CCPA, PCI-DSS support
- **Violation Reporting**: Real-time alerts and comprehensive reporting
- **Audit Logging**: Complete audit trails for compliance
- **Trend Analysis**: Violation trends and risk assessment

### ⚡ Performance & Scalability
- **Parallel Processing**: Multi-threaded scanning for high throughput
- **Caching Layer**: Redis-based result caching for performance
- **Streaming Support**: Large content scanning with streaming API
- **Batch Operations**: Efficient processing of multiple items

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client Apps   │────│   FastAPI API    │────│  DLP Services   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼──────┐ ┌─────▼─────┐ ┌───────▼───────┐
        │ Presidio     │ │ Regex    │ │ Content      │
        │ Detector     │ │ Engine   │ │ Classifier   │
        └──────────────┘ └───────────┘ └───────────────┘
                │               │               │
                └───────────────┼───────────────┘
                                │
                    ┌───────▼───────┐
                    │ Rule Engine   │
                    └───────────────┘
                                │
                    ┌───────▼───────┐
                    │  Reporting    │
                    │   System      │
                    └───────────────┘
```

## Quick Start

### Prerequisites

- Python 3.11+
- Redis server
- PostgreSQL database (optional)
- spaCy models for NLP processing

### Installation

1. **Install dependencies**:
   ```bash
   cd services/dlp
   pip install -e .
   ```

2. **Download spaCy models**:
   ```bash
   python -m spacy download en_core_web_lg
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the service**:
   ```bash
   python main.py
   ```

### Docker Deployment

```bash
# Build image
docker build -t sdlc-dlp .

# Run with Docker Compose
docker-compose -f ../docker-compose.dev.yml up dlp
```

## API Usage

### Basic Content Scanning

```python
import httpx

# Scan content for DLP violations
response = httpx.post("http://localhost:8003/api/v1/scans", json={
    "content": "John Smith's email is john.smith@example.com and phone is 555-1234.",
    "content_type": "text/plain",
    "policies": ["pii-policy"],
    "return_context": True
})

result = response.json()
print(f"Violations found: {result['total_violations']}")
print(f"Risk level: {result['risk_level']}")
```

### Batch Scanning

```python
# Scan multiple items
response = httpx.post("http://localhost:8003/api/v1/scans/batch", json={
    "items": [
        {"content": "Email: user@example.com"},
        {"content": "Phone: 555-1234"},
        {"content": "SSN: 123-45-6789"}
    ],
    "parallel_processing": True
})

batch_result = response.json()
print(f"Total violations: {batch_result['total_violations']}")
```

### Streaming Scanning

```python
# Large content streaming
with httpx.stream("POST", "http://localhost:8003/api/v1/scans/stream", json={
    "content": large_content,
    "priority": "HIGH"
}) as response:
    for line in response.iter_lines():
        if line:
            event = line.decode('utf-8')
            if event.startswith("data: "):
                data = event[6:]  # Remove "data: " prefix
                if data != "[DONE]":
                    progress = json.loads(data)
                    print(f"Progress: {progress['progress_percentage']}%")
```

## Configuration

### Environment Variables

```bash
# Service Configuration
DLP_HOST=0.0.0.0
DLP_PORT=8003
DLP_DEBUG=false

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/sdlc_dlp
REDIS_URL=redis://localhost:6379/0

# Presidio Configuration
PRESIDIO_ENABLED=true
PRESIDIO_CONFIDENCE_THRESHOLD=0.8
PRESIDIO_MODELS_PATH=/app/models/presidio

# ML Models
ML_MODELS_PATH=/app/models/ml
CONTENT_CLASSIFIER_MODEL=bert-base-uncased-finetuned-content-classification

# Performance
CACHE_ENABLED=true
MAX_CONTENT_SIZE_MB=100
PARALLEL_SCANNING_ENABLED=true
MAX_PARALLEL_SCANS=10

# Multi-tenancy
MULTI_TENANT_ENABLED=true
DEFAULT_TENANT_ID=default

# Alerting
ALERT_WEBHOOK_URL=https://hooks.slack.com/your-webhook
EMAIL_ALERTS_ENABLED=false
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
```

### Tenant Configuration

```python
from app.services.multi_tenant_manager import get_multi_tenant_manager

# Create a new tenant
manager = get_multi_tenant_manager()
config = manager.create_tenant(
    tenant_id="acme-corp",
    name="ACME Corporation",
    tier="PROFESSIONAL",
    description="Enterprise DLP configuration"
)

# Update tenant configuration
manager.update_tenant_config("acme-corp", {
    "presidio_entities": ["EMAIL_ADDRESS", "PHONE_NUMBER", "SSN"],
    "presidio_confidence_threshold": 0.9,
    "custom_patterns": ["acme_internal_id", "acme_confidential_code"]
})
```

## Custom Patterns

### Adding Regex Patterns

```python
from app.services.regex_engine import get_regex_engine
from app.services.regex_engine import RegexPatternConfig, PatternCategory

engine = get_regex_engine()

# Create custom pattern
custom_pattern = RegexPatternConfig(
    name="acme_employee_id",
    pattern=r"EMP-\d{6}",
    category=PatternCategory.IDENTIFICATION,
    subcategory="EMPLOYEE_ID",
    description="ACME employee ID format",
    confidence=0.95,
    severity="MEDIUM",
    test_cases=[
        ("EMP-123456", True),
        ("EMP123456", False),
        ("USER-123456", False)
    ]
)

# Add pattern to engine
success, errors = engine.add_pattern(custom_pattern)
if success:
    print("Pattern added successfully")
else:
    print(f"Pattern validation failed: {errors}")
```

### Custom Presidio Recognizers

```python
from app.services.presidio_detector import CustomRecognizer, RecognizerResult

class ACMECustomRecognizer(CustomRecognizer):
    def __init__(self):
        super().__init__(
            name="ACMECustomRecognizer",
            supported_entities=["ACME_PROJECT_CODE"],
            confidence=0.9
        )
    
    def analyze(self, text, entities, nlp_artifacts):
        results = []
        if "ACME_PROJECT_CODE" in entities:
            # Custom ACME project code pattern: PROJ-[A-Z]{3}-\d{4}
            import re
            pattern = r"PROJ-[A-Z]{3}-\d{4}"
            matches = re.finditer(pattern, text)
            
            for match in matches:
                start, end = match.span()
                result = RecognizerResult(
                    entity_type="ACME_PROJECT_CODE",
                    start=start,
                    end=end,
                    score=0.9,
                    recognizer_name=self.name
                )
                results.append(result)
        
        return results

# Add to Presidio detector
detector = get_presidio_detector()
detector.registry.add_recognizer(ACMECustomRecognizer())
```

## DLP Rules

### Creating Custom Rules

```python
from app.services.rule_engine import get_rule_engine, DLPRuleDefinition
from app.services.rule_engine import RuleCondition, RuleAction, LogicalOperator, ComparisonOperator

engine = get_rule_engine()

# Create a complex rule
rule = DLPRuleDefinition(
    id="high_value pii detection",
    name="High Value PII Detection",
    description="Detect high-value PII combinations",
    rule_type="composite",
    conditions=[
        RuleCondition(
            field="presidio_results.entities",
            operator="CONTAINS",
            value="US_SSN"
        ),
        {
            "operator": "AND",
            "conditions": [
                RuleCondition(
                    field="classification_result.predicted_class",
                    operator="EQUALS",
                    value="FINANCIAL"
                ),
                RuleCondition(
                    field="classification_result.confidence",
                    operator="GREATER_THAN_OR_EQUAL",
                    value=0.8
                )
            ]
        }
    ],
    logical_operator=LogicalOperator.AND,
    actions=[
        RuleAction(
            action_type="VIOLATION",
            violation_type="HIGH_VALUE_PII",
            severity="CRITICAL",
            confidence_adjustment=0.1
        ),
        RuleAction(
            action_type="ALERT",
            alert_recipients=["security@company.com"],
            alert_message_template="High-value PII detected: {violation_count} violations"
        )
    ],
    priority=100,
    confidence_threshold=0.85
)

# Add rule to engine
success, errors = engine.add_rule(rule)
if success:
    print("Rule added successfully")
else:
    print(f"Rule validation failed: {errors}")
```

## Alerting Configuration

### Email Alerts

```python
from app.services.violation_reporter import get_violation_reporter, AlertConfiguration, AlertType

reporter = get_violation_reporter()

# Configure email alerts
email_config = AlertConfiguration(
    id="security-alerts",
    name="Security Team Alerts",
    alert_type=AlertType.EMAIL,
    is_enabled=True,
    severity_threshold="HIGH",
    violation_count_threshold=1,
    time_window_minutes=60,
    recipients=["security@company.com", "dlp-admin@company.com"],
    subject_template="🚨 DLP Alert: {severity} violations detected",
    body_template="""
    <h2>DLP Violation Alert</h2>
    <p><strong>Severity:</strong> {severity}</p>
    <p><strong>Violations:</strong> {violation_count}</p>
    <p><strong>Time:</strong> {timestamp}</p>
    
    <h3>Violation Details:</h3>
    {violation_details}
    """,
    max_alerts_per_hour=20,
    cooldown_minutes=15,
    metadata={
        "smtp_server": "smtp.company.com",
        "smtp_port": 587,
        "smtp_username": "dlp-alerts@company.com"
    }
)

success, errors = reporter.add_alert_configuration(email_config)
```

### Slack Alerts

```python
# Configure Slack alerts
slack_config = AlertConfiguration(
    id="slack-alerts",
    name="Slack Channel Alerts",
    alert_type=AlertType.SLACK,
    is_enabled=True,
    severity_threshold="MEDIUM",
    violation_count_threshold=3,
    time_window_minutes=30,
    recipients=["#security-alerts"],
    metadata={
        "slack_webhook_url": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
    }
)

success, errors = reporter.add_alert_configuration(slack_config)
```

## Performance Optimization

### Caching Configuration

```python
from app.services.real_time_scanner import get_real_time_scanner

scanner = get_real_time_scanner()

# The scanner automatically caches results based on content hash
# Cache configuration in environment variables:
# CACHE_ENABLED=true
# CACHE_TTL_SECONDS=3600
# CACHE_MAX_SIZE=10000

# Pre-warm cache with common patterns
common_patterns = [
    "john.smith@example.com",
    "555-123-4567",
    "123-45-6789"
]

for pattern in common_patterns:
    # This will cache the results for future identical scans
    scanner.scan_content(
        request=ScanRequest(content=pattern),
        tenant_id="default"
    )
```

### Batch Processing

```python
# Process multiple items efficiently
items = [
    {"content": content1, "content_type": "text/plain"},
    {"content": content2, "content_type": "text/plain"},
    # ... more items
]

batch_result = scanner.scan_batch(
    requests=[ScanRequest(**item) for item in items],
    tenant_id="default",
    priority="MEDIUM"
)

print(f"Processed {len(items)} items in {batch_result.total_duration_ms}ms")
```

## Monitoring & Metrics

### Health Checks

```bash
# Overall health
curl http://localhost:8003/api/v1/health/status

# Readiness probe
curl http://localhost:8003/api/v1/health/readiness

# Liveness probe
curl http://localhost:8003/api/v1/health/live
```

### Prometheus Metrics

```bash
# Get Prometheus metrics
curl http://localhost:8003/api/v1/metrics/prometheus

# Key metrics to monitor:
# - dlp_requests_total: Total API requests
# - dlp_request_duration_seconds: Request latency
# - dlp_scan_duration_seconds: Scan processing time
# - dlp_violations_total: Violations detected
# - dlp_health_check_status: Component health status
```

### Dashboard Metrics

```python
# Get comprehensive dashboard metrics
import httpx

response = httpx.get("http://localhost:8003/api/v1/metrics/dashboard")
metrics = response.json()

print(f"Service Status: {metrics['overview']['service_status']}")
print(f"Total Scans Today: {metrics['key_metrics']['total_scans_today']}")
print(f"Violations Detected: {metrics['key_metrics']['violations_detected_today']}")
print(f"Average Scan Time: {metrics['key_metrics']['average_scan_time_ms']}ms")
print(f"Current Queue Size: {metrics['key_metrics']['current_queue_size']}")
```

## Compliance

### GDPR Compliance

The DLP system includes built-in GDPR compliance features:

- **Data Minimization**: Only scans necessary content
- **Purpose Limitation**: Configurable scanning purposes per tenant
- **Storage Limitation**: Configurable data retention periods
- **Accuracy**: Regular validation and false positive monitoring
- **Security**: Encryption and access controls
- **Accountability**: Complete audit logging

### HIPAA Compliance

```python
# Configure HIPAA compliance rules
hipaa_rule = DLPRuleDefinition(
    id="hipaa-phi-detection",
    name="HIPAA PHI Detection",
    description="Detect Protected Health Information",
    rule_type="presidio",
    conditions=[
        RuleCondition(
            field="presidio_results.entities",
            operator="CONTAINS",
            value="MEDICAL_RECORD"
        )
    ],
    actions=[
        RuleAction(
            action_type="VIOLATION",
            violation_type="HIPAA_PHI",
            severity="HIGH"
        ),
        RuleAction(
            action_type="ALERT",
            alert_recipients=["hipaa-compliance@company.com"]
        )
    ],
    priority=200,  # High priority for compliance
    confidence_threshold=0.9
)
```

## Testing

### Unit Tests

```bash
# Run all tests
pytest tests/

# Run specific test suite
pytest tests/test_presidio_detector.py

# Run with coverage
pytest --cov=app tests/
```

### Integration Tests

```python
# Example integration test
import pytest
import httpx

@pytest.mark.asyncio
async def test_complete_dlp_flow():
    """Test complete DLP scanning flow"""
    
    # Test content with multiple violation types
    test_content = """
    Patient: John Smith
    Email: john.smith@hospital.com
    Phone: 555-123-4567
    SSN: 123-45-6789
    Credit Card: 4111-1111-1111-1111
    """
    
    async with httpx.AsyncClient() as client:
        # Scan content
        response = await client.post(
            "http://localhost:8003/api/v1/scans",
            json={
                "content": test_content,
                "content_type": "text/plain",
                "policies": ["hipaa-policy", "pci-policy"]
            }
        )
        
        assert response.status_code == 200
        result = response.json()
        
        # Verify violations detected
        assert result["total_violations"] >= 5
        assert "EMAIL_ADDRESS" in result["violations_by_type"]
        assert "PHONE_NUMBER" in result["violations_by_type"]
        assert "US_SSN" in result["violations_by_type"]
        assert "CREDIT_CARD" in result["violations_by_type"]
        
        # Verify risk assessment
        assert result["risk_level"] in ["HIGH", "CRITICAL"]
        assert result["risk_score"] > 0.8
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**:
   - Reduce cache size: `CACHE_MAX_SIZE=1000`
   - Enable content size limits: `MAX_CONTENT_SIZE_MB=50`
   - Monitor with `/api/v1/metrics/dashboard`

2. **Slow Scanning Performance**:
   - Check scanner statistics: `/api/v1/metrics/components`
   - Optimize regex patterns to avoid catastrophic backtracking
   - Enable parallel processing: `PARALLEL_SCANNING_ENABLED=true`

3. **False Positives**:
   - Adjust confidence thresholds: `PRESIDIO_CONFIDENCE_THRESHOLD=0.9`
   - Review and refine custom patterns
   - Use the pattern testing API

4. **Alert Fatigue**:
   - Configure appropriate cooldown periods
   - Adjust violation count thresholds
   - Use severity-based filtering

### Debug Mode

```bash
# Enable debug logging
DLP_LOG_LEVEL=DEBUG python main.py

# Check component health
curl http://localhost:8003/api/v1/health/status

# Get detailed metrics
curl http://localhost:8003/api/v1/metrics/components
```

## Contributing

### Development Setup

```bash
# Clone repository
git clone https://github.com/finsavvyai/sdlc-platform.git
cd platform/services/dlp

# Install development dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run linting
ruff check .
mypy app/

# Run security scan
bandit -r app/
```

### Code Style

- Use `ruff` for linting
- Use `mypy` for type checking
- Write comprehensive tests
- Follow PEP 8 guidelines
- Add docstrings for all public functions

### Pull Request Process

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Ensure all tests pass
5. Submit pull request with description

## License

This project is licensed under AGPL-3.0-or-later — see the [LICENSE](../../LICENSE) file. Commercial-license buy-out available at $4K/seat/yr — see [COMMERCIAL.md](../../COMMERCIAL.md).

## Support

- **Documentation**: [docs.sdlc.cc](https://docs.sdlc.cc)
- **Issues**: [GitHub Issues](https://github.com/finsavvyai/sdlc-platform/issues)
- **Discussions**: [GitHub Discussions](https://github.com/finsavvyai/sdlc-platform/discussions)
- **Email**: support@sdlc.cc

## Changelog

### Version 1.0.0
- Initial release of DLP scanning pipeline
- Presidio PII detection integration
- Advanced regex pattern matching engine
- ML-based content classification
- Custom rule engine with complex composition
- Real-time scanning service
- Comprehensive violation reporting
- Multi-tenant system with isolation
- Full REST API with OpenAPI documentation
- Production-ready with monitoring and alerting

---

Built with ❤️ by the SDLC.ai Team