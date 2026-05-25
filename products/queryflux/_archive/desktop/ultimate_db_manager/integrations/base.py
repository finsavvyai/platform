"""
Base classes for enterprise integrations
"""

import abc
import asyncio
import json
import logging
import threading
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union, Callable
from dataclasses import dataclass
from enum import Enum
import hashlib
import hmac
import jwt
import requests
from functools import wraps
import sqlite3
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class IntegrationType(Enum):
    """Types of integrations available"""
    COMMUNICATION = "communication"
    PROJECT_MANAGEMENT = "project_management"
    MONITORING = "monitoring"
    IDENTITY = "identity"
    ANALYTICS = "analytics"
    ITSM = "itsm"
    ALERTING = "alerting"
    CRM = "crm"

class EventType(Enum):
    """Database event types"""
    CONNECTION_CREATED = "connection.created"
    CONNECTION_FAILED = "connection.failed"
    QUERY_EXECUTED = "query.executed"
    QUERY_FAILED = "query.failed"
    PERFORMANCE_ALERT = "performance.alert"
    SECURITY_INCIDENT = "security.incident"
    BACKUP_COMPLETED = "backup.completed"
    BACKUP_FAILED = "backup.failed"
    SCHEMA_CHANGED = "schema.changed"
    USER_LOGIN = "user.login"
    USER_LOGOUT = "user.logout"
    HEALTH_CHECK = "health.check"

@dataclass
class IntegrationEvent:
    """Represents an event in the integration system"""
    event_type: EventType
    timestamp: datetime
    source: str
    data: Dict[str, Any]
    severity: str = "info"  # info, warning, error, critical
    user_id: Optional[str] = None
    session_id: Optional[str] = None

@dataclass
class SecurityContext:
    """Security context for integrations"""
    api_key: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    scopes: List[str] = None
    tenant_id: Optional[str] = None

    def is_expired(self) -> bool:
        """Check if the token is expired"""
        if not self.expires_at:
            return False
        return datetime.utcnow() >= self.expires_at

class BaseIntegration(abc.ABC):
    """Base class for all enterprise integrations"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.name = self.__class__.__name__.replace('Integration', '').lower()
        self.security_context = self._init_security_context()
        self.is_connected = False
        self._event_handlers = {}
        self._webhook_handlers = {}
        self.logger = logging.getLogger(f"integration.{self.name}")

        # Initialize database for state management
        self._init_database()

    def _init_security_context(self) -> SecurityContext:
        """Initialize security context from config"""
        return SecurityContext(
            api_key=self.config.get('api_key'),
            access_token=self.config.get('access_token'),
            refresh_token=self.config.get('refresh_token'),
            expires_at=self.config.get('expires_at'),
            scopes=self.config.get('scopes', []),
            tenant_id=self.config.get('tenant_id')
        )

    def _init_database(self):
        """Initialize local database for integration state"""
        db_path = f"integrations_{self.name}.db"
        self.db_conn = sqlite3.connect(db_path, check_same_thread=False)
        self.db_conn.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                timestamp DATETIME NOT NULL,
                data TEXT NOT NULL,
                processed BOOLEAN DEFAULT FALSE,
                retry_count INTEGER DEFAULT 0
            )
        """)
        self.db_conn.execute("""
            CREATE TABLE IF NOT EXISTS webhooks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint TEXT NOT NULL,
                secret TEXT,
                events TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                active BOOLEAN DEFAULT TRUE
            )
        """)
        self.db_conn.commit()

    @abc.abstractmethod
    def get_integration_type(self) -> IntegrationType:
        """Return the type of this integration"""
        pass

    @abc.abstractmethod
    async def connect(self) -> bool:
        """Establish connection to the external service"""
        pass

    @abc.abstractmethod
    async def disconnect(self):
        """Clean up and disconnect from the external service"""
        pass

    @abc.abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """Check the health of the integration"""
        pass

    def on_event(self, event_type: EventType):
        """Decorator to register event handlers"""
        def decorator(func: Callable):
            self._event_handlers[event_type] = func
            return func
        return decorator

    async def handle_event(self, event: IntegrationEvent):
        """Handle an incoming event"""
        if event.event_type in self._event_handlers:
            try:
                await self._event_handlers[event.event_type](event)
                self.logger.info(f"Successfully handled {event.event_type.value}")
            except Exception as e:
                self.logger.error(f"Error handling {event.event_type.value}: {e}")
                # Store failed event for retry
                self._store_failed_event(event)

    def _store_failed_event(self, event: IntegrationEvent):
        """Store failed event for retry"""
        self.db_conn.execute(
            "INSERT INTO events (event_type, timestamp, data) VALUES (?, ?, ?)",
            (event.event_type.value, event.timestamp, json.dumps(event.data))
        )
        self.db_conn.commit()

    async def retry_failed_events(self):
        """Retry failed events"""
        cursor = self.db_conn.execute(
            "SELECT id, event_type, timestamp, data FROM events WHERE processed = FALSE AND retry_count < 3"
        )

        for row in cursor.fetchall():
            event_id, event_type, timestamp, data = row
            try:
                event = IntegrationEvent(
                    event_type=EventType(event_type),
                    timestamp=datetime.fromisoformat(timestamp),
                    source=self.name,
                    data=json.loads(data)
                )
                await self.handle_event(event)

                # Mark as processed
                self.db_conn.execute(
                    "UPDATE events SET processed = TRUE WHERE id = ?",
                    (event_id,)
                )
                self.db_conn.commit()

            except Exception as e:
                # Increment retry count
                self.db_conn.execute(
                    "UPDATE events SET retry_count = retry_count + 1 WHERE id = ?",
                    (event_id,)
                )
                self.db_conn.commit()
                self.logger.error(f"Failed to retry event {event_id}: {e}")

