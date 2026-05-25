"""
Application Configuration Management

Production-ready configuration management for RAG service with:
- Environment-specific settings
- Feature flags management
- Security configuration
- Performance tuning settings
- Dynamic configuration updates
- Configuration validation
- Configuration encryption
- Configuration auditing
"""

import os
import json
import yaml
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union, Type, Callable
from dataclasses import dataclass, field, asdict
from enum import Enum
from functools import wraps
import hashlib
import hmac
from pathlib import Path

from pydantic import BaseSettings, Field, validator, root_validator
from cryptography.fernet import Fernet

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class Environment(str, Enum):
    """Environment types"""

    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TEST = "test"


class LogLevel(str, Enum):
    """Log levels"""

    CRITICAL = "CRITICAL"
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"
    DEBUG = "DEBUG"


@dataclass
class DatabaseConfig:
    """Database configuration"""

    host: str = "localhost"
    port: int = 5432
    username: str = "postgres"
    password: str = "password"
    database: str = "sdlc_platform"
    pool_size: int = 20
    max_overflow: int = 10
    pool_timeout: int = 30
    pool_recycle: int = 3600
    echo: bool = False
    ssl_mode: str = "prefer"

    @property
    def url(self) -> str:
        """Get database URL"""
        return f"postgresql+asyncpg://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"

    @property
    def url_sync(self) -> str:
        """Get synchronous database URL"""
        return f"postgresql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"


@dataclass
class RedisConfig:
    """Redis configuration"""

    host: str = "localhost"
    port: int = 6379
    database: int = 0
    password: Optional[str] = None
    max_connections: int = 20
    socket_timeout: int = 5
    socket_connect_timeout: int = 5
    retry_on_timeout: bool = True

    @property
    def url(self) -> str:
        """Get Redis URL"""
        auth_part = f":{self.password}@" if self.password else ""
        return f"redis://{auth_part}{self.host}:{self.port}/{self.database}"


@dataclass
class VectorDBConfig:
    """Vector database configuration"""

    host: str = "localhost"
    port: int = 5432
    username: str = "postgres"
    password: str = "password"
    database: str = "sdlc_platform"
    dimensions: int = 1536
    index_type: str = "ivfflat"
    distance_metric: str = "cosine"
    ef_search: int = 64
    ef_construction: int = 128
    m: int = 16

    @property
    def url(self) -> str:
        """Get vector database URL"""
        return f"postgresql+asyncpg://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"


@dataclass
class OpenAIConfig:
    """OpenAI configuration"""

    api_key: Optional[str] = None
    organization: Optional[str] = None
    base_url: Optional[str] = None
    timeout: int = 30
    max_retries: int = 3
    model: str = "gpt-3.5-turbo"
    embedding_model: str = "text-embedding-ada-002"
    max_tokens: int = 4096
    temperature: float = 0.7


@dataclass
class AnthropicConfig:
    """Anthropic configuration"""

    api_key: Optional[str] = None
    base_url: Optional[str] = None
    timeout: int = 30
    max_retries: int = 3
    model: str = "claude-3-sonnet-20240229"
    max_tokens: int = 4096


@dataclass
class SentenceTransformersConfig:
    """Sentence Transformers configuration"""

    model_name: str = "all-MiniLM-L6-v2"
    device: str = "cpu"
    cache_folder: Optional[str] = None
    use_pytorch: bool = True
    normalize_embeddings: bool = True


@dataclass
class SecurityConfig:
    """Security configuration"""

    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    password_min_length: int = 8
    password_require_uppercase: bool = True
    password_require_lowercase: bool = True
    password_require_numbers: bool = True
    password_require_symbols: bool = True
    max_login_attempts: int = 5
    lockout_duration_minutes: int = 15
    enable_2fa: bool = False

    def encrypt_sensitive_data(self, data: str) -> str:
        """Encrypt sensitive data"""
        key = self.secret_key.encode()
        # Use first 32 bytes for Fernet key
        fernet_key = hashlib.sha256(key).digest()
        cipher = Fernet(Fernet(fernet_key))
        return cipher.encrypt(data.encode()).decode()

    def decrypt_sensitive_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        key = self.secret_key.encode()
        fernet_key = hashlib.sha256(key).digest()
        cipher = Fernet(Fernet(fernet_key))
        return cipher.decrypt(encrypted_data.encode()).decode()


