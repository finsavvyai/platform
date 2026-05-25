"""
Comprehensive Log Aggregation and Analytics Service

This service provides enterprise-grade log management capabilities including:
- Centralized log collection from all system components
- Real-time log parsing, indexing, and search
- Advanced log analytics and pattern detection
- Log retention and archival policies
- Log-based alerting and monitoring
- Performance and security log analysis
"""

import asyncio
import json
import logging
import re
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Union
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, validator

from app.core.redis import redis_client
from app.core.config import settings

logger = logging.getLogger(__name__)


class LogLevel(str, Enum):
    """Log levels with priority ordering."""
    TRACE = "trace"
    DEBUG = "debug"
    INFO = "info"
    WARN = "warn"
    ERROR = "error"
    FATAL = "fatal"

    @classmethod
    def get_level_priority(cls, level: str) -> int:
        """Get numeric priority for log level."""
        priorities = {
            cls.TRACE: 0,
            cls.DEBUG: 1,
            cls.INFO: 2,
            cls.WARN: 3,
            cls.ERROR: 4,
            cls.FATAL: 5
        }
        return priorities.get(level, 0)


class LogSource(str, Enum):
    """Log sources."""
    APPLICATION = "application"
    SYSTEM = "system"
    AGENT = "agent"
    TASK = "task"
    API = "api"
    DATABASE = "database"
    SECURITY = "security"
    PERFORMANCE = "performance"


class LogEntry(BaseModel):
    """Structured log entry."""
    id: UUID = Field(default_factory=uuid4)
    timestamp: datetime
    level: LogLevel
    source: LogSource
    component: str
    message: str

    # Context information
    user_id: Optional[UUID] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    task_id: Optional[UUID] = None
    agent_id: Optional[UUID] = None

    # Structured data
    metadata: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)
    correlation_id: Optional[str] = None

    # Performance data
    duration_ms: Optional[float] = None
    memory_usage_mb: Optional[float] = None
    cpu_usage_percent: Optional[float] = None

    # Error details
    error_type: Optional[str] = None
    stack_trace: Optional[str] = None
    error_code: Optional[str] = None

    # Parsed fields
    parsed_fields: Dict[str, Any] = Field(default_factory=dict)

    # Indexing
    indexed_at: Optional[datetime] = None
    indexed_fields: List[str] = Field(default_factory=list)

    class Config:
        use_enum_values = True


class LogQuery(BaseModel):
    """Log search query."""
    query: str = ""
    level: Optional[LogLevel] = None
    source: Optional[LogSource] = None
    component: Optional[str] = None
    user_id: Optional[UUID] = None
    tags: Optional[List[str]] = None

    # Time range
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    # Pagination
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)

    # Sorting
    sort_by: str = "timestamp"
    sort_order: str = "desc"

    # Search options
    include_stack_traces: bool = False
    full_text_search: bool = True

    @validator('start_time', 'end_time', pre=True, always=True)
    def set_default_time_range(cls, v, values):
        """Set default time range if not provided."""
        if v is None:
            if 'start_time' in values and values['start_time'] is None:
                return datetime.utcnow() - timedelta(hours=24)
        return v


class LogAlertRule(BaseModel):
    """Log-based alert rule."""
    id: UUID = Field(default_factory=uuid4)
    name: str
    description: Optional[str] = None
    enabled: bool = True

    # Matching criteria
    query: str
    level_threshold: Optional[LogLevel] = None
    count_threshold: int = 1
    time_window_minutes: int = 5

    # Alert configuration
    severity: LogLevel = LogLevel.ERROR
    notification_channels: List[str] = Field(default_factory=list)

    # Cooldown
    cooldown_minutes: int = 15
    last_triggered: Optional[datetime] = None

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        use_enum_values = True