class WebhookHandler:
    """Handles webhook endpoints for integrations"""

    def __init__(self, secret_key: str = None):
        self.secret_key = secret_key or os.urandom(32).hex()
        self.endpoints = {}

    def register_endpoint(self, path: str, handler: Callable, methods: List[str] = None):
        """Register a webhook endpoint"""
        if methods is None:
            methods = ['POST']

        self.endpoints[path] = {
            'handler': handler,
            'methods': methods
        }

    def verify_signature(self, payload: bytes, signature: str) -> bool:
        """Verify webhook signature"""
        if not self.secret_key:
            return True

        expected_signature = hmac.new(
            self.secret_key.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(signature, expected_signature)

    async def handle_request(self, path: str, method: str, headers: Dict, body: bytes):
        """Handle incoming webhook request"""
        if path not in self.endpoints:
            return {"error": "Endpoint not found"}, 404

        endpoint = self.endpoints[path]
        if method not in endpoint['methods']:
            return {"error": "Method not allowed"}, 405

        # Verify signature if provided
        signature = headers.get('X-Hub-Signature-256', '').replace('sha256=', '')
        if signature and not self.verify_signature(body, signature):
            return {"error": "Invalid signature"}, 401

        try:
            data = json.loads(body.decode()) if body else {}
            result = await endpoint['handler'](data, headers)
            return result or {"status": "ok"}, 200
        except Exception as e:
            logger.error(f"Webhook error: {e}")
            return {"error": "Internal server error"}, 500

class EventStream:
    """Real-time event streaming for integrations"""

    def __init__(self):
        self.subscribers = {}
        self.is_running = False
        self._lock = threading.Lock()

    def subscribe(self, event_types: List[EventType], callback: Callable):
        """Subscribe to specific event types"""
        with self._lock:
            for event_type in event_types:
                if event_type not in self.subscribers:
                    self.subscribers[event_type] = []
                self.subscribers[event_type].append(callback)

    def unsubscribe(self, event_types: List[EventType], callback: Callable):
        """Unsubscribe from event types"""
        with self._lock:
            for event_type in event_types:
                if event_type in self.subscribers:
                    try:
                        self.subscribers[event_type].remove(callback)
                    except ValueError:
                        pass

    async def publish(self, event: IntegrationEvent):
        """Publish event to subscribers"""
        if event.event_type in self.subscribers:
            for callback in self.subscribers[event.event_type]:
                try:
                    await callback(event)
                except Exception as e:
                    logger.error(f"Error in event subscriber: {e}")

class IntegrationManager:
    """Manages all enterprise integrations"""

    def __init__(self):
        self.integrations = {}
        self.event_stream = EventStream()
        self.webhook_handler = WebhookHandler()
        self.is_running = False
        self._health_check_interval = 300  # 5 minutes

    def register_integration(self, integration: BaseIntegration):
        """Register an integration"""
        self.integrations[integration.name] = integration
        logger.info(f"Registered integration: {integration.name}")

        # Set up event forwarding
        async def forward_event(event: IntegrationEvent):
            await integration.handle_event(event)

        # Subscribe integration to relevant events
        self.event_stream.subscribe(list(EventType), forward_event)

    async def start_all(self):
        """Start all registered integrations"""
        self.is_running = True

        for name, integration in self.integrations.items():
            try:
                success = await integration.connect()
                if success:
                    logger.info(f"Started integration: {name}")
                else:
                    logger.error(f"Failed to start integration: {name}")
            except Exception as e:
                logger.error(f"Error starting integration {name}: {e}")

        # Start health monitoring
        asyncio.create_task(self._health_monitor())

        # Start retry mechanism
        asyncio.create_task(self._retry_failed_events())

    async def stop_all(self):
        """Stop all registered integrations"""
        self.is_running = False

        for name, integration in self.integrations.items():
            try:
                await integration.disconnect()
                logger.info(f"Stopped integration: {name}")
            except Exception as e:
                logger.error(f"Error stopping integration {name}: {e}")

    async def publish_event(self, event: IntegrationEvent):
        """Publish event to all integrations"""
        await self.event_stream.publish(event)

    async def get_health_status(self) -> Dict[str, Any]:
        """Get health status of all integrations"""
        status = {}

        for name, integration in self.integrations.items():
            try:
                health = await integration.health_check()
                status[name] = {
                    "status": "healthy" if health.get("healthy", False) else "unhealthy",
                    "details": health
                }
            except Exception as e:
                status[name] = {
                    "status": "error",
                    "error": str(e)
                }

        return status

    async def _health_monitor(self):
        """Background health monitoring"""
        while self.is_running:
            try:
                health_status = await self.get_health_status()

                # Create health check event
                event = IntegrationEvent(
                    event_type=EventType.HEALTH_CHECK,
                    timestamp=datetime.utcnow(),
                    source="integration_manager",
                    data={"health_status": health_status}
                )

                await self.publish_event(event)

            except Exception as e:
                logger.error(f"Health monitor error: {e}")

            await asyncio.sleep(self._health_check_interval)

    async def _retry_failed_events(self):
        """Background retry mechanism"""
        while self.is_running:
            for integration in self.integrations.values():
                try:
                    await integration.retry_failed_events()
                except Exception as e:
                    logger.error(f"Error retrying events for {integration.name}: {e}")

            await asyncio.sleep(60)  # Retry every minute

# Utility decorators
def rate_limit(calls_per_minute: int):
    """Rate limiting decorator for API calls"""
    def decorator(func):
        calls = []

        @wraps(func)
        async def wrapper(*args, **kwargs):
            now = time.time()
            calls[:] = [call_time for call_time in calls if now - call_time < 60]

            if len(calls) >= calls_per_minute:
                sleep_time = 60 - (now - calls[0])
                await asyncio.sleep(sleep_time)

            calls.append(now)
            return await func(*args, **kwargs)

        return wrapper
    return decorator

def retry(max_attempts: int = 3, delay: float = 1.0):
    """Retry decorator for API calls"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(delay * (2 ** attempt))
                    else:
                        break

            raise last_exception

        return wrapper
    return decorator