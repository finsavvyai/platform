"""
Context Configuration Module

Comprehensive configuration management for context retrieval,
assembly, quality monitoring, and RAG pipeline settings with
environment-specific overrides and validation.
"""

import os
import logging
from datetime import timedelta
from typing import Dict, Any, Optional, List, Union
from dataclasses import dataclass, field
from enum import Enum
import json
import yaml

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class Environment(str, Enum):
    """Deployment environments"""

    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"


class LogLevel(str, Enum):
    """Logging levels"""

    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ModelProvider(str, Enum):
    """AI model providers"""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    HUGGINGFACE = "huggingface"
    LOCAL = "local"
    COHERE = "cohere"


@dataclass
class DatabaseConfig:
    """Database configuration settings"""

    # Connection settings
    host: str = field(default="localhost")
    port: int = field(default=5432)
    database: str = field(default="sdlc_rag")
    username: str = field(default="postgres")
    password: str = field(default="")

    # Pool settings
    pool_size: int = field(default=20)
    max_overflow: int = field(default=30)
    pool_timeout: int = field(default=30)
    pool_recycle: int = field(default=3600)

    # Query settings
    query_timeout: int = field(default=30)
    statement_timeout: int = field(default=30)

    # SSL settings
    ssl_mode: str = field(default="prefer")
    ssl_cert_path: Optional[str] = None
    ssl_key_path: Optional[str] = None
    ssl_ca_path: Optional[str] = None

    # Connection retry
    max_retries: int = field(default=3)
    retry_delay: float = field(default=1.0)


@dataclass
class VectorStoreConfig:
    """Vector store configuration"""

    # Vector database type
    vector_store_type: str = field(default="pgvector")  # pgvector, pinecone, weaviate, chroma, milvus

    # Connection settings
    host: str = field(default="localhost")
    port: int = field(default=6333)
    index_name: str = field(default="document_embeddings")

    # Dimension settings
    embedding_dimensions: int = field(default=1536)
    distance_metric: str = field(default="cosine")  # cosine, euclidean, manhattan, dotproduct

    # Index settings
    ef_construction: int = field(default=128)  # HNSW index parameter
    ef_search: int = field(default=64)  # HNSW search parameter
    m: int = field(default=16)  # HNSW connections parameter

    # Batch settings
    batch_size: int = field(default=100)
    index_batch_size: int = field(default=1000)

    # External vector store settings
    pinecone_api_key: Optional[str] = field(default=None)
    pinecone_environment: Optional[str] = field(default=None)
    weaviate_url: Optional[str] = field(default=None)
    weaviate_api_key: Optional[str] = field(default=None)

    # Performance settings
    max_connections: int = field(default=20)
    connection_timeout: int = field(default=30)
    read_timeout: int = field(default=30)
    write_timeout: int = field(default=30)


@dataclass
class EmbeddingConfig:
    """Embedding model configuration"""

    # Model settings
    provider: ModelProvider = field(default=ModelProvider.OPENAI)
    model_name: str = field(default="text-embedding-ada-002")
    model_version: str = field(default="v1")

    # API settings
    api_key: Optional[str] = field(default=None)
    api_base: Optional[str] = field(default=None)
    api_version: str = field(default="2023-05-15")
    organization: Optional[str] = field(default=None)

    # Performance settings
    batch_size: int = field(default=100)
    max_retries: int = field(default=3)
    retry_delay: float = field(default=1.0)
    timeout: int = field(default=30)

    # Model settings
    max_tokens: int = field(default=8192)
    temperature: float = field(default=0.0)

    # Caching settings
    enable_caching: bool = field(default=True)
    cache_ttl: int = field(default=3600)  # seconds
    cache_size: int = field(default=1000)

    # Cost optimization
    enable_cost_tracking: bool = field(default=True)
    cost_per_token: float = field(default=0.0001)  # USD
    daily_budget: float = field(default=100.0)  # USD


