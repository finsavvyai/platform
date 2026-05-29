"""
Core configuration settings for SDLC.ai DLP Service.

This module manages all configuration parameters for the DLP scanning pipeline,
including Presidio integration, ML models, regex patterns, and multi-tenant settings.
"""

import os
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class DLPCoreConfig(BaseSettings):
    """Core DLP service configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="DLP_",
        case_sensitive=False,
    )

    # Service Configuration
    service_name: str = "sdlc-dlp"
    service_version: str = "1.0.0"
    environment: str = Field(default="development", env="ENVIRONMENT")
    debug: bool = Field(default=False, env="DEBUG")

    # API Configuration
    host: str = Field(default="0.0.0.0", env="DLP_HOST")
    port: int = Field(default=8003, env="DLP_PORT")
    workers: int = Field(default=4, env="DLP_WORKERS")
    timeout: int = Field(default=300, env="DLP_TIMEOUT")

    # Database Configuration
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/sdlc_dlp",
        env="DATABASE_URL",
    )
    database_pool_size: int = Field(default=20, env="DATABASE_POOL_SIZE")
    database_max_overflow: int = Field(default=30, env="DATABASE_MAX_OVERFLOW")

    # Redis Configuration
    redis_url: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")
    redis_cache_ttl: int = Field(default=3600, env="REDIS_CACHE_TTL")
    redis_max_connections: int = Field(default=100, env="REDIS_MAX_CONNECTIONS")

    # Security Configuration
    jwt_secret_key: str = Field(
        default="your-super-secret-jwt-key-change-in-production", env="JWT_SECRET_KEY"
    )
    jwt_algorithm: str = Field(default="HS256", env="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(
        default=30, env="JWT_ACCESS_TOKEN_EXPIRE_MINUTES"
    )

    # Presidio Configuration
    presidio_enabled: bool = Field(default=True, env="PRESIDIO_ENABLED")
    presidio_models_path: str = Field(
        default="/app/models/presidio", env="PRESIDIO_MODELS_PATH"
    )
    presidio_confidence_threshold: float = Field(
        default=0.8, env="PRESIDIO_CONFIDENCE_THRESHOLD"
    )
    presidio_languages: List[str] = Field(default=["en"], env="PRESIDIO_LANGUAGES")
    presidio_nlp_engine_name: str = Field(
        default="spacy", env="PRESIDIO_NLP_ENGINE_NAME"
    )
    presidio_spacy_model: str = Field(
        default="en_core_web_lg", env="PRESIDIO_SPACY_MODEL"
    )

    # ML Model Configuration
    ml_models_path: str = Field(default="/app/models/ml", env="ML_MODELS_PATH")
    content_classifier_model: str = Field(
        default="bert-base-uncased-finetuned-content-classification",
        env="CONTENT_CLASSIFIER_MODEL",
    )
    risk_assessment_model: str = Field(
        default="risk-assessment-v1", env="RISK_ASSESSMENT_MODEL"
    )
    model_batch_size: int = Field(default=32, env="MODEL_BATCH_SIZE")
    model_max_sequence_length: int = Field(default=512, env="MODEL_MAX_SEQUENCE_LENGTH")

    # Regex Pattern Configuration
    regex_patterns_path: str = Field(
        default="/app/config/regex_patterns.yaml", env="REGEX_PATTERNS_PATH"
    )
    custom_patterns_path: str = Field(
        default="/app/config/custom_patterns.yaml", env="CUSTOM_PATTERNS_PATH"
    )
    regex_timeout_ms: int = Field(default=100, env="REGEX_TIMEOUT_MS")
    regex_max_matches: int = Field(default=1000, env="REGEX_MAX_MATCHES")

    # DLP Rules Configuration
    rules_path: str = Field(default="/app/config/dlp_rules.yaml", env="RULES_PATH")
    rule_engine_timeout_ms: int = Field(default=500, env="RULE_ENGINE_TIMEOUT_MS")
    max_rules_per_scan: int = Field(default=100, env="MAX_RULES_PER_SCAN")

    # Scanning Configuration
    max_content_size_mb: int = Field(default=100, env="MAX_CONTENT_SIZE_MB")
    max_scan_duration_ms: int = Field(default=30000, env="MAX_SCAN_DURATION_MS")
    parallel_scanning_enabled: bool = Field(
        default=True, env="PARALLEL_SCANNING_ENABLED"
    )
    max_parallel_scans: int = Field(default=10, env="MAX_PARALLEL_SCANS")

    # Performance Configuration
    cache_enabled: bool = Field(default=True, env="CACHE_ENABLED")
    cache_ttl_seconds: int = Field(default=3600, env="CACHE_TTL_SECONDS")
    cache_max_size: int = Field(default=10000, env="CACHE_MAX_SIZE")
    metrics_enabled: bool = Field(default=True, env="METRICS_ENABLED")
    metrics_port: int = Field(default=9093, env="METRICS_PORT")

    # Multi-tenant Configuration
    multi_tenant_enabled: bool = Field(default=True, env="MULTI_TENANT_ENABLED")
    default_tenant_id: str = Field(default="default", env="DEFAULT_TENANT_ID")
    tenant_config_path: str = Field(
        default="/app/config/tenants.yaml", env="TENANT_CONFIG_PATH"
    )

    # Violation Reporting Configuration
    violation_retention_days: int = Field(default=365, env="VIOLATION_RETENTION_DAYS")
    alert_webhook_url: Optional[str] = Field(default=None, env="ALERT_WEBHOOK_URL")
    email_alerts_enabled: bool = Field(default=False, env="EMAIL_ALERTS_ENABLED")
    smtp_server: Optional[str] = Field(default=None, env="SMTP_SERVER")
    smtp_port: int = Field(default=587, env="SMTP_PORT")
    smtp_username: Optional[str] = Field(default=None, env="SMTP_USERNAME")
    smtp_password: Optional[str] = Field(default=None, env="SMTP_PASSWORD")

    # Logging Configuration
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_format: str = Field(default="json", env="LOG_FORMAT")
    log_file: Optional[str] = Field(default=None, env="LOG_FILE")

    # OpenTelemetry Configuration
    otel_enabled: bool = Field(default=True, env="OTEL_ENABLED")
    otel_service_name: str = Field(default="sdlc-dlp", env="OTEL_SERVICE_NAME")
    otel_endpoint: str = Field(default="http://localhost:4317", env="OTEL_ENDPOINT")
    otel_headers: Optional[str] = Field(default=None, env="OTEL_HEADERS")

    # Compliance Configuration
    gdpr_enabled: bool = Field(default=True, env="GDPR_ENABLED")
    hipaa_enabled: bool = Field(default=False, env="HIPAA_ENABLED")
    ccpa_enabled: bool = Field(default=True, env="CCPA_ENABLED")
    pci_dss_enabled: bool = Field(default=False, env="PCI_DSS_ENABLED")

    # Content Processing Configuration
    supported_languages: List[str] = Field(
        default=["en", "es", "fr", "de", "it", "pt", "nl", "sv", "no", "da"],
        env="SUPPORTED_LANGUAGES",
    )
    default_language: str = Field(default="en", env="DEFAULT_LANGUAGE")

    # API Configuration
    api_prefix: str = Field(default="/api/v1", env="API_PREFIX")
    cors_origins: List[str] = Field(default=["http://localhost:3000"], env="CORS_ORIGINS")
    rate_limit_enabled: bool = Field(default=True, env="RATE_LIMIT_ENABLED")
    rate_limit_requests_per_minute: int = Field(
        default=100, env="RATE_LIMIT_REQUESTS_PER_MINUTE"
    )

    # Testing Configuration
    test_mode: bool = Field(default=False, env="TEST_MODE")
    mock_ml_models: bool = Field(default=False, env="MOCK_ML_MODELS")
    bypass_auth_for_testing: bool = Field(default=False, env="BYPASS_AUTH_FOR_TESTING")


class PresidioConfig(DLPCoreConfig):
    """Presidio-specific configuration."""

    # Entity Types Configuration
    supported_entities: List[str] = Field(
        default=[
            "PERSON",
            "EMAIL_ADDRESS",
            "PHONE_NUMBER",
            "IBAN_CODE",
            "CREDIT_CARD",
            "IP_ADDRESS",
            "LOCATION",
            "DATE_TIME",
            "NRP",  # National Registration Number
            "URL",
            "US_BANK_NUMBER",
            "US_DRIVER_LICENSE",
            "US_ITIN",
            "US_PASSPORT",
            "US_SSN",
            "UK_NHS",
            "AU_ABN",
            "AU_ACN",
            "AU_TFN",
            "AU_MEDICARE",
            "SG_NRIC_FIN",
            "IN_PAN",
            "IN_AADHAAR",
            "IN_VOTER",
            "IN_PASSPORT",
            "IN_DRIVING_LICENSE",
        ],
        env="SUPPORTED_ENTITIES",
    )

    # Custom Recognizers Configuration
    custom_recognizers_path: str = Field(
        default="/app/config/custom_recognizers.yaml", env="CUSTOM_RECOGNIZERS_PATH"
    )
    recognizer_confidence_threshold: float = Field(
        default=0.7, env="RECOGNIZER_CONFIDENCE_THRESHOLD"
    )

    # Anonymization Configuration
    anonymization_enabled: bool = Field(default=True, env="ANONYMIZATION_ENABLED")
    default_anonymizer: str = Field(default="replace", env="DEFAULT_ANONYMIZER")
    anonymizer_hash_salt: str = Field(
        default="default-salt-change-in-production", env="ANONYMIZER_HASH_SALT"
    )


class MLConfig(DLPCoreConfig):
    """Machine Learning models configuration."""

    # Content Classification Models
    content_classification_threshold: float = Field(
        default=0.8, env="CONTENT_CLASSIFICATION_THRESHOLD"
    )
    content_categories: List[str] = Field(
        default=[
            "PII",
            "FINANCIAL",
            "HEALTH",
            "LEGAL",
            "CONFIDENTIAL",
            "PUBLIC",
            "INTERNAL",
            "RESTRICTED",
            "SECRET",
            "TOP_SECRET",
        ],
        env="CONTENT_CATEGORIES",
    )

    # Risk Assessment Configuration
    risk_levels: List[str] = Field(
        default=["LOW", "MEDIUM", "HIGH", "CRITICAL"], env="RISK_LEVELS"
    )
    risk_thresholds: Dict[str, float] = Field(
        default={"LOW": 0.2, "MEDIUM": 0.5, "HIGH": 0.8, "CRITICAL": 0.9},
        env="RISK_THRESHOLDS",
    )

    # Model Performance Configuration
    inference_timeout_ms: int = Field(default=5000, env="INFERENCE_TIMEOUT_MS")
    max_retry_attempts: int = Field(default=3, env="MAX_RETRY_ATTEMPTS")
    model_warmup_enabled: bool = Field(default=True, env="MODEL_WARMUP_ENABLED")


@lru_cache()
def get_settings() -> DLPCoreConfig:
    """Get cached DLP configuration settings."""
    return DLPCoreConfig()


@lru_cache()
def get_presidio_settings() -> PresidioConfig:
    """Get cached Presidio configuration settings."""
    return PresidioConfig()


@lru_cache()
def get_ml_settings() -> MLConfig:
    """Get cached ML configuration settings."""
    return MLConfig()
