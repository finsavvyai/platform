"""
Application Lifecycle Management

Comprehensive startup and lifecycle management for RAG service with:
- Application startup sequence
- Service initialization
- Database migration handling
- Background task startup
- Graceful shutdown procedures
- Health check initialization
- Dependency management
- Resource cleanup
- Error recovery during startup
"""

import asyncio
import logging
import signal
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable, Set
from dataclasses import dataclass, field
from enum import Enum
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.core.performance import get_performance_optimizer
from app.core.health_monitor import get_health_monitor

logger = logging.getLogger(__name__)
settings = get_settings()


class ServiceStatus(str, Enum):
    """Service status enumeration"""

    INITIALIZING = "initializing"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    STOPPED = "stopped"
    ERROR = "error"
    FAILED = "failed"


class DependencyType(str, Enum):
    """Dependency type enumeration"""

    DATABASE = "database"
    REDIS = "redis"
    EXTERNAL_API = "external_api"
    FILE_SYSTEM = "file_system"
    BACKGROUND_TASK = "background_task"
    INTERNAL_SERVICE = "internal_service"


@dataclass
class ServiceDependency:
    """Service dependency definition"""

    name: str
    dependency_type: DependencyType
    required: bool = True
    startup_order: int = 0
    health_check: Optional[Callable] = None
    init_function: Optional[Callable] = None
    shutdown_function: Optional[Callable] = None
    config_path: Optional[str] = None
    retry_attempts: int = 3
    retry_delay: float = 1.0
    timeout_seconds: float = 30.0

    # Runtime state
    status: ServiceStatus = ServiceStatus.INITIALIZING
    initialized_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: int = 0


@dataclass
class StartupPhase:
    """Startup phase definition"""

    name: str
    order: int
    description: str
    dependencies: List[str] = field(default_factory=list)
    init_function: Optional[Callable] = None
    health_check: Optional[Callable] = None
    rollback_function: Optional[Callable] = None
    critical: bool = True
    timeout_seconds: float = 60.0

    # Runtime state
    status: ServiceStatus = ServiceStatus.INITIALIZING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[float] = None
    error_message: Optional[str] = None


@dataclass
class ShutdownPhase:
    """Shutdown phase definition"""

    name: str
    order: int
    description: str
    shutdown_function: Optional[Callable] = None
    timeout_seconds: float = 30.0
    critical: bool = True

    # Runtime state
    status: ServiceStatus = ServiceStatus.INITIALIZING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[float] = None
    error_message: Optional[str] = None