@dataclass
class LLMConfig:
    """Large Language Model configuration"""

    # Model settings
    provider: ModelProvider = field(default=ModelProvider.OPENAI)
    model_name: str = field(default="gpt-4")
    model_version: str = field(default="v1")

    # API settings
    api_key: Optional[str] = field(default=None)
    api_base: Optional[str] = field(default=None)
    api_version: str = field(default="2023-07-01")
    organization: Optional[str] = field(default=None)

    # Generation settings
    max_tokens: int = field(default=4096)
    temperature: float = field(default=0.7)
    top_p: float = field(default=1.0)
    frequency_penalty: float = field(default=0.0)
    presence_penalty: float = field(default=0.0)

    # Performance settings
    max_retries: int = field(default=3)
    retry_delay: float = field(default=1.0)
    timeout: int = field(default=60)

    # Streaming settings
    enable_streaming: bool = field(default=True)
    stream_chunk_size: int = field(default=512)

    # Cost optimization
    enable_cost_tracking: bool = field(default=True)
    cost_per_token: float = field(default=0.002)  # USD
    daily_budget: float = field(default=200.0)  # USD

    # Safety settings
    enable_content_filtering: bool = field(default=True)
    max_requests_per_minute: int = field(default=60)
    enable_usage_limits: bool = field(default=True)


@dataclass
class QualityThresholdsConfig:
    """Quality monitoring thresholds"""

    # Minimum quality thresholds
    min_overall_quality: float = field(default=0.5)
    min_relevance_score: float = field(default=0.6)
    min_accuracy_score: float = field(default=0.7)
    min_completeness_score: float = field(default=0.5)
    min_coherence_score: float = field(default=0.6)
    min_citation_quality: float = field(default=0.5)
    min_authority_score: float = field(default=0.5)
    min_recency_score: float = field(default=0.4)
    min_diversity_score: float = field(default=0.4)
    min_coverage_score: float = field(default=0.6)

    # Alert thresholds
    alert_thresholds: Dict[str, float] = field(default_factory=lambda: {
        "relevance": 0.4,
        "accuracy": 0.5,
        "completeness": 0.4,
        "coherence": 0.5,
        "citation_quality": 0.4,
        "authority": 0.4,
        "recency": 0.3,
        "diversity": 0.3,
        "coverage": 0.5,
        "bias": 0.7,  # Higher is worse for bias
        "consistency": 0.5,
        "clarity": 0.5,
        "conciseness": 0.4
    })

    # Performance thresholds
    max_pipeline_time_ms: float = field(default=10000.0)
    max_query_understanding_time_ms: float = field(default=1000.0)
    max_retrieval_time_ms: float = field(default=3000.0)
    max_assembly_time_ms: float = field(default=2000.0)
    max_citation_time_ms: float = field(default=1500.0)
    max_quality_assessment_time_ms: float = field(default=1000.0)

    # Trend analysis settings
    trend_analysis_window_days: int = field(default=30)
    trend_analysis_min_data_points: int = field(default=10)
    quality_decline_threshold: float = field(default=0.1)  # 10% decline triggers alert
    quality_improvement_threshold: float = field(default=0.05)  # 5% improvement for recognition


@dataclass
class RetrievalConfig:
    """Context retrieval configuration"""

    # Strategy settings
    default_strategy: str = field(default="multi_stage")
    enable_multi_stage: bool = field(default=True)
    enable_hybrid_search: bool = field(default=True)
    enable_cross_encoder_reranking: bool = field(default=True)

    # Retrieval parameters
    initial_candidate_limit: int = field(default=100)
    final_candidate_limit: int = field(default=10)
    min_relevance_score: float = field(default=0.3)
    diversity_threshold: float = field(default=0.7)

    # Multi-stage settings
    broad_search_limit: int = field(default=100)
    focused_search_limit: int = field(default=50)
    refinement_limit: int = field(default=25)

    # Reranking settings
    cross_encoder_model: str = field(default="ms-marco-MiniLM-L-6-v2")
    reranking_batch_size: int = field(default=50)
    max_rerank_candidates: int = field(default=100)

    # Personalization settings
    enable_personalization: bool = field(default=True)
    user_weight: float = field(default=0.2)
    recent_query_weight: float = field(default=0.15)
    domain_expertise_weight: float = field(default=0.1)

    # Performance settings
    enable_parallel_search: bool = field(default=True)
    max_parallel_searches: int = field(default=3)
    search_timeout_ms: int = field(default=5000)

    # Caching settings
    enable_search_cache: bool = field(default=True)
    search_cache_ttl: int = field(default=1800)  # 30 minutes
    search_cache_size: int = field(default=1000)