@dataclass
class PerformanceConfig:
    """Performance configuration"""

    # Cache settings
    cache_ttl_seconds: int = 3600
    cache_max_size: int = 1000
    enable_redis_cache: bool = True

    # Connection pooling
    db_pool_size: int = 20
    db_max_overflow: int = 10
    redis_max_connections: int = 20

    # Batch processing
    batch_size: int = 100
    batch_timeout_seconds: int = 30
    max_concurrent_batches: int = 5

    # Request handling
    max_concurrent_requests: int = 1000
    request_timeout_seconds: int = 60

    # Memory management
    memory_threshold_mb: int = 1024
    gc_interval_seconds: int = 300

    # Response compression
    enable_compression: bool = True
    compression_min_size: int = 1000


@dataclass
class MonitoringConfig:
    """Monitoring configuration"""

    enabled: bool = True
    prometheus_port: int = 9090
    metrics_path: str = "/metrics"
    health_check_path: str = "/health"
    jaeger_endpoint: Optional[str] = None
    sentry_dsn: Optional[str] = None
    log_level: LogLevel = LogLevel.INFO
    log_format: str = "json"
    log_file_path: Optional[str] = None

    # Alerting
    alert_webhook_url: Optional[str] = None
    alert_webhook_secret: Optional[str] = None
    high_error_rate_threshold: float = 0.05
    high_response_time_threshold_ms: float = 5000

    # Retention
    metrics_retention_days: int = 30
    log_retention_days: int = 7


@dataclass
class FeatureFlags:
    """Feature flags configuration"""

    # Core features
    rag_pipeline: bool = True
    document_upload: bool = True
    batch_processing: bool = True
    streaming: bool = True
    query_understanding: bool = True
    context_assembly: bool = True
    quality_assessment: bool = True
    citation_processing: bool = True

    # Advanced features
    hybrid_search: bool = True
    semantic_search: bool = True
    vector_reranking: bool = True
    query_expansion: bool = True
    personalization: bool = True

    # Experimental features
    multi_modal_rag: bool = False
    graph_rag: bool = False
    real_time_collaboration: bool = False
    advanced_analytics: bool = False

    # System features
    rate_limiting: bool = True
    monitoring: bool = True
    caching: bool = True
    compression: bool = True
    dlp_scanning: bool = True