class LogAnalyticsService:
    """
    Comprehensive log aggregation and analytics service.

    Features:
    - Centralized log collection from all system components
    - Real-time log parsing and indexing
    - Advanced search and filtering capabilities
    - Log pattern detection and anomaly identification
    - Performance and security log analysis
    - Configurable retention and archival policies
    - Log-based alerting and monitoring
    """

    def __init__(self):
        self.redis = redis_client

        # Log processing
        self._processing_queue: asyncio.Queue = asyncio.Queue()
        self._indexing_queue: asyncio.Queue = asyncio.Queue()
        self._processing_task: Optional[asyncio.Task] = None
        self._indexing_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        self._active = False

        # Log parsers and patterns
        self._log_parsers = self._initialize_log_parsers()
        self._index_patterns = self._initialize_index_patterns()
        self._alert_rules: Dict[UUID, LogAlertRule] = {}

        # Metrics
        self._log_metrics = {
            "total_logs": 0,
            "logs_per_source": {},
            "logs_per_level": {},
            "logs_per_component": {},
            "parsing_errors": 0,
            "indexing_errors": 0,
            "alerts_triggered": 0
        }

        # Retention policies
        self._retention_policies = {
            LogLevel.TRACE: timedelta(days=7),
            LogLevel.DEBUG: timedelta(days=14),
            LogLevel.INFO: timedelta(days=30),
            LogLevel.WARN: timedelta(days=90),
            LogLevel.ERROR: timedelta(days=365),
            LogLevel.FATAL: timedelta(days=365 * 3)
        }

        logger.info("Log analytics service initialized")

    def _initialize_log_parsers(self) -> Dict[str, re.Pattern]:
        """Initialize log parsing patterns."""
        return {
            # Python application logs
            "python_app": re.compile(
                r'(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}) '
                r'(?P<level>\w+) +(?P<logger>\S+) +(?P<message>.*)'
            ),

            # FastAPI/Uvicorn logs
            "fastapi": re.compile(
                r'(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}) '
                r'(?P<level>\w+) +(?P<message>.*)'
            ),

            # Task execution logs
            "task": re.compile(
                r'(?P<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) '
                r'(?P<level>\w+) +Task (?P<task_id>\S+): (?P<message>.*)'
            ),

            # Agent logs
            "agent": re.compile(
                r'(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) '
                r'\[(?P<agent_id>\S+)\] (?P<level>\w+): (?P<message>.*)'
            ),

            # Database logs
            "database": re.compile(
                r'(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) '
                r'\[(?P<level>\w+)\] (?P<message>.*)'
            ),

            # Security logs
            "security": re.compile(
                r'(?P<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z) '
                r'SECURITY (?P<level>\w+): (?P<message>.*)'
            ),

            # Generic log format
            "generic": re.compile(
                r'(?P<timestamp>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\s]*) '
                r'(?P<level>\w+).+?(?P<message>.*)'
            )
        }

    def _initialize_index_patterns(self) -> Dict[str, List[str]]:
        """Initialize field indexing patterns."""
        return {
            "always_index": ["timestamp", "level", "source", "component"],
            "conditional_index": {
                "user_id": ["user_id", "user.id"],
                "task_id": ["task_id", "task.id"],
                "agent_id": ["agent_id", "agent.id"],
                "request_id": ["request_id", "request.id"],
                "session_id": ["session_id", "session.id"],
                "error_type": ["error_type", "error.type"],
                "error_code": ["error_code", "error.code"],
                "correlation_id": ["correlation_id", "trace.id"]
            },
            "pattern_extract": [
                # IP addresses
                (r'\b(?:\d{1,3}\.){3}\d{1,3}\b', 'ip_address'),
                # URLs
                (r'https?://[^\s<>"{}|\\^`[\]]+', 'url'),
                # Email addresses
                (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', 'email'),
                # UUIDs
                (r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b', 'uuid'),
                # File paths
                (r'\b/[^\s<>"{}|\\^`[\]]*', 'file_path'),
                # SQL queries
                (r'\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+[^\s;]+', 'sql_query')
            ]
        }

    async def start(self):
        """Start the log analytics service."""
        if self._active:
            return

        self._active = True

        # Load alert rules
        await self._load_alert_rules()

        # Start background tasks
        self._processing_task = asyncio.create_task(self._processing_loop())
        self._indexing_task = asyncio.create_task(self._indexing_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        logger.info("Log analytics service started")

    async def stop(self):
        """Stop the log analytics service."""
        self._active = False

        # Cancel background tasks
        if self._processing_task:
            self._processing_task.cancel()
            try:
                await self._processing_task
            except asyncio.CancelledError:
                pass

        if self._indexing_task:
            self._indexing_task.cancel()
            try:
                await self._indexing_task
            except asyncio.CancelledError:
                pass

        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        logger.info("Log analytics service stopped")

    async def ingest_log(self, log_data: Union[str, Dict[str, Any], LogEntry]) -> UUID:
        """
        Ingest a log entry for processing and indexing.

        Args:
            log_data: Raw log string, dict, or structured LogEntry

        Returns:
            Log entry ID
        """
        try:
            # Parse log data
            if isinstance(log_data, str):
                log_entry = await self._parse_raw_log(log_data)
            elif isinstance(log_data, dict):
                log_entry = LogEntry(**log_data)
            else:
                log_entry = log_data

            # Set defaults
            if not log_entry.id:
                log_entry.id = uuid4()

            # Add to processing queue
            await self._processing_queue.put(log_entry)

            return log_entry.id

        except Exception as e:
            logger.error(f"Failed to ingest log: {e}")
            self._log_metrics["parsing_errors"] += 1
            raise

    async def search_logs(self, query: LogQuery) -> Dict[str, Any]:
        """
        Search logs based on query criteria.

        Args:
            query: Search query parameters

        Returns:
            Search results with metadata
        """
        try:
            # Build search key
            search_key = self._build_search_key(query)

            # Get matching log IDs from Redis
            log_ids = await self.redis.smembers(search_key)

            # Retrieve log entries
            logs = []
            for log_id in log_ids[query.offset:query.offset + query.limit]:
                log_data = await self.redis.get(f"log:{log_id}")
                if log_data:
                    log = LogEntry(**log_data)
                    if self._matches_query(log, query):
                        logs.append(log.dict())

            # Get total count
            total_count = await self.redis.scard(search_key)

            # Apply pagination
            logs = logs[query.offset:query.offset + query.limit]

            # Sort results
            logs = self._sort_logs(logs, query.sort_by, query.sort_order)

            return {
                "logs": logs,
                "total": total_count,
                "offset": query.offset,
                "limit": query.limit,
                "query": query.dict()
            }

        except Exception as e:
            logger.error(f"Failed to search logs: {e}")
            return {"logs": [], "total": 0, "error": str(e)}

    async def get_log_analytics(
        self,
        time_range: str = "day",
        group_by: Optional[str] = None,
        source: Optional[LogSource] = None
    ) -> Dict[str, Any]:
        """
        Get log analytics and statistics.

        Args:
            time_range: Time range (hour, day, week, month)
            group_by: Field to group analytics by
            source: Filter by log source

        Returns:
            Analytics data
        """
        try:
            # Calculate time range
            if time_range == "hour":
                start_time = datetime.utcnow() - timedelta(hours=1)
                interval_minutes = 5
            elif time_range == "day":
                start_time = datetime.utcnow() - timedelta(days=1)
                interval_minutes = 60
            elif time_range == "week":
                start_time = datetime.utcnow() - timedelta(weeks=1)
                interval_minutes = 360  # 6 hours
            else:  # month
                start_time = datetime.utcnow() - timedelta(days=30)
                interval_minutes = 1440  # 1 day

            # Get log counts by time intervals
            time_series = await self._get_log_time_series(start_time, interval_minutes, source)

            # Get level distribution
            level_distribution = await self._get_level_distribution(start_time, source)

            # Get source distribution
            source_distribution = await self._get_source_distribution(start_time, source)

            # Get top components
            top_components = await self._get_top_components(start_time, source)

            # Get error patterns
            error_patterns = await self._get_error_patterns(start_time, source)

            # Get performance metrics
            performance_metrics = await self._get_performance_metrics(start_time, source)

            return {
                "time_range": time_range,
                "start_time": start_time.isoformat(),
                "time_series": time_series,
                "level_distribution": level_distribution,
                "source_distribution": source_distribution,
                "top_components": top_components,
                "error_patterns": error_patterns,
                "performance_metrics": performance_metrics
            }

        except Exception as e:
            logger.error(f"Failed to get log analytics: {e}")
            return {"error": str(e)}

    async def create_log_alert(self, rule_data: Dict[str, Any]) -> LogAlertRule:
        """Create a new log-based alert rule."""
        try:
            rule = LogAlertRule(**rule_data)

            # Store rule
            await self.redis.set(
                f"log_alert_rule:{rule.id}",
                rule.dict(),
                expire=86400 * 30  # 30 days
            )

            # Add to active rules
            self._alert_rules[rule.id] = rule

            logger.info(f"Created log alert rule: {rule.name}")
            return rule

        except Exception as e:
            logger.error(f"Failed to create log alert rule: {e}")
            raise

    async def _processing_loop(self):
        """Main log processing loop."""
        while self._active:
            try:
                # Wait for log entry
                try:
                    log_entry = await asyncio.wait_for(
                        self._processing_queue.get(),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue

                # Process log entry
                await self._process_log_entry(log_entry)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in log processing loop: {e}")
                await asyncio.sleep(1)

    async def _indexing_loop(self):
        """Log indexing loop."""
        while self._active:
            try:
                # Wait for log entry
                try:
                    log_entry = await asyncio.wait_for(
                        self._indexing_queue.get(),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue

                # Index log entry
                await self._index_log_entry(log_entry)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in log indexing loop: {e}")
                self._log_metrics["indexing_errors"] += 1
                await asyncio.sleep(1)

    async def _cleanup_loop(self):
        """Cleanup loop for old logs and maintenance."""
        while self._active:
            try:
                # Clean up old logs based on retention policies
                await self._cleanup_old_logs()

                # Clean up old indexes
                await self._cleanup_old_indexes()

                # Update metrics
                await self.redis.set("log_metrics", self._log_metrics, expire=86400)

                # Wait for next cleanup cycle
                await asyncio.sleep(3600)  # Run cleanup every hour

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
                await asyncio.sleep(300)

    async def _parse_raw_log(self, raw_log: str) -> LogEntry:
        """Parse raw log string into structured LogEntry."""
        try:
            # Try different parsers
            for parser_name, pattern in self._log_parsers.items():
                match = pattern.match(raw_log.strip())
                if match:
                    return self._create_log_entry_from_match(match, parser_name, raw_log)

            # If no pattern matches, create basic entry
            return LogEntry(
                timestamp=datetime.utcnow(),
                level=LogLevel.INFO,
                source=LogSource.APPLICATION,
                component="unknown",
                message=raw_log.strip(),
                parsed_fields={"raw": raw_log}
            )

        except Exception as e:
            logger.error(f"Failed to parse raw log: {e}")
            return LogEntry(
                timestamp=datetime.utcnow(),
                level=LogLevel.ERROR,
                source=LogSource.APPLICATION,
                component="parser",
                message=f"Log parsing error: {str(e)}",
                parsed_fields={"raw": raw_log, "error": str(e)}
            )

    def _create_log_entry_from_match(self, match: re.Match, parser_name: str, raw_log: str) -> LogEntry:
        """Create LogEntry from regex match."""
        groups = match.groupdict()

        # Parse timestamp
        timestamp = self._parse_timestamp(groups.get("timestamp", ""))
        if not timestamp:
            timestamp = datetime.utcnow()

        # Parse level
        level_str = groups.get("level", "INFO").upper()
        try:
            level = LogLevel(level_str.lower())
        except ValueError:
            level = LogLevel.INFO

        # Determine source from parser name
        source_mapping = {
            "python_app": LogSource.APPLICATION,
            "fastapi": LogSource.API,
            "task": LogSource.TASK,
            "agent": LogSource.AGENT,
            "database": LogSource.DATABASE,
            "security": LogSource.SECURITY,
            "generic": LogSource.APPLICATION
        }
        source = source_mapping.get(parser_name, LogSource.APPLICATION)

        # Extract component
        component = groups.get("component", parser_name)
        if not component:
            component = groups.get("logger", parser_name)

        # Create parsed fields
        parsed_fields = {
            "parser": parser_name,
            "raw": raw_log
        }
        parsed_fields.update({k: v for k, v in groups.items() if v is not None})

        # Extract structured fields
        message = groups.get("message", raw_log)
        extracted_fields = self._extract_structured_fields(message)
        parsed_fields.update(extracted_fields)

        return LogEntry(
            timestamp=timestamp,
            level=level,
            source=source,
            component=component,
            message=message,
            parsed_fields=parsed_fields
        )

    def _parse_timestamp(self, timestamp_str: str) -> Optional[datetime]:
        """Parse timestamp from string."""
        if not timestamp_str:
            return None

        formats = [
            "%Y-%m-%d %H:%M:%S,%f",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S"
        ]

        for fmt in formats:
            try:
                return datetime.strptime(timestamp_str, fmt)
            except ValueError:
                continue

        return None

    def _extract_structured_fields(self, text: str) -> Dict[str, Any]:
        """Extract structured fields from log message."""
        extracted = {}

        for pattern, field_name in self._index_patterns["pattern_extract"]:
            matches = re.findall(pattern, text)
            if matches:
                extracted[field_name] = matches if len(matches) > 1 else matches[0]

        return extracted

    async def _process_log_entry(self, log_entry: LogEntry):
        """Process a log entry."""
        try:
            # Update metrics
            self._log_metrics["total_logs"] += 1

            # Update source metrics
            source_key = log_entry.source.value
            self._log_metrics["logs_per_source"][source_key] = self._log_metrics["logs_per_source"].get(source_key, 0) + 1

            # Update level metrics
            level_key = log_entry.level.value
            self._log_metrics["logs_per_level"][level_key] = self._log_metrics["logs_per_level"].get(level_key, 0) + 1

            # Update component metrics
            component_key = log_entry.component
            self._log_metrics["logs_per_component"][component_key] = self._log_metrics["logs_per_component"].get(component_key, 0) + 1

            # Check alert rules
            await self._check_log_alerts(log_entry)

            # Add to indexing queue
            await self._indexing_queue.put(log_entry)

        except Exception as e:
            logger.error(f"Failed to process log entry: {e}")

    async def _index_log_entry(self, log_entry: LogEntry):
        """Index a log entry for searching."""
        try:
            # Store log entry
            await self.redis.set(
                f"log:{log_entry.id}",
                log_entry.dict(),
                expire=int(self._retention_policies[log_entry.level].total_seconds())
            )

            # Determine indexed fields
            indexed_fields = self._index_patterns["always_index"].copy()
            for field_name, field_paths in self._index_patterns["conditional_index"].items():
                if self._has_field(log_entry, field_paths):
                    indexed_fields.append(field_name)

            # Add parsed fields to indexed fields
            for field_name in log_entry.parsed_fields.keys():
                if field_name not in indexed_fields:
                    indexed_fields.append(field_name)

            log_entry.indexed_fields = indexed_fields
            log_entry.indexed_at = datetime.utcnow()

            # Create search indexes
            await self._create_search_indexes(log_entry)

        except Exception as e:
            logger.error(f"Failed to index log entry: {e}")

    def _has_field(self, log_entry: LogEntry, field_paths: List[str]) -> bool:
        """Check if log entry has any of the specified fields."""
        for path in field_paths:
            if '.' in path:
                # Nested field
                parts = path.split('.')
                value = log_entry.dict()
                for part in parts:
                    if isinstance(value, dict) and part in value:
                        value = value[part]
                    else:
                        value = None
                        break
                if value is not None:
                    return True
            else:
                # Top-level field
                if hasattr(log_entry, path) and getattr(log_entry, path) is not None:
                    return True
        return False

    async def _create_search_indexes(self, log_entry: LogEntry):
        """Create search indexes for log entry."""
        try:
            # Time-based indexes
            time_key = f"log_time:{log_entry.timestamp.strftime('%Y%m%d%H')}"
            await self.redis.sadd(time_key, str(log_entry.id))
            await self.redis.expire(time_key, 86400 * 7)  # 7 days

            # Level-based indexes
            level_key = f"log_level:{log_entry.level.value}"
            await self.redis.sadd(level_key, str(log_entry.id))
            await self.redis.expire(level_key, 86400 * 30)  # 30 days

            # Source-based indexes
            source_key = f"log_source:{log_entry.source.value}"
            await self.redis.sadd(source_key, str(log_entry.id))
            await self.redis.expire(source_key, 86400 * 30)

            # Component-based indexes
            component_key = f"log_component:{log_entry.component}"
            await self.redis.sadd(component_key, str(log_entry.id))
            await self.redis.expire(component_key, 86400 * 30)

            # User-based indexes
            if log_entry.user_id:
                user_key = f"log_user:{log_entry.user_id}"
                await self.redis.sadd(user_key, str(log_entry.id))
                await self.redis.expire(user_key, 86400 * 7)

            # Task-based indexes
            if log_entry.task_id:
                task_key = f"log_task:{log_entry.task_id}"
                await self.redis.sadd(task_key, str(log_entry.id))
                await self.redis.expire(task_key, 86400 * 7)

            # Full-text search index (simplified)
            words = re.findall(r'\b\w+\b', log_entry.message.lower())
            for word in words[:10]:  # Limit to first 10 words
                word_key = f"log_word:{word}"
                await self.redis.sadd(word_key, str(log_entry.id))
                await self.redis.expire(word_key, 86400)  # 1 day

        except Exception as e:
            logger.error(f"Failed to create search indexes: {e}")

    def _build_search_key(self, query: LogQuery) -> str:
        """Build Redis search key based on query."""
        keys = []

        if query.level:
            keys.append(f"log_level:{query.level.value}")

        if query.source:
            keys.append(f"log_source:{query.source.value}")

        if query.component:
            keys.append(f"log_component:{query.component}")

        if query.user_id:
            keys.append(f"log_user:{query.user_id}")

        # Combine keys
        if keys:
            return "log_search:" + ":".join(keys)
        else:
            return "log_all"

    def _matches_query(self, log: LogEntry, query: LogQuery) -> bool:
        """Check if log entry matches query criteria."""
        # Time range filter
        if query.start_time and log.timestamp < query.start_time:
            return False
        if query.end_time and log.timestamp > query.end_time:
            return False

        # Level filter
        if query.level and log.level != query.level:
            return False

        # Source filter
        if query.source and log.source != query.source:
            return False

        # Component filter
        if query.component and log.component != query.component:
            return False

        # User filter
        if query.user_id and log.user_id != query.user_id:
            return False

        # Tags filter
        if query.tags and not any(tag in log.tags for tag in query.tags):
            return False

        # Text search
        if query.query and query.full_text_search:
            query_lower = query.query.lower()
            if (query_lower not in log.message.lower() and
                query_lower not in json.dumps(log.parsed_fields).lower()):
                return False

        return True

    def _sort_logs(self, logs: List[Dict[str, Any]], sort_by: str, sort_order: str) -> List[Dict[str, Any]]:
        """Sort logs by specified field."""
        reverse = sort_order.lower() == "desc"

        if sort_by in ["timestamp", "level", "source", "component"]:
            return sorted(logs, key=lambda x: x.get(sort_by, ""), reverse=reverse)
        else:
            return logs

    async def _get_log_time_series(
        self,
        start_time: datetime,
        interval_minutes: int,
        source: Optional[LogSource] = None
    ) -> List[Dict[str, Any]]:
        """Get log counts by time intervals."""
        try:
            time_series = []
            current_time = start_time
            end_time = datetime.utcnow()

            while current_time < end_time:
                interval_end = current_time + timedelta(minutes=interval_minutes)
                if interval_end > end_time:
                    interval_end = end_time

                # Count logs in interval
                count = await self._count_logs_in_interval(current_time, interval_end, source)

                time_series.append({
                    "timestamp": current_time.isoformat(),
                    "count": count
                })

                current_time = interval_end

            return time_series

        except Exception as e:
            logger.error(f"Failed to get log time series: {e}")
            return []

    async def _count_logs_in_interval(
        self,
        start_time: datetime,
        end_time: datetime,
        source: Optional[LogSource] = None
    ) -> int:
        """Count logs in time interval."""
        try:
            # Get log keys for the time range
            time_keys = []
            current = start_time
            while current < end_time:
                time_key = f"log_time:{current.strftime('%Y%m%d%H')}"
                time_keys.append(time_key)
                current += timedelta(hours=1)

            if not time_keys:
                return 0

            # Get union of all log IDs in time range
            if len(time_keys) == 1:
                log_ids = await self.redis.smembers(time_keys[0])
            else:
                # Use Redis SUNION for multiple keys
                temp_key = f"temp_logs:{uuid4()}"
                await self.redis.sunionstore(temp_key, *time_keys)
                log_ids = await self.redis.smembers(temp_key)
                await self.redis.delete(temp_key)

            # Filter by source if specified
            if source:
                filtered_count = 0
                for log_id in log_ids:
                    log_data = await self.redis.get(f"log:{log_id}")
                    if log_data:
                        log = LogEntry(**log_data)
                        if log.source == source:
                            filtered_count += 1
                return filtered_count

            return len(log_ids)

        except Exception as e:
            logger.error(f"Failed to count logs in interval: {e}")
            return 0

    async def _get_level_distribution(
        self,
        start_time: datetime,
        source: Optional[LogSource] = None
    ) -> Dict[str, int]:
        """Get log distribution by level."""
        try:
            distribution = {}
            total = 0

            for level in LogLevel:
                # Get level-based count
                level_key = f"log_level:{level.value}"
                log_ids = await self.redis.smembers(level_key)

                # Filter by time and source
                count = 0
                for log_id in log_ids[:1000]:  # Limit for performance
                    log_data = await self.redis.get(f"log:{log_id}")
                    if log_data:
                        log = LogEntry(**log_data)
                        if log.timestamp >= start_time:
                            if not source or log.source == source:
                                count += 1

                distribution[level.value] = count
                total += count

            return distribution

        except Exception as e:
            logger.error(f"Failed to get level distribution: {e}")
            return {}

    async def _get_source_distribution(
        self,
        start_time: datetime,
        source: Optional[LogSource] = None
    ) -> Dict[str, int]:
        """Get log distribution by source."""
        try:
            distribution = {}

            for src in LogSource:
                if source and src != source:
                    continue

                # Get source-based count
                source_key = f"log_source:{src.value}"
                log_ids = await self.redis.smembers(source_key)

                # Filter by time
                count = 0
                for log_id in log_ids[:1000]:  # Limit for performance
                    log_data = await self.redis.get(f"log:{log_id}")
                    if log_data:
                        log = LogEntry(**log_data)
                        if log.timestamp >= start_time:
                            count += 1

                distribution[src.value] = count

            return distribution

        except Exception as e:
            logger.error(f"Failed to get source distribution: {e}")
            return {}

    async def _get_top_components(
        self,
        start_time: datetime,
        source: Optional[LogSource] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get top log-producing components."""
        try:
            component_counts = {}

            # Get all component keys
            component_keys = await self.redis.keys("log_component:*")

            for key in component_keys[:100]:  # Limit for performance
                component = key.split(":")[-1]
                log_ids = await self.redis.smembers(key)

                # Filter by time and source
                count = 0
                for log_id in log_ids[:100]:  # Limit for performance
                    log_data = await self.redis.get(f"log:{log_id}")
                    if log_data:
                        log = LogEntry(**log_data)
                        if log.timestamp >= start_time:
                            if not source or log.source == source:
                                count += 1

                if count > 0:
                    component_counts[component] = count

            # Sort by count and return top N
            sorted_components = sorted(
                component_counts.items(),
                key=lambda x: x[1],
                reverse=True
            )[:limit]

            return [
                {"component": comp, "count": count}
                for comp, count in sorted_components
            ]

        except Exception as e:
            logger.error(f"Failed to get top components: {e}")
            return []

    async def _get_error_patterns(
        self,
        start_time: datetime,
        source: Optional[LogSource] = None
    ) -> List[Dict[str, Any]]:
        """Get common error patterns."""
        try:
            # Get error logs
            error_keys = ["log_level:error", "log_level:fatal"]
            error_log_ids = set()

            for key in error_keys:
                ids = await self.redis.smembers(key)
                error_log_ids.update(ids)

            # Analyze error patterns
            error_patterns = {}
            for log_id in list(error_log_ids)[:500]:  # Limit for performance
                log_data = await self.redis.get(f"log:{log_id}")
                if log_data:
                    log = LogEntry(**log_data)
                    if log.timestamp >= start_time:
                        if not source or log.source == source:
                            # Simple pattern extraction (first 50 chars of message)
                            pattern = log.message[:50]
                            if pattern not in error_patterns:
                                error_patterns[pattern] = {
                                    "pattern": pattern,
                                    "count": 0,
                                    "first_seen": log.timestamp,
                                    "last_seen": log.timestamp,
                                    "components": set()
                                }

                            error_patterns[pattern]["count"] += 1
                            error_patterns[pattern]["last_seen"] = max(
                                error_patterns[pattern]["last_seen"],
                                log.timestamp
                            )
                            error_patterns[pattern]["components"].add(log.component)

            # Convert sets to lists and sort by count
            result = []
            for pattern_data in error_patterns.values():
                pattern_data["components"] = list(pattern_data["components"])
                pattern_data["first_seen"] = pattern_data["first_seen"].isoformat()
                pattern_data["last_seen"] = pattern_data["last_seen"].isoformat()
                result.append(pattern_data)

            result.sort(key=lambda x: x["count"], reverse=True)
            return result[:10]  # Return top 10 patterns

        except Exception as e:
            logger.error(f"Failed to get error patterns: {e}")
            return []

    async def _get_performance_metrics(
        self,
        start_time: datetime,
        source: Optional[LogSource] = None
    ) -> Dict[str, Any]:
        """Get performance-related metrics from logs."""
        try:
            metrics = {
                "avg_duration_ms": 0,
                "max_duration_ms": 0,
                "avg_memory_mb": 0,
                "max_memory_mb": 0,
                "avg_cpu_percent": 0,
                "max_cpu_percent": 0,
                "total_logs": 0
            }

            # Get logs with performance data
            log_keys = await self.redis.keys("log:*")
            performance_logs = []

            for key in log_keys[:1000]:  # Limit for performance
                log_data = await self.redis.get(key)
                if log_data:
                    log = LogEntry(**log_data)
                    if log.timestamp >= start_time:
                        if not source or log.source == source:
                            if (log.duration_ms is not None or
                                log.memory_usage_mb is not None or
                                log.cpu_usage_percent is not None):
                                performance_logs.append(log)

            if not performance_logs:
                return metrics

            # Calculate metrics
            durations = [log.duration_ms for log in performance_logs if log.duration_ms is not None]
            memory_usage = [log.memory_usage_mb for log in performance_logs if log.memory_usage_mb is not None]
            cpu_usage = [log.cpu_usage_percent for log in performance_logs if log.cpu_usage_percent is not None]

            if durations:
                metrics["avg_duration_ms"] = sum(durations) / len(durations)
                metrics["max_duration_ms"] = max(durations)

            if memory_usage:
                metrics["avg_memory_mb"] = sum(memory_usage) / len(memory_usage)
                metrics["max_memory_mb"] = max(memory_usage)

            if cpu_usage:
                metrics["avg_cpu_percent"] = sum(cpu_usage) / len(cpu_usage)
                metrics["max_cpu_percent"] = max(cpu_usage)

            metrics["total_logs"] = len(performance_logs)

            return metrics

        except Exception as e:
            logger.error(f"Failed to get performance metrics: {e}")
            return {}

    async def _check_log_alerts(self, log_entry: LogEntry):
        """Check if log entry triggers any alert rules."""
        try:
            for rule in self._alert_rules.values():
                if not rule.enabled:
                    continue

                # Check cooldown
                if (rule.last_triggered and
                    datetime.utcnow() - rule.last_triggered < timedelta(minutes=rule.cooldown_minutes)):
                    continue

                # Check if log matches rule
                if await self._log_matches_alert_rule(log_entry, rule):
                    # Trigger alert
                    await self._trigger_log_alert(rule, log_entry)

                    # Update last triggered time
                    rule.last_triggered = datetime.utcnow()
                    await self.redis.set(
                        f"log_alert_rule:{rule.id}",
                        rule.dict(),
                        expire=86400 * 30
                    )

                    self._log_metrics["alerts_triggered"] += 1

        except Exception as e:
            logger.error(f"Failed to check log alerts: {e}")

    async def _log_matches_alert_rule(self, log_entry: LogEntry, rule: LogAlertRule) -> bool:
        """Check if log entry matches alert rule."""
        try:
            # Level check
            if rule.level_threshold:
                if LogLevel.get_level_priority(log_entry.value) < LogLevel.get_level_priority(rule.level_threshold.value):
                    return False

            # Query check (simplified)
            if rule.query:
                query_lower = rule.query.lower()
                if (query_lower not in log_entry.message.lower() and
                    query_lower not in json.dumps(log_entry.parsed_fields).lower()):
                    return False

            # Count check in time window (simplified - just check current log)
            # In production, this would need proper time window counting
            return True

        except Exception as e:
            logger.error(f"Failed to check log alert rule match: {e}")
            return False

    async def _trigger_log_alert(self, rule: LogAlertRule, log_entry: LogEntry):
        """Trigger a log-based alert."""
        try:
            # Create alert data
            alert_data = {
                "alert_id": str(uuid4()),
                "alert_title": f"Log Alert: {rule.name}",
                "description": f"Log entry matched alert rule '{rule.name}': {log_entry.message}",
                "severity": rule.severity.value,
                "timestamp": datetime.utcnow().isoformat(),
                "source": "log_analytics",
                "log_entry_id": str(log_entry.id),
                "rule_id": str(rule.id),
                "additional_details": {
                    "log_level": log_entry.level.value,
                    "log_source": log_entry.source.value,
                    "log_component": log_entry.component,
                    "log_timestamp": log_entry.timestamp.isoformat()
                }
            }

            # Send notification (this would integrate with the notification service)
            logger.info(f"Log alert triggered: {rule.name} - {log_entry.message}")

        except Exception as e:
            logger.error(f"Failed to trigger log alert: {e}")

    async def _load_alert_rules(self):
        """Load alert rules from storage."""
        try:
            rule_keys = await self.redis.keys("log_alert_rule:*")

            for key in rule_keys:
                try:
                    rule_data = await self.redis.get(key)
                    if rule_data:
                        rule = LogAlertRule(**rule_data)
                        self._alert_rules[rule.id] = rule
                except Exception as e:
                    logger.warning(f"Error loading alert rule {key}: {e}")
                    continue

            logger.info(f"Loaded {len(self._alert_rules)} log alert rules")

        except Exception as e:
            logger.error(f"Failed to load alert rules: {e}")

    async def _cleanup_old_logs(self):
        """Clean up old logs based on retention policies."""
        try:
            cutoff_time = datetime.utcnow() - timedelta(days=30)  # Base cutoff

            for level, retention_period in self._retention_policies.items():
                level_cutoff = datetime.utcnow() - retention_period

                # Get all log keys for this level
                level_key = f"log_level:{level.value}"
                log_ids = await self.redis.smembers(level_key)

                deleted_count = 0
                for log_id in log_ids:
                    try:
                        log_data = await self.redis.get(f"log:{log_id}")
                        if log_data:
                            log = LogEntry(**log_data)
                            if log.timestamp < level_cutoff:
                                await self.redis.delete(f"log:{log_id}")
                                await self.redis.srem(level_key, log_id)
                                deleted_count += 1
                    except Exception as e:
                        logger.warning(f"Error cleaning up log {log_id}: {e}")
                        continue

                if deleted_count > 0:
                    logger.info(f"Cleaned up {deleted_count} old {level} logs")

        except Exception as e:
            logger.error(f"Failed to cleanup old logs: {e}")

    async def _cleanup_old_indexes(self):
        """Clean up old search indexes."""
        try:
            # Clean up time-based indexes older than 7 days
            cutoff_date = (datetime.utcnow() - timedelta(days=7)).strftime('%Y%m%d')

            time_keys = await self.redis.keys("log_time:*")
            for key in time_keys:
                try:
                    date_part = key.split(":")[-1]
                    if date_part < cutoff_date:
                        await self.redis.delete(key)
                except Exception as e:
                    logger.warning(f"Error cleaning up index {key}: {e}")
                    continue

        except Exception as e:
            logger.error(f"Failed to cleanup old indexes: {e}")


# Global log analytics service instance
log_analytics_service: Optional[LogAnalyticsService] = None


async def get_log_analytics_service() -> LogAnalyticsService:
    """Get or create the global log analytics service instance."""
    global log_analytics_service

    if log_analytics_service is None:
        log_analytics_service = LogAnalyticsService()
        await log_analytics_service.start()

    return log_analytics_service


async def shutdown_log_analytics_service():
    """Shutdown the global log analytics service instance."""
    global log_analytics_service

    if log_analytics_service:
        await log_analytics_service.stop()
        log_analytics_service = None