@dataclass
class AssemblyConfig:
    """Context assembly configuration"""

    # Strategy settings
    default_strategy: str = field(default="adaptive")
    enable_smart_ordering: bool = field(default=True)
    enable_diversity_optimization: bool = field(default=True)
    enable_citation_aware_assembly: bool = field(default=True)

    # Token management
    max_context_tokens: int = field(default=4000)
    safety_token_margin: int = field(default=200)
    max_chunk_tokens: int = field(default=1000)

    # Compression settings
    enable_compression: bool = field(default=False)
    default_compression_level: str = field(default="none")
    max_compression_ratio: float = field(default=0.5)  # Maximum 50% compression

    # Quality settings
    min_chunk_quality: float = field(default=0.3)
    prefer_high_quality_chunks: bool = field(default=True)
    quality_weight: float = field(default=0.2)

    # Coherence settings
    enable_coherence_scoring: bool = field(default=True)
    coherence_weight: float = field(default=0.3)
    transition_weight: float = field(default=0.1)

    # Redundancy removal
    enable_redundancy_removal: str = field(default="semantic_similarity")
    similarity_threshold: float = field(default=0.8)
    overlap_threshold: float = field(default=0.7)

    # Performance settings
    enable_parallel_processing: bool = field(default=True)
    max_parallel_chunks: int = field(default=10)
    assembly_timeout_ms: int = field(default=3000)


@dataclass
class CitationConfig:
    """Citation processing configuration"""

    # Extraction settings
    enable_auto_extraction: bool = field(default=True)
    extraction_patterns: List[str] = field(default_factory=lambda: [
        "doi", "arxiv", "url", "author_year", "numeric"
    ])

    # Validation settings
    enable_validation: bool = field(default=True)
    enable_external_verification: bool = field(default=True)
    validation_timeout_ms: int = field(default=5000)

    # Formatting settings
    default_styles: List[str] = field(default_factory=lambda: ["apa", "mla", "chicago"])
    enable_multiple_formats: bool = field(default=True)
    format_validation: bool = field(default=True)

    # Authority settings
    peer_reviewed_weight: float = field(default=0.4)
    official_source_weight: float = field(default=0.3)
    verified_source_weight: float = field(default=0.2)

    # Database settings
    enable_citation_database: bool = field(default=True)
    citation_cache_ttl: int = field(default=3600)  # 1 hour

    # External services
    enable_crossref_lookup: bool = field(default=True)
    crossref_api_key: Optional[str] = field(default=None)
    enable_doi_resolution: bool = field(default=True)

    # Quality settings
    min_citation_quality: float = field(default=0.5)
    required_fields_by_type: Dict[str, List[str]] = field(default_factory=lambda: {
        "journal_article": ["title", "authors", "journal", "year", "volume", "pages"],
        "book": ["title", "authors", "publisher", "year"],
        "website": ["title", "url", "accessed_date"],
        "report": ["title", "authors", "organization", "year"]
    })


@dataclass
class MonitoringConfig:
    """Monitoring and observability configuration"""

    # Logging settings
    log_level: str = field(default="info")
    log_format: str = field(default="json")
    enable_structured_logging: bool = field(default=True)
    log_rotation: bool = field(default=True)
    log_retention_days: int = field(default=30)

    # Metrics settings
    enable_metrics: bool = field(default=True)
    metrics_retention_days: int = field(default=90)
    enable_real_time_metrics: bool = field(default=True)

    # Health checks
    enable_health_checks: bool = field(default=True)
    health_check_interval: int = field(default=60)  # seconds
    enable_component_health: bool = field(default=True)

    # Alerting settings
    enable_alerts: bool = field(default=True)
    alert_webhook_url: Optional[str] = field(default=None)
    alert_email_recipients: List[str] = field(default_factory=list)

    # Performance monitoring
    enable_performance_profiling: bool = field(default=True)
    profiling_sample_rate: float = field(default=0.1)  # 10% sample rate
    max_profile_data_size: int = field(default=1000)

    # Error tracking
    enable_error_tracking: bool = field(default=True)
    error_notification_threshold: int = field(default=5)  # Errors per hour
    max_error_reports: int = field(default=100)