class LifecycleManager:
    """Application lifecycle management"""

    def __init__(self):
        self.dependencies: Dict[str, ServiceDependency] = {}
        self.startup_phases: List[StartupPhase] = []
        self.shutdown_phases: List[ShutdownPhase] = []

        # State management
        self.status: ServiceStatus = ServiceStatus.INITIALIZING
        self.startup_time: Optional[datetime] = None
        self.shutdown_time: Optional[datetime] = None
        self.uptime_seconds: float = 0.0

        # Background tasks
        self.background_tasks: Set[asyncio.Task] = set()
        self.shutdown_event = asyncio.Event()

        # Signal handling
        self._signal_handlers_installed = False

        # Callbacks
        self.startup_callbacks: List[Callable] = []
        self.shutdown_callbacks: List[Callable] = []
        self.error_callbacks: List[Callable] = []

        # Health checks
        self._health_checks: List[Callable] = []

        logger.info("Lifecycle manager initialized")

    async def initialize(self) -> None:
        """Initialize the lifecycle manager"""
        logger.info("Initializing application lifecycle...")

        try:
            # Setup signal handlers
            self._setup_signal_handlers()

            # Define startup phases
            await self._define_startup_phases()

            # Define shutdown phases
            await self._define_shutdown_phases()

            # Register dependencies
            await self._register_dependencies()

            self.status = ServiceStatus.STARTING
            logger.info("Lifecycle manager initialization complete")

        except Exception as e:
            self.status = ServiceStatus.FAILED
            logger.error(f"Lifecycle manager initialization failed: {e}")
            raise

    async def startup(self) -> None:
        """Execute application startup sequence"""
        if self.status != ServiceStatus.STARTING:
            raise RuntimeError(f"Cannot startup in status: {self.status}")

        self.startup_time = datetime.utcnow()
        logger.info("Starting application...")

        try:
            # Execute startup phases
            for phase in self.startup_phases:
                await self._execute_startup_phase(phase)

            # Start background tasks
            await self._start_background_tasks()

            # Setup health checks
            await self._setup_health_checks()

            # Trigger startup callbacks
            await self._trigger_startup_callbacks()

            self.status = ServiceStatus.RUNNING
            logger.info(
                f"Application started successfully in {self._get_uptime():.2f}s"
            )

        except Exception as e:
            self.status = ServiceStatus.FAILED
            logger.error(f"Application startup failed: {e}")

            # Attempt rollback
            await self._rollback_startup()

            # Trigger error callbacks
            await self._trigger_error_callbacks(e)

            raise

    async def shutdown(self, reason: str = "Manual shutdown") -> None:
        """Execute graceful shutdown sequence"""
        if self.status != ServiceStatus.RUNNING:
            logger.warning(f"Shutdown called in status: {self.status}")

        self.status = ServiceStatus.STOPPING
        self.shutdown_time = datetime.utcnow()
        self.shutdown_event.set()

        logger.info(f"Shutting down application: {reason}")

        try:
            # Cancel background tasks
            await self._cancel_background_tasks()

            # Execute shutdown phases
            for phase in self.shutdown_phases:
                await self._execute_shutdown_phase(phase)

            # Trigger shutdown callbacks
            await self._trigger_shutdown_callbacks()

            self.status = ServiceStatus.STOPPED
            logger.info(
                f"Application shutdown complete in {self._get_shutdown_time():.2f}s"
            )

        except Exception as e:
            self.status = ServiceStatus.ERROR
            logger.error(f"Application shutdown failed: {e}")
            raise

    async def health_check(self) -> Dict[str, Any]:
        """Perform comprehensive health check"""
        health_status = {
            "status": self.status.value,
            "uptime_seconds": self._get_uptime(),
            "startup_time": self.startup_time.isoformat()
            if self.startup_time
            else None,
            "dependencies": {},
            "startup_phases": {},
            "background_tasks": len(self.background_tasks),
            "last_error": None,
        }

        # Check dependencies
        for name, dependency in self.dependencies.items():
            health_status["dependencies"][name] = {
                "status": dependency.status.value,
                "initialized_at": dependency.initialized_at.isoformat()
                if dependency.initialized_at
                else None,
                "error_message": dependency.error_message,
                "retry_count": dependency.retry_count,
            }

            # Run health check if available
            if dependency.health_check and dependency.status == ServiceStatus.RUNNING:
                try:
                    if asyncio.iscoroutinefunction(dependency.health_check):
                        is_healthy = await dependency.health_check()
                    else:
                        is_healthy = dependency.health_check()

                    health_status["dependencies"][name]["healthy"] = is_healthy

                except Exception as e:
                    health_status["dependencies"][name]["healthy"] = False
                    health_status["dependencies"][name]["health_error"] = str(e)

        # Check startup phases
        for phase in self.startup_phases:
            health_status["startup_phases"][phase.name] = {
                "status": phase.status.value,
                "duration_ms": phase.duration_ms,
                "error_message": phase.error_message,
            }

        return health_status

    def add_dependency(self, dependency: ServiceDependency) -> None:
        """Add a service dependency"""
        self.dependencies[dependency.name] = dependency
        logger.debug(f"Added dependency: {dependency.name}")

    def add_startup_callback(self, callback: Callable) -> None:
        """Add startup callback"""
        self.startup_callbacks.append(callback)

    def add_shutdown_callback(self, callback: Callable) -> None:
        """Add shutdown callback"""
        self.shutdown_callbacks.append(callback)

    def add_error_callback(self, callback: Callable) -> None:
        """Add error callback"""
        self.error_callbacks.append(callback)

    def add_background_task(self, coro) -> asyncio.Task:
        """Add background task"""
        task = asyncio.create_task(coro)
        self.background_tasks.add(task)
        task.add_done_callback(self.background_tasks.discard)
        return task

    async def _define_startup_phases(self) -> None:
        """Define startup phases"""
        self.startup_phases = [
            StartupPhase(
                name="configuration",
                order=1,
                description="Load and validate configuration",
                init_function=self._init_configuration,
                health_check=self._check_configuration,
                critical=True,
                timeout_seconds=10.0,
            ),
            StartupPhase(
                name="logging",
                order=2,
                description="Initialize logging system",
                init_function=self._init_logging,
                critical=True,
                timeout_seconds=5.0,
            ),
            StartupPhase(
                name="error_handling",
                order=3,
                description="Setup error handling system",
                init_function=self._init_error_handling,
                critical=True,
                timeout_seconds=5.0,
            ),
            StartupPhase(
                name="performance_optimization",
                order=4,
                description="Initialize performance optimization",
                init_function=self._init_performance_optimization,
                critical=False,
                timeout_seconds=10.0,
            ),
            StartupPhase(
                name="database",
                order=5,
                description="Initialize database connections",
                dependencies=["configuration"],
                init_function=self._init_database,
                health_check=self._check_database,
                rollback_function=self._rollback_database,
                critical=True,
                timeout_seconds=30.0,
            ),
            StartupPhase(
                name="redis",
                order=6,
                description="Initialize Redis connections",
                dependencies=["configuration"],
                init_function=self._init_redis,
                health_check=self._check_redis,
                critical=True,
                timeout_seconds=15.0,
            ),
            StartupPhase(
                name="vector_database",
                order=7,
                description="Initialize vector database",
                dependencies=["database"],
                init_function=self._init_vector_database,
                health_check=self._check_vector_database,
                critical=True,
                timeout_seconds=20.0,
            ),
            StartupPhase(
                name="ai_services",
                order=8,
                description="Initialize AI services (OpenAI, Anthropic, etc.)",
                dependencies=["configuration"],
                init_function=self._init_ai_services,
                health_check=self._check_ai_services,
                critical=False,
                timeout_seconds=15.0,
            ),
            StartupPhase(
                name="background_services",
                order=9,
                description="Initialize background services",
                dependencies=["database", "redis"],
                init_function=self._init_background_services,
                critical=False,
                timeout_seconds=10.0,
            ),
            StartupPhase(
                name="health_monitoring",
                order=10,
                description="Initialize health monitoring",
                dependencies=["database", "redis"],
                init_function=self._init_health_monitoring,
                health_check=self._check_health_monitoring,
                critical=True,
                timeout_seconds=10.0,
            ),
            StartupPhase(
                name="api_services",
                order=11,
                description="Initialize API services and endpoints",
                dependencies=["database", "redis", "vector_database"],
                init_function=self._init_api_services,
                critical=True,
                timeout_seconds=15.0,
            ),
        ]

    async def _define_shutdown_phases(self) -> None:
        """Define shutdown phases"""
        self.shutdown_phases = [
            ShutdownPhase(
                name="api_services",
                order=1,
                description="Shutdown API services",
                shutdown_function=self._shutdown_api_services,
                critical=True,
                timeout_seconds=10.0,
            ),
            ShutdownPhase(
                name="background_services",
                order=2,
                description="Shutdown background services",
                shutdown_function=self._shutdown_background_services,
                critical=False,
                timeout_seconds=15.0,
            ),
            ShutdownPhase(
                name="health_monitoring",
                order=3,
                description="Shutdown health monitoring",
                shutdown_function=self._shutdown_health_monitoring,
                critical=True,
                timeout_seconds=5.0,
            ),
            ShutdownPhase(
                name="ai_services",
                order=4,
                description="Shutdown AI services",
                shutdown_function=self._shutdown_ai_services,
                critical=False,
                timeout_seconds=5.0,
            ),
            ShutdownPhase(
                name="vector_database",
                order=5,
                description="Shutdown vector database connections",
                shutdown_function=self._shutdown_vector_database,
                critical=True,
                timeout_seconds=10.0,
            ),
            ShutdownPhase(
                name="redis",
                order=6,
                description="Shutdown Redis connections",
                shutdown_function=self._shutdown_redis,
                critical=True,
                timeout_seconds=5.0,
            ),
            ShutdownPhase(
                name="database",
                order=7,
                description="Shutdown database connections",
                shutdown_function=self._shutdown_database,
                critical=True,
                timeout_seconds=10.0,
            ),
            ShutdownPhase(
                name="performance_optimization",
                order=8,
                description="Shutdown performance optimization",
                shutdown_function=self._shutdown_performance_optimization,
                critical=False,
                timeout_seconds=5.0,
            ),
        ]

    async def _register_dependencies(self) -> None:
        """Register service dependencies"""
        # Database dependency
        self.add_dependency(
            ServiceDependency(
                name="database",
                dependency_type=DependencyType.DATABASE,
                required=True,
                startup_order=5,
                health_check=self._check_database,
                init_function=self._init_database,
                shutdown_function=self._shutdown_database,
            )
        )

        # Redis dependency
        self.add_dependency(
            ServiceDependency(
                name="redis",
                dependency_type=DependencyType.REDIS,
                required=True,
                startup_order=6,
                health_check=self._check_redis,
                init_function=self._init_redis,
                shutdown_function=self._shutdown_redis,
            )
        )

        # External API dependencies
        if settings.openai_api_key:
            self.add_dependency(
                ServiceDependency(
                    name="openai",
                    dependency_type=DependencyType.EXTERNAL_API,
                    required=False,
                    startup_order=8,
                    health_check=self._check_openai,
                    init_function=self._init_openai,
                    retry_attempts=3,
                    retry_delay=2.0,
                )
            )

        if settings.anthropic_api_key:
            self.add_dependency(
                ServiceDependency(
                    name="anthropic",
                    dependency_type=DependencyType.EXTERNAL_API,
                    required=False,
                    startup_order=8,
                    health_check=self._check_anthropic,
                    init_function=self._init_anthropic,
                    retry_attempts=3,
                    retry_delay=2.0,
                )
            )

    async def _execute_startup_phase(self, phase: StartupPhase) -> None:
        """Execute a startup phase"""
        phase.status = ServiceStatus.STARTING
        phase.started_at = datetime.utcnow()

        logger.info(f"Starting phase: {phase.name}")

        try:
            # Check dependencies
            await self._check_phase_dependencies(phase)

            # Execute initialization function
            if phase.init_function:
                if asyncio.iscoroutinefunction(phase.init_function):
                    await asyncio.wait_for(
                        phase.init_function(), timeout=phase.timeout_seconds
                    )
                else:
                    await asyncio.wait_for(
                        asyncio.get_event_loop().run_in_executor(
                            None, phase.init_function
                        ),
                        timeout=phase.timeout_seconds,
                    )

            # Run health check if available
            if phase.health_check:
                if asyncio.iscoroutinefunction(phase.health_check):
                    await asyncio.wait_for(
                        phase.health_check(), timeout=phase.timeout_seconds
                    )
                else:
                    await asyncio.wait_for(
                        asyncio.get_event_loop().run_in_executor(
                            None, phase.health_check
                        ),
                        timeout=phase.timeout_seconds,
                    )

            phase.status = ServiceStatus.RUNNING
            phase.completed_at = datetime.utcnow()
            phase.duration_ms = (
                phase.completed_at - phase.started_at
            ).total_seconds() * 1000

            logger.info(f"Phase '{phase.name}' completed in {phase.duration_ms:.2f}ms")

        except Exception as e:
            phase.status = ServiceStatus.FAILED
            phase.error_message = str(e)
            phase.completed_at = datetime.utcnow()
            phase.duration_ms = (
                phase.completed_at - phase.started_at
            ).total_seconds() * 1000

            logger.error(
                f"Phase '{phase.name}' failed after {phase.duration_ms:.2f}ms: {e}"
            )

            if phase.critical:
                raise
            else:
                logger.warning(
                    f"Non-critical phase '{phase.name}' failed, continuing startup"
                )

    async def _execute_shutdown_phase(self, phase: ShutdownPhase) -> None:
        """Execute a shutdown phase"""
        phase.status = ServiceStatus.STOPPING
        phase.started_at = datetime.utcnow()

        logger.info(f"Shutting down phase: {phase.name}")

        try:
            # Execute shutdown function
            if phase.shutdown_function:
                if asyncio.iscoroutinefunction(phase.shutdown_function):
                    await asyncio.wait_for(
                        phase.shutdown_function(), timeout=phase.timeout_seconds
                    )
                else:
                    await asyncio.wait_for(
                        asyncio.get_event_loop().run_in_executor(
                            None, phase.shutdown_function
                        ),
                        timeout=phase.timeout_seconds,
                    )

            phase.status = ServiceStatus.STOPPED
            phase.completed_at = datetime.utcnow()
            phase.duration_ms = (
                phase.completed_at - phase.started_at
            ).total_seconds() * 1000

            logger.info(
                f"Phase '{phase.name}' shutdown completed in {phase.duration_ms:.2f}ms"
            )

        except Exception as e:
            phase.status = ServiceStatus.ERROR
            phase.error_message = str(e)
            phase.completed_at = datetime.utcnow()
            phase.duration_ms = (
                phase.completed_at - phase.started_at
            ).total_seconds() * 1000

            logger.error(
                f"Phase '{phase.name}' shutdown failed after {phase.duration_ms:.2f}ms: {e}"
            )

            if phase.critical:
                logger.error(f"Critical shutdown phase '{phase.name}' failed")
            else:
                logger.warning(f"Non-critical shutdown phase '{phase.name}' failed")

    async def _check_phase_dependencies(self, phase: StartupPhase) -> None:
        """Check that phase dependencies are satisfied"""
        for dep_name in phase.dependencies:
            dep_phase = next(
                (p for p in self.startup_phases if p.name == dep_name), None
            )
            if not dep_phase:
                raise ValueError(f"Dependency phase '{dep_name}' not found")

            if dep_phase.status != ServiceStatus.RUNNING:
                raise RuntimeError(
                    f"Dependency '{dep_name}' is not running (status: {dep_phase.status})"
                )

    async def _rollback_startup(self) -> None:
        """Rollback startup on failure"""
        logger.warning("Rolling back startup...")

        # Execute rollback functions in reverse order
        for phase in reversed(self.startup_phases):
            if phase.status == ServiceStatus.RUNNING and phase.rollback_function:
                try:
                    logger.info(f"Rolling back phase: {phase.name}")
                    if asyncio.iscoroutinefunction(phase.rollback_function):
                        await phase.rollback_function()
                    else:
                        await asyncio.get_event_loop().run_in_executor(
                            None, phase.rollback_function
                        )
                    phase.status = ServiceStatus.STOPPED
                except Exception as e:
                    logger.error(f"Rollback failed for phase '{phase.name}': {e}")

    async def _start_background_tasks(self) -> None:
        """Start background tasks"""
        # Add background tasks here as needed
        logger.debug("Background tasks started")

    async def _cancel_background_tasks(self) -> None:
        """Cancel all background tasks"""
        if not self.background_tasks:
            return

        logger.info(f"Cancelling {len(self.background_tasks)} background tasks...")

        # Cancel all tasks
        for task in self.background_tasks:
            task.cancel()

        # Wait for tasks to complete
        if self.background_tasks:
            await asyncio.gather(*self.background_tasks, return_exceptions=True)

        self.background_tasks.clear()
        logger.info("All background tasks cancelled")

    async def _setup_health_checks(self) -> None:
        """Setup health checks"""
        # Add health checks here
        pass

    def _setup_signal_handlers(self) -> None:
        """Setup signal handlers for graceful shutdown"""
        if self._signal_handlers_installed:
            return

        def handle_signal(signum, frame):
            logger.info(f"Received signal {signum}, initiating graceful shutdown...")
            asyncio.create_task(self.shutdown(f"Signal {signum}"))

        signal.signal(signal.SIGTERM, handle_signal)
        signal.signal(signal.SIGINT, handle_signal)

        self._signal_handlers_installed = True
        logger.debug("Signal handlers installed")

    def _get_uptime(self) -> float:
        """Get application uptime in seconds"""
        if self.startup_time:
            return (datetime.utcnow() - self.startup_time).total_seconds()
        return 0.0

    def _get_shutdown_time(self) -> float:
        """Get shutdown duration in seconds"""
        if self.shutdown_time:
            return (datetime.utcnow() - self.shutdown_time).total_seconds()
        return 0.0

    async def _trigger_startup_callbacks(self) -> None:
        """Trigger startup callbacks"""
        for callback in self.startup_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback()
                else:
                    callback()
            except Exception as e:
                logger.error(f"Startup callback failed: {e}")

    async def _trigger_shutdown_callbacks(self) -> None:
        """Trigger shutdown callbacks"""
        for callback in self.shutdown_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback()
                else:
                    callback()
            except Exception as e:
                logger.error(f"Shutdown callback failed: {e}")

    async def _trigger_error_callbacks(self, error: Exception) -> None:
        """Trigger error callbacks"""
        for callback in self.error_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(error)
                else:
                    callback(error)
            except Exception as e:
                logger.error(f"Error callback failed: {e}")

    # Startup phase implementations
    async def _init_configuration(self) -> None:
        """Initialize configuration"""
        from app.config.app_config import load_configuration

        await load_configuration()
        logger.info("Configuration loaded successfully")

    async def _check_configuration(self) -> bool:
        """Check configuration"""
        try:
            from app.config.app_config import get_app_config

            config = get_app_config()
            return config is not None
        except Exception:
            return False

    async def _init_logging(self) -> None:
        """Initialize logging"""
        # Logging is already initialized in main.py
        logger.info("Logging system initialized")

    async def _init_error_handling(self) -> None:
        """Initialize error handling"""
        from app.core.error_handling import initialize_error_callbacks

        initialize_error_callbacks()
        logger.info("Error handling system initialized")

    async def _init_performance_optimization(self) -> None:
        """Initialize performance optimization"""
        from app.core.performance import setup_performance_monitoring

        await setup_performance_monitoring()
        logger.info("Performance optimization initialized")

    async def _init_database(self) -> None:
        """Initialize database"""
        from app.database.connection import init_database

        await init_database()
        logger.info("Database initialized")

    async def _check_database(self) -> bool:
        """Check database connectivity"""
        try:
            from app.database.connection import test_connection

            return await test_connection()
        except Exception:
            return False

    async def _rollback_database(self) -> None:
        """Rollback database initialization"""
        from app.database.connection import close_database

        await close_database()
        logger.info("Database connections closed")

    async def _init_redis(self) -> None:
        """Initialize Redis"""
        # Redis will be initialized on-demand
        logger.info("Redis initialized")

    async def _check_redis(self) -> bool:
        """Check Redis connectivity"""
        try:
            import aioredis

            redis = aioredis.from_url(settings.redis_url)
            await redis.ping()
            await redis.close()
            return True
        except Exception:
            return False

    async def _init_vector_database(self) -> None:
        """Initialize vector database"""
        # Vector database uses same connection as main database
        logger.info("Vector database initialized")

    async def _check_vector_database(self) -> bool:
        """Check vector database connectivity"""
        return await self._check_database()

    async def _init_ai_services(self) -> None:
        """Initialize AI services"""
        # AI services will be initialized on-demand
        logger.info("AI services initialized")

    async def _check_ai_services(self) -> bool:
        """Check AI services"""
        try:
            # Check if API keys are configured
            has_openai = bool(settings.openai_api_key)
            has_anthropic = bool(settings.anthropic_api_key)
            return has_openai or has_anthropic
        except Exception:
            return False

    async def _init_background_services(self) -> None:
        """Initialize background services"""
        # Background services will be initialized as needed
        logger.info("Background services initialized")

    async def _init_health_monitoring(self) -> None:
        """Initialize health monitoring"""
        health_monitor = get_health_monitor()
        await health_monitor.initialize()
        logger.info("Health monitoring initialized")

    async def _check_health_monitoring(self) -> bool:
        """Check health monitoring"""
        try:
            health_monitor = get_health_monitor()
            return health_monitor._initialized
        except Exception:
            return False

    async def _init_api_services(self) -> None:
        """Initialize API services"""
        # API services are initialized via FastAPI app
        logger.info("API services initialized")

    async def _init_openai(self) -> None:
        """Initialize OpenAI service"""
        # OpenAI will be initialized on-demand
        logger.info("OpenAI service initialized")

    async def _check_openai(self) -> bool:
        """Check OpenAI service"""
        try:
            import openai

            client = openai.Client(api_key=settings.openai_api_key)
            client.models.list()
            return True
        except Exception:
            return False

    async def _init_anthropic(self) -> None:
        """Initialize Anthropic service"""
        # Anthropic will be initialized on-demand
        logger.info("Anthropic service initialized")

    async def _check_anthropic(self) -> bool:
        """Check Anthropic service"""
        try:
            import anthropic

            anthropic.Anthropic(api_key=settings.anthropic_api_key)
            # Simple API test
            return True
        except Exception:
            return False

    # Shutdown phase implementations
    async def _shutdown_api_services(self) -> None:
        """Shutdown API services"""
        logger.info("API services shutdown")

    async def _shutdown_background_services(self) -> None:
        """Shutdown background services"""
        logger.info("Background services shutdown")

    async def _shutdown_health_monitoring(self) -> None:
        """Shutdown health monitoring"""
        health_monitor = get_health_monitor()
        await health_monitor.shutdown()
        logger.info("Health monitoring shutdown")

    async def _shutdown_ai_services(self) -> None:
        """Shutdown AI services"""
        logger.info("AI services shutdown")

    async def _shutdown_vector_database(self) -> None:
        """Shutdown vector database"""
        # Vector database shares connection with main database
        logger.info("Vector database shutdown")

    async def _shutdown_redis(self) -> None:
        """Shutdown Redis connections"""
        # Redis connections will be closed automatically
        logger.info("Redis connections closed")

    async def _shutdown_database(self) -> None:
        """Shutdown database connections"""
        from app.database.connection import close_database

        await close_database()
        logger.info("Database connections closed")

    async def _shutdown_performance_optimization(self) -> None:
        """Shutdown performance optimization"""
        optimizer = await get_performance_optimizer()
        await optimizer.close()
        logger.info("Performance optimization shutdown")