@dataclass
class AppConfig:
    """Main application configuration"""

    # Basic settings
    app_name: str = "SDLC RAG Service"
    app_version: str = "1.0.0"
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1

    # Component configurations
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    redis: RedisConfig = field(default_factory=RedisConfig)
    vector_db: VectorDBConfig = field(default_factory=VectorDBConfig)
    openai: OpenAIConfig = field(default_factory=OpenAIConfig)
    anthropic: AnthropicConfig = field(default_factory=AnthropicConfig)
    sentence_transformers: SentenceTransformersConfig = field(
        default_factory=SentenceTransformersConfig
    )
    security: SecurityConfig = field(
        default_factory=lambda: SecurityConfig(
            secret_key=os.environ.get("SECRET_KEY", "")
        )
    )
    performance: PerformanceConfig = field(default_factory=PerformanceConfig)
    monitoring: MonitoringConfig = field(default_factory=MonitoringConfig)
    feature_flags: FeatureFlags = field(default_factory=FeatureFlags)

    # CORS settings
    cors_origins: List[str] = field(default_factory=lambda: ["http://localhost:3000"])
    cors_methods: List[str] = field(
        default_factory=lambda: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    )
    cors_headers: List[str] = field(default_factory=lambda: ["Accept", "Authorization", "Content-Type", "X-Request-ID"])
    cors_allow_credentials: bool = True

    # File storage settings
    storage_type: str = "r2"
    max_file_size: int = 50 * 1024 * 1024  # 50MB
    allowed_file_types: List[str] = field(
        default_factory=lambda: [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
            "text/plain",
            "text/html",
            "text/markdown",
            "application/json",
            "text/csv",
        ]
    )

    # DLP settings
    dlp_enabled: bool = True
    presidio_server_url: str = "http://localhost:5000"
    dlp_confidence_threshold: float = 0.8
    dlp_timeout: int = 10

    # Metadata
    config_version: str = "1.0"
    config_updated_at: datetime = field(default_factory=datetime.utcnow)
    config_hash: Optional[str] = None

    def __post_init__(self):
        """Post-initialization processing"""
        # Adjust settings based on environment
        self._adjust_for_environment()

        # Calculate config hash
        self._calculate_config_hash()

        # Validate configuration
        self._validate_config()

    def _adjust_for_environment(self) -> None:
        """Adjust settings based on environment"""
        if self.environment == Environment.PRODUCTION:
            self.debug = False
            self.workers = 4
            self.monitoring.enabled = True
            self.monitoring.log_level = LogLevel.WARNING
            self.performance.cache_ttl_seconds = 7200
            self.performance.cache_max_size = 5000

        elif self.environment == Environment.STAGING:
            self.debug = False
            self.workers = 2
            self.monitoring.enabled = True
            self.monitoring.log_level = LogLevel.INFO

        elif self.environment == Environment.DEVELOPMENT:
            self.debug = True
            self.workers = 1
            self.monitoring.enabled = True
            self.monitoring.log_level = LogLevel.DEBUG
            self.feature_flags.multi_modal_rag = True
            self.feature_flags.graph_rag = True

        elif self.environment == Environment.TEST:
            self.debug = False
            self.workers = 1
            self.monitoring.enabled = False
            self.dlp_enabled = False

    def _calculate_config_hash(self) -> None:
        """Calculate configuration hash for integrity checking"""
        config_dict = asdict(self)
        # Remove dynamic fields from hash calculation
        config_dict.pop("config_updated_at", None)
        config_dict.pop("config_hash", None)

        config_json = json.dumps(config_dict, sort_keys=True, default=str)
        self.config_hash = hashlib.sha256(config_json.encode()).hexdigest()

    def _validate_config(self) -> None:
        """Validate configuration"""
        # Validate required fields
        if not self.security.secret_key or self.security.secret_key in ("default-secret", "your-secret-key"):
            raise ValueError(
                "SECRET_KEY environment variable must be set. "
                "No default or placeholder secret keys are allowed."
            )

        # Validate ports
        if not (1 <= self.port <= 65535):
            raise ValueError(f"Invalid port number: {self.port}")

        # Validate database configuration
        if self.environment == Environment.PRODUCTION:
            if not self.database.password or self.database.password == "password":
                raise ValueError("Database password must be set in production")

        # Validate feature flags
        self._validate_feature_flags()

    def _validate_feature_flags(self) -> None:
        """Validate feature flag dependencies"""
        # rag_pipeline dependency
        if self.feature_flags.rag_pipeline:
            required_flags = ["query_understanding", "context_assembly"]
            for flag in required_flags:
                if not getattr(self.feature_flags, flag):
                    logger.warning(
                        f"Feature '{flag}' should be enabled when 'rag_pipeline' is enabled"
                    )

        # streaming dependency
        if self.feature_flags.streaming and not self.feature_flags.rag_pipeline:
            logger.warning("'streaming' feature requires 'rag_pipeline' to be enabled")

    def update_feature_flag(self, flag_name: str, enabled: bool) -> None:
        """Update a feature flag"""
        if hasattr(self.feature_flags, flag_name):
            old_value = getattr(self.feature_flags, flag_name)
            setattr(self.feature_flags, flag_name, enabled)

            logger.info(f"Feature flag '{flag_name}' updated: {old_value} -> {enabled}")

            # Re-validate feature flags
            self._validate_feature_flags()

            # Update config hash
            self._calculate_config_hash()
        else:
            raise ValueError(f"Unknown feature flag: {flag_name}")

    def update_config(self, updates: Dict[str, Any]) -> None:
        """Update configuration with validation"""
        for key, value in updates.items():
            if hasattr(self, key):
                setattr(self, key, value)
            else:
                raise ValueError(f"Unknown configuration key: {key}")

        # Re-adjust for environment
        self._adjust_for_environment()

        # Re-validate configuration
        self._validate_config()

        # Update timestamp and hash
        self.config_updated_at = datetime.utcnow()
        self._calculate_config_hash()

        logger.info(f"Configuration updated: {list(updates.keys())}")

    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary"""
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        """Convert configuration to JSON string"""
        return json.dumps(self.to_dict(), indent=indent, default=str)

    def save_to_file(self, file_path: Union[str, Path]) -> None:
        """Save configuration to file"""
        file_path = Path(file_path)

        if file_path.suffix.lower() == ".yaml" or file_path.suffix.lower() == ".yml":
            content = yaml.dump(self.to_dict(), default_flow_style=False)
        else:
            content = self.to_json()

        file_path.write_text(content)
        logger.info(f"Configuration saved to {file_path}")

    @classmethod
    def from_file(cls, file_path: Union[str, Path]) -> "AppConfig":
        """Load configuration from file"""
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {file_path}")

        content = file_path.read_text()

        if file_path.suffix.lower() in [".yaml", ".yml"]:
            config_dict = yaml.safe_load(content)
        else:
            config_dict = json.loads(content)

        return cls(**config_dict)

    @classmethod
    def from_env(cls) -> "AppConfig":
        """Load configuration from environment variables"""
        # This would load from environment variables with proper parsing
        # For now, create default config and update from environment
        config = cls()

        # Override with environment variables
        env_mappings = {
            "APP_NAME": ("app_name", str),
            "APP_VERSION": ("app_version", str),
            "ENVIRONMENT": ("environment", Environment),
            "DEBUG": ("debug", bool),
            "HOST": ("host", str),
            "PORT": ("port", int),
            "WORKERS": ("workers", int),
            "SECRET_KEY": ("security.secret_key", str),
            "DATABASE_URL": ("database.url", str),
            "REDIS_URL": ("redis.url", str),
            "OPENAI_API_KEY": ("openai.api_key", str),
            "ANTHROPIC_API_KEY": ("anthropic.api_key", str),
            "ENABLE_MONITORING": ("monitoring.enabled", bool),
            "LOG_LEVEL": ("monitoring.log_level", LogLevel),
        }

        for env_var, (config_path, value_type) in env_mappings.items():
            env_value = os.getenv(env_var)
            if env_value is not None:
                try:
                    # Parse value based on type
                    if value_type == bool:
                        parsed_value = env_value.lower() in ("true", "1", "yes", "on")
                    elif value_type == int:
                        parsed_value = int(env_value)
                    elif value_type == Environment:
                        parsed_value = Environment(env_value.lower())
                    elif value_type == LogLevel:
                        parsed_value = LogLevel(env_value.upper())
                    else:
                        parsed_value = env_value

                    # Set nested attribute
                    obj = config
                    for attr in config_path.split(".")[:-1]:
                        obj = getattr(obj, attr)
                    setattr(obj, config_path.split(".")[-1], parsed_value)

                except (ValueError, AttributeError) as e:
                    logger.warning(f"Failed to parse {env_var}={env_value}: {e}")

        return config

    def mask_sensitive_data(self, config_dict: Dict[str, Any] = None) -> Dict[str, Any]:
        """Mask sensitive data for logging/exporting"""
        if config_dict is None:
            config_dict = self.to_dict()

        sensitive_keys = [
            "secret_key",
            "password",
            "api_key",
            "private_key",
            "token",
            "dsn",
            "connection_string",
            "webhook_secret",
        ]

        def mask_value(key: str, value: Any) -> Any:
            if isinstance(value, dict):
                return {k: mask_value(k, v) for k, v in value.items()}
            elif isinstance(value, list):
                return [mask_value(key, item) for item in value]
            elif any(sensitive in key.lower() for sensitive in sensitive_keys):
                return "***MASKED***"
            else:
                return value

        return mask_value("", config_dict)


class ConfigManager:
    """Configuration manager with validation and updates"""

    def __init__(self):
        self._config: Optional[AppConfig] = None
        self._config_file_path: Optional[Path] = None
        self._update_callbacks: List[Callable[[AppConfig], None]] = []
        self._validation_callbacks: List[Callable[[AppConfig], bool]] = []

    def initialize(
        self, config_source: Union[str, Path, Dict[str, Any], None] = None
    ) -> AppConfig:
        """Initialize configuration from various sources"""
        if config_source is None:
            # Load from environment
            self._config = AppConfig.from_env()
        elif isinstance(config_source, (str, Path)):
            # Load from file
            self._config = AppConfig.from_file(config_source)
            self._config_file_path = Path(config_source)
        elif isinstance(config_source, dict):
            # Load from dictionary
            self._config = AppConfig(**config_source)
        else:
            raise ValueError(f"Invalid config source type: {type(config_source)}")

        # Run validation callbacks
        self._validate_configuration(self._config)

        logger.info(
            f"Configuration initialized for environment: {self._config.environment}"
        )
        return self._config

    def get_config(self) -> AppConfig:
        """Get current configuration"""
        if self._config is None:
            raise RuntimeError("Configuration not initialized")
        return self._config

    def update_config(self, updates: Dict[str, Any]) -> None:
        """Update configuration with validation"""
        if self._config is None:
            raise RuntimeError("Configuration not initialized")

        old_config = self._config.to_dict()

        try:
            # Apply updates
            self._config.update_config(updates)

            # Validate new configuration
            self._validate_configuration(self._config)

            # Save to file if available
            if self._config_file_path:
                self._config.save_to_file(self._config_file_path)

            # Trigger update callbacks
            for callback in self._update_callbacks:
                try:
                    callback(self._config)
                except Exception as e:
                    logger.error(f"Config update callback failed: {e}")

            logger.info(f"Configuration updated successfully: {list(updates.keys())}")

        except Exception as e:
            # Rollback on error
            logger.error(f"Configuration update failed, rolling back: {e}")
            try:
                self._config = AppConfig(**old_config)
            except Exception as rollback_error:
                logger.error(f"Failed to rollback configuration: {rollback_error}")

            raise

    def reload_config(self) -> None:
        """Reload configuration from file"""
        if self._config_file_path and self._config_file_path.exists():
            old_config = self._config.to_dict() if self._config else {}

            try:
                self._config = AppConfig.from_file(self._config_file_path)
                self._validate_configuration(self._config)

                logger.info("Configuration reloaded successfully")

            except Exception as e:
                logger.error(f"Failed to reload configuration: {e}")
                if old_config:
                    self._config = AppConfig(**old_config)
                raise
        else:
            logger.warning("No configuration file available for reloading")

    def add_update_callback(self, callback: Callable[[AppConfig], None]) -> None:
        """Add configuration update callback"""
        self._update_callbacks.append(callback)

    def add_validation_callback(self, callback: Callable[[AppConfig], bool]) -> None:
        """Add configuration validation callback"""
        self._validation_callbacks.append(callback)

    def _validate_configuration(self, config: AppConfig) -> None:
        """Run all validation callbacks"""
        for callback in self._validation_callbacks:
            try:
                if not callback(config):
                    raise ValueError(
                        f"Configuration validation failed: {callback.__name__}"
                    )
            except Exception as e:
                logger.error(f"Configuration validation callback failed: {e}")
                raise


# Global configuration manager
_config_manager: Optional[ConfigManager] = None


def get_config_manager() -> ConfigManager:
    """Get global configuration manager"""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager


def get_app_config() -> AppConfig:
    """Get application configuration"""
    manager = get_config_manager()
    return manager.get_config()


# Configuration decorators
def validate_config(config_class: Type[BaseSettings]):
    """Decorator to validate configuration classes"""

    def decorator(cls):
        @wraps(cls)
        def wrapper(*args, **kwargs):
            try:
                instance = cls(*args, **kwargs)
                # Run validation
                instance.dict()  # This triggers pydantic validation
                return instance
            except Exception as e:
                logger.error(f"Configuration validation failed: {e}")
                raise

        return wrapper

    return decorator


def require_feature_flag(flag_name: str):
    """Decorator to require a feature flag to be enabled"""

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            config = get_app_config()
            if not getattr(config.feature_flags, flag_name, False):
                raise HTTPException(
                    status_code=503, detail=f"Feature '{flag_name}' is not enabled"
                )
            return (
                await func(*args, **kwargs)
                if asyncio.iscoroutinefunction(func)
                else func(*args, **kwargs)
            )

        return wrapper

    return decorator


# Utility functions
async def load_configuration(config_path: Optional[str] = None) -> AppConfig:
    """Load and initialize configuration"""
    manager = get_config_manager()

    if config_path:
        config_source = Path(config_path)
    else:
        config_source = None

    return await asyncio.get_event_loop().run_in_executor(
        None, manager.initialize, config_source
    )


def export_config(mask_sensitive: bool = True) -> Dict[str, Any]:
    """Export current configuration"""
    config = get_app_config()
    config_dict = config.to_dict()

    if mask_sensitive:
        config_dict = config.mask_sensitive_data(config_dict)

    return config_dict


def get_config_hash() -> Optional[str]:
    """Get current configuration hash"""
    config = get_app_config()
    return config.config_hash


# Default validation callbacks
async def validate_database_config(config: AppConfig) -> bool:
    """Validate database configuration"""
    try:
        # Test database connection
        from app.database.connection import test_connection

        return await test_connection(config.database.url)
    except Exception as e:
        logger.error(f"Database configuration validation failed: {e}")
        return False


async def validate_redis_config(config: AppConfig) -> bool:
    """Validate Redis configuration"""
    try:
        # Test Redis connection
        redis = aioredis.from_url(config.redis.url)
        await redis.ping()
        await redis.close()
        return True
    except Exception as e:
        logger.error(f"Redis configuration validation failed: {e}")
        return False


# Configuration monitoring
def setup_config_monitoring() -> None:
    """Setup configuration monitoring and validation"""
    manager = get_config_manager()

    # Add validation callbacks
    manager.add_validation_callback(
        lambda config: bool(validate_database_config(config))
    )
    manager.add_validation_callback(lambda config: bool(validate_redis_config(config)))

    logger.info("Configuration monitoring setup complete")