@dataclass
class SecurityConfig:
    """Security and compliance configuration"""

    # Authentication
    enable_authentication: bool = field(default=True)
    jwt_secret_key: str = field(default="")
    jwt_algorithm: str = field(default="HS256")
    jwt_expiration_hours: int = field(default=24)

    # Rate limiting
    enable_rate_limiting: bool = field(default=True)
    requests_per_minute: int = field(default=100)
    requests_per_hour: int = field(default=1000)
    requests_per_day: int = field(default=10000)

    # Data privacy
    enable_data_encryption: bool = field(default=True)
    encryption_key: str = field(default="")
    enable_pii_detection: bool = field(default=True)
    enable_anonymization: bool = field(default=False)

    # Content filtering
    enable_content_filtering: bool = field(default=True)
    blocked_domains: List[str] = field(default_factory=list)
    blocked_keywords: List[str] = field(default_factory=list)

    # Access control
    enable_access_control: bool = field(default=True)
    role_based_access: bool = field(default=True)
    tenant_isolation: bool = field(default=True)

    # Audit logging
    enable_audit_logging: bool = field(default=True)
    audit_log_retention_days: int = field(default=365)


@dataclass
class ContextConfig:
    """Main configuration class for context services"""

    # Environment settings
    environment: Environment = field(default=Environment.DEVELOPMENT)
    debug: bool = field(default=False)
    testing: bool = field(default=False)

    # Service configuration
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    vector_store: VectorStoreConfig = field(default_factory=VectorStoreConfig)
    embedding: EmbeddingConfig = field(default_factory=EmbeddingConfig)
    llm: LLMConfig = field(default_factory=LLMConfig)

    # RAG pipeline configuration
    quality_thresholds: QualityThresholdsConfig = field(default_factory=QualityThresholdsConfig)
    retrieval: RetrievalConfig = field(default_factory=RetrievalConfig)
    assembly: AssemblyConfig = field(default_factory=AssemblyConfig)
    citation: CitationConfig = field(default_factory=CitationConfig)

    # Cross-cutting configuration
    monitoring: MonitoringConfig = field(default_factory=MonitoringConfig)
    security: SecurityConfig = field(default_factory=SecurityConfig)

    # Custom configuration
    custom_settings: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Post-initialization validation and setup"""
        self.validate_configuration()
        self.load_environment_overrides()
        self.setup_logging()

    def validate_configuration(self):
        """Validate configuration values"""
        # Validate database configuration
        if self.database.password == "" and self.environment == Environment.PRODUCTION:
            logger.warning("Database password is empty in production environment")

        # Validate API keys
        if self.environment == Environment.PRODUCTION:
            if self.embedding.api_key is None:
                raise ValueError("Embedding API key is required in production")
            if self.llm.api_key is None:
                raise ValueError("LLM API key is required in production")
            if self.security.jwt_secret_key == "":
                raise ValueError("JWT secret key is required in production")

        # Validate thresholds
        if not 0.0 <= self.quality_thresholds.min_overall_quality <= 1.0:
            raise ValueError("min_overall_quality must be between 0 and 1")

        # Validate time limits
        if self.quality_thresholds.max_pipeline_time_ms <= 0:
            raise ValueError("max_pipeline_time_ms must be positive")

        # Validate limits
        if self.retrieval.final_candidate_limit < self.retrieval.initial_candidate_limit:
            raise ValueError("final_candidate_limit must be >= initial_candidate_limit")

    def load_environment_overrides(self):
        """Load configuration overrides from environment variables"""
        # Database overrides
        db_host = os.getenv("DATABASE_HOST")
        if db_host:
            self.database.host = db_host

        db_port = os.getenv("DATABASE_PORT")
        if db_port:
            self.database.port = int(db_port)

        db_name = os.getenv("DATABASE_NAME")
        if db_name:
            self.database.database = db_name

        db_user = os.getenv("DATABASE_USER")
        if db_user:
            self.database.username = db_user

        db_password = os.getenv("DATABASE_PASSWORD")
        if db_password:
            self.database.password = db_password

        # Vector store overrides
        vector_host = os.getenv("VECTOR_STORE_HOST")
        if vector_host:
            self.vector_store.host = vector_host

        vector_port = os.getenv("VECTOR_STORE_PORT")
        if vector_port:
            self.vector_store.port = int(vector_port)

        # API keys
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key:
            self.embedding.api_key = openai_key
            self.llm.api_key = openai_key

        anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        if anthropic_key:
            self.llm.api_key = anthropic_key

        # Security
        jwt_secret = os.getenv("JWT_SECRET_KEY")
        if jwt_secret:
            self.security.jwt_secret_key = jwt_secret

        # Custom settings
        custom_config_file = os.getenv("CUSTOM_CONFIG_FILE")
        if custom_config_file and os.path.exists(custom_config_file):
            self.load_custom_config(custom_config_file)

    def load_custom_config(self, config_file: str):
        """Load custom configuration from file"""
        try:
            with open(config_file, 'r') as f:
                custom_config = yaml.safe_load(f)
                self.custom_settings.update(custom_config)
                logger.info(f"Loaded custom configuration from {config_file}")
        except Exception as e:
            logger.error(f"Failed to load custom config from {config_file}: {e}")

    def setup_logging(self):
        """Setup logging based on configuration"""
        log_level = getattr(logging, self.monitoring.log_level.upper(), logging.INFO)

        # Configure logging
        logging.basicConfig(
            level=log_level,
            format=self.monitoring.log_format,
            handlers=[
                logging.StreamHandler(),
                logging.FileHandler('/app/logs/context_service.log'),
            ]
        )

        if self.monitoring.enable_structured_logging:
            import structlog
            structlog.configure(
                processors=[
                    structlog.stdlib.filter_by_level,
                    structlog.stdlib.add_logger_name,
                    structlog.stdlib.add_log_level,
                    structlog.stdlib.PositionalArgumentsFormatter(),
                ],
                wrapper_class=structlog.stdlib.LoggerFactory(),
                logger_factory=structlog.stdlib.LoggerFactory(),
                cache_logger_on_first_use=True,
            )

        logger.info(f"Logging configured with level: {log_level}")

    def get_database_url(self) -> str:
        """Get database connection URL"""
        if self.database.password:
            return (
                f"postgresql://{self.database.username}:{self.database.password}@"
                f"{self.database.host}:{self.database.port}/{self.database.database}"
            )
        else:
            return (
                f"postgresql://{self.database.username}@"
                f"{self.database.host}:{self.database.port}/{self.database.database}"
            )

    def get_vector_store_config(self) -> Dict[str, Any]:
        """Get vector store configuration as dictionary"""
        return {
            "type": self.vector_store.vector_store_type,
            "host": self.vector_store.host,
            "port": self.vector_store.port,
            "index_name": self.vector_store.index_name,
            "dimensions": self.vector_store.embedding_dimensions,
            "distance_metric": self.vector_store.distance_metric,
            "ef_construction": self.vector_store.ef_construction,
            "ef_search": self.vector_store.ef_search,
            "m": self.vector_store.m,
            "batch_size": self.vector_store.batch_size,
            "api_key": self.vector_store.pinecone_api_key,
            "environment": self.vector_store.pinecone_environment,
        }

    def get_embedding_config(self) -> Dict[str, Any]:
        """Get embedding configuration as dictionary"""
        return {
            "provider": self.embedding.provider.value,
            "model_name": self.embedding.model_name,
            "api_key": self.embedding.api_key,
            "api_base": self.embedding.api_base,
            "api_version": self.embedding.api_version,
            "organization": self.embedding.organization,
            "batch_size": self.embedding.batch_size,
            "max_retries": self.embedding.max_retries,
            "timeout": self.embedding.timeout,
            "max_tokens": self.embedding.max_tokens,
            "enable_caching": self.embedding.enable_caching,
            "cache_ttl": self.embedding.cache_ttl,
            "cache_size": self.embedding.cache_size,
            "enable_cost_tracking": self.embedding.enable_cost_tracking,
        }

    def get_llm_config(self) -> Dict[str, Any]:
        """Get LLM configuration as dictionary"""
        return {
            "provider": self.llm.provider.value,
            "model_name": self.llm.model_name,
            "api_key": self.llm.api_key,
            "api_base": self.llm.api_base,
            "api_version": self.llm.api_version,
            "organization": self.llm.organization,
            "max_tokens": self.llm.max_tokens,
            "temperature": self.llm.temperature,
            "top_p": self.llm.top_p,
            "frequency_penalty": self.llm.frequency_penalty,
            "presence_penalty": self.llm.presence_penalty,
            "max_retries": self.llm.max_retries,
            "timeout": self.llm.timeout,
            "enable_streaming": self.llm.enable_streaming,
            "stream_chunk_size": self.llm.stream_chunk_size,
            "enable_cost_tracking": self.llm.enable_cost_tracking,
            "enable_content_filtering": self.llm.enable_content_filtering,
        }

    def get_quality_thresholds(self) -> Dict[str, Any]:
        """Get quality thresholds as dictionary"""
        return {
            "min_overall_quality": self.quality_thresholds.min_overall_quality,
            "min_relevance_score": self.quality_thresholds.min_relevance_score,
            "min_accuracy_score": self.quality_thresholds.min_accuracy_score,
            "min_completeness_score": self.quality_thresholds.min_completeness_score,
            "min_coherence_score": self.quality_thresholds.min_coherence_score,
            "min_citation_quality": self.quality_thresholds.min_citation_quality,
            "min_authority_score": self.quality_thresholds.min_authority_score,
            "min_recency_score": self.quality_thresholds.min_recency_score,
            "min_diversity_score": self.quality_thresholds.min_diversity_score,
            "min_coverage_score": self.quality_thresholds.min_coverage_score,
            "alert_thresholds": self.quality_thresholds.alert_thresholds,
            "max_pipeline_time_ms": self.quality_thresholds.max_pipeline_time_ms,
            "trend_analysis_window_days": self.quality_thresholds.trend_analysis_window_days,
            "quality_decline_threshold": self.quality_thresholds.quality_decline_threshold,
        }

    def get_retrieval_config(self) -> Dict[str, Any]:
        """Get retrieval configuration as dictionary"""
        return {
            "default_strategy": self.retrieval.default_strategy,
            "enable_multi_stage": self.retrieval.enable_multi_stage,
            "enable_hybrid_search": self.retrieval.enable_hybrid_search,
            "enable_cross_encoder_reranking": self.retrieval.enable_cross_encoder_reranking,
            "initial_candidate_limit": self.retrieval.initial_candidate_limit,
            "final_candidate_limit": self.retrieval.final_candidate_limit,
            "min_relevance_score": self.retrieval.min_relevance_score,
            "diversity_threshold": self.retrieval.diversity_threshold,
            "broad_search_limit": self.retrieval.broad_search_limit,
            "focused_search_limit": self.retrieval.focused_search_limit,
            "refinement_limit": self.retrieval.refinement_limit,
            "cross_encoder_model": self.retrieval.cross_encoder_model,
            "reranking_batch_size": self.retrieval.reranking_batch_size,
            "max_rerank_candidates": self.retrieval.max_rerank_candidates,
            "enable_personalization": self.retrieval.enable_personalization,
            "user_weight": self.retrieval.user_weight,
            "recent_query_weight": self.retrieval.recent_query_weight,
            "domain_expertise_weight": self.retrieval.domain_expertise_weight,
            "enable_parallel_search": self.retrieval.enable_parallel_search,
            "max_parallel_searches": self.retrieval.max_parallel_searches,
            "search_timeout_ms": self.retrieval.search_timeout_ms,
            "enable_search_cache": self.retrieval.enable_search_cache,
            "search_cache_ttl": self.retrieval.search_cache_ttl,
        }

    def get_assembly_config(self) -> Dict[str, Any]:
        """Get assembly configuration as dictionary"""
        return {
            "default_strategy": self.assembly.default_strategy,
            "enable_smart_ordering": self.assembly.enable_smart_ordering,
            "enable_diversity_optimization": self.assembly.enable_diversity_optimization,
            "enable_citation_aware_assembly": self.assembly.enable_citation_aware_assembly,
            "max_context_tokens": self.assembly.max_context_tokens,
            "safety_token_margin": self.assembly.safety_token_margin,
            "max_chunk_tokens": self.assembly.max_chunk_tokens,
            "enable_compression": self.assembly.enable_compression,
            "default_compression_level": self.assembly.default_compression_level,
            "max_compression_ratio": self.assembly.max_compression_ratio,
            "min_chunk_quality": self.assembly.min_chunk_quality,
            "prefer_high_quality_chunks": self.assembly.prefer_high_quality_chunks,
            "quality_weight": self.assembly.quality_weight,
            "enable_coherence_scoring": self.assembly.enable_coherence_scoring,
            "coherence_weight": self.assembly.coherence_weight,
            "transition_weight": self.assembly.transition_weight,
            "enable_redundancy_removal": self.assembly.enable_redundancy_removal,
            "similarity_threshold": self.assembly.similarity_threshold,
            "overlap_threshold": self.assembly.overlap_threshold,
            "enable_parallel_processing": self.assembly.enable_parallel_processing,
            "max_parallel_chunks": self.assembly.max_parallel_chunks,
            "assembly_timeout_ms": self.assembly.assembly_timeout_ms,
        }

    def get_citation_config(self) -> Dict[str, Any]:
        """Get citation configuration as dictionary"""
        return {
            "enable_auto_extraction": self.citation.enable_auto_extraction,
            "extraction_patterns": self.citation.extraction_patterns,
            "enable_validation": self.citation.enable_validation,
            "enable_external_verification": self.citation.enable_external_verification,
            "validation_timeout_ms": self.citation.validation_timeout_ms,
            "default_styles": self.citation.default_styles,
            "enable_multiple_formats": self.citation.enable_multiple_formats,
            "format_validation": self.citation.format_validation,
            "peer_reviewed_weight": self.citation.peer_reviewed_weight,
            "official_source_weight": self.citation.official_source_weight,
            "verified_source_weight": self.citation.verified_source_weight,
            "enable_citation_database": self.citation.enable_citation_database,
            "citation_cache_ttl": self.citation.citation_cache_ttl,
            "enable_crossref_lookup": self.citation.enable_crossref_lookup,
            "crossref_api_key": self.citation.crossref_api_key,
            "enable_doi_resolution": self.citation.enable_doi_resolution,
            "min_citation_quality": self.citation.min_citation_quality,
            "required_fields_by_type": self.citation.required_fields_by_type,
        }

    def get_monitoring_config(self) -> Dict[str, Any]:
        """Get monitoring configuration as dictionary"""
        return {
            "log_level": self.monitoring.log_level,
            "log_format": self.monitoring.log_format,
            "enable_structured_logging": self.monitoring.enable_structured_logging,
            "log_rotation": self.monitoring.log_rotation,
            "log_retention_days": self.monitoring.log_retention_days,
            "enable_metrics": self.monitoring.enable_metrics,
            "metrics_retention_days": self.monitoring.metrics_retention_days,
            "enable_real_time_metrics": self.monitoring.enable_real_time_metrics,
            "enable_health_checks": self.monitoring.enable_health_checks,
            "health_check_interval": self.monitoring.health_check_interval,
            "enable_component_health": self.monitoring.enable_component_health,
            "enable_alerts": self.monitoring.enable_alerts,
            "alert_webhook_url": self.monitoring.alert_webhook_url,
            "alert_email_recipients": self.monitoring.alert_email_recipients,
            "enable_performance_profiling": self.monitoring.enable_performance_profiling,
            "profiling_sample_rate": self.monitoring.profiling_sample_rate,
            "max_profile_data_size": self.monitoring.max_profile_data_size,
            "enable_error_tracking": self.monitoring.enable_error_tracking,
            "error_notification_threshold": self.monitoring.error_notification_threshold,
            "max_error_reports": self.monitoring.max_error_reports,
        }

    def get_security_config(self) -> Dict[str, Any]:
        """Get security configuration as dictionary"""
        return {
            "enable_authentication": self.security.enable_authentication,
            "jwt_secret_key": self.security.jwt_secret_key,
            "jwt_algorithm": self.security.jwt_algorithm,
            "jwt_expiration_hours": self.security.jwt_expiration_hours,
            "enable_rate_limiting": self.security.enable_rate_limiting,
            "requests_per_minute": self.security.requests_per_minute,
            "requests_per_hour": self.security.requests_per_hour,
            "requests_per_day": self.security.requests_per_day,
            "enable_data_encryption": self.security.enable_data_encryption,
            "encryption_key": self.security.encryption_key,
            "enable_pii_detection": self.security.enable_pii_detection,
            "enable_anonymization": self.security.enable_anonymization,
            "enable_content_filtering": self.security.enable_content_filtering,
            "blocked_domains": self.security.blocked_domains,
            "blocked_keywords": self.security.blocked_keywords,
            "enable_access_control": self.security.enable_access_control,
            "role_based_access": self.security.role_based_access,
            "tenant_isolation": self.security.tenant_isolation,
            "enable_audit_logging": self.security.enable_audit_logging,
            "audit_log_retention_days": self.security.audit_log_retention_days,
        }

    def get_all_configs(self) -> Dict[str, Any]:
        """Get all configuration as dictionary"""
        return {
            "environment": self.environment.value,
            "debug": self.debug,
            "testing": self.testing,
            "database": self.get_database_url(),
            "vector_store": self.get_vector_store_config(),
            "embedding": self.get_embedding_config(),
            "llm": self.get_llm_config(),
            "quality_thresholds": self.get_quality_thresholds(),
            "retrieval": self.get_retrieval_config(),
            "assembly": self.get_assembly_config(),
            "citation": self.get_citation_config(),
            "monitoring": self.get_monitoring_config(),
            "security": self.get_security_config(),
            "custom_settings": self.custom_settings,
        }

    def update_config(self, **kwargs):
        """Update configuration values"""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
                logger.info(f"Updated configuration: {key} = {value}")

        # Re-validate after update
        self.validate_configuration()

    def save_config(self, file_path: str):
        """Save configuration to file"""
        config_dict = self.get_all_configs()

        try:
            with open(file_path, 'w') as f:
                yaml.dump(config_dict, f, default_flow_style=False)
            logger.info(f"Configuration saved to {file_path}")
        except Exception as e:
            logger.error(f"Failed to save configuration to {file_path}: {e}")

    def load_config_from_file(self, file_path: str):
        """Load configuration from file"""
        try:
            with open(file_path, 'r') as f:
                config_dict = yaml.safe_load(f)

            # Update configuration based on loaded data
            if "environment" in config_dict:
                self.environment = Environment(config_dict["environment"])
            if "debug" in config_dict:
                self.debug = config_dict["debug"]

            # Update nested configurations
            if "database" in config_dict:
                for key, value in config_dict["database"].items():
                    if hasattr(self.database, key):
                        setattr(self.database, key, value)

            # Load other config sections similarly...

            logger.info(f"Configuration loaded from {file_path}")

        except Exception as e:
            logger.error(f"Failed to load configuration from {file_path}: {e}")

    def is_development(self) -> bool:
        """Check if running in development mode"""
        return self.environment == Environment.DEVELOPMENT

    def is_production(self) -> bool:
        """Check if running in production mode"""
        return self.environment == Environment.PRODUCTION

    def is_testing(self) -> bool:
        """Check if running in testing mode"""
        return self.environment == Environment.TESTING


# Global configuration instance
config = ContextConfig()

# Helper function to get configuration
def get_context_config() -> ContextConfig:
    """Get the global context configuration"""
    return config

# Function to reload configuration
def reload_context_config():
    """Reload the global context configuration"""
    global config
    config = ContextConfig()
    return config