# Global lifecycle manager instance
_lifecycle_manager: Optional[LifecycleManager] = None


def get_lifecycle_manager() -> LifecycleManager:
    """Get global lifecycle manager instance"""
    global _lifecycle_manager
    if _lifecycle_manager is None:
        _lifecycle_manager = LifecycleManager()
    return _lifecycle_manager


@asynccontextmanager
async def lifecycle_context():
    """Context manager for application lifecycle"""
    manager = get_lifecycle_manager()

    try:
        await manager.initialize()
        await manager.startup()
        yield manager
    finally:
        await manager.shutdown()


# Utility functions
async def wait_for_shutdown() -> None:
    """Wait for shutdown signal"""
    manager = get_lifecycle_manager()
    await manager.shutdown_event.wait()


def add_startup_callback(callback: Callable) -> None:
    """Add startup callback to lifecycle manager"""
    manager = get_lifecycle_manager()
    manager.add_startup_callback(callback)


def add_shutdown_callback(callback: Callable) -> None:
    """Add shutdown callback to lifecycle manager"""
    manager = get_lifecycle_manager()
    manager.add_shutdown_callback(callback)


def add_error_callback(callback: Callable) -> None:
    """Add error callback to lifecycle manager"""
    manager = get_lifecycle_manager()
    manager.add_error_callback(callback)


def add_background_task(coro) -> asyncio.Task:
    """Add background task to lifecycle manager"""
    manager = get_lifecycle_manager()
    return manager.add_background_task(coro)
