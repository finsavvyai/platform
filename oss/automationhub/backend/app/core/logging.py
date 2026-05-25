"""
Logging configuration for UPM.Plus
"""

import logging
import sys
from typing import Dict, Any
import structlog
from rich.logging import RichHandler
from rich.console import Console

from app.core.config import settings


def setup_logging():
    """Setup structured logging with rich formatting"""
    
    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer() if settings.ENVIRONMENT == "production" 
            else structlog.dev.ConsoleRenderer(colors=True)
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Configure standard logging
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO
    
    # Create console for rich handler
    console = Console(stderr=True)
    
    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format="%(message)s",
        datefmt="[%X]",
        handlers=[
            RichHandler(
                console=console,
                rich_tracebacks=True,
                tracebacks_show_locals=settings.DEBUG
            )
        ] if settings.ENVIRONMENT != "production" else [
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Set specific logger levels
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.DATABASE_ECHO else logging.WARNING
    )
    logging.getLogger("celery").setLevel(logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    
    # Create application logger
    logger = structlog.get_logger("upm-plus")
    logger.info("Logging configured", environment=settings.ENVIRONMENT, debug=settings.DEBUG)
    
    return logger


class LoggerMixin:
    """Mixin to add structured logging to classes"""
    
    @property
    def logger(self):
        """Get logger for this class"""
        return structlog.get_logger(self.__class__.__name__)
    
    def log_event(self, event: str, **kwargs):
        """Log an event with context"""
        self.logger.info(event, **kwargs)
    
    def log_error(self, error: Exception, context: Dict[str, Any] = None):
        """Log an error with context"""
        self.logger.error(
            "Error occurred",
            error=str(error),
            error_type=type(error).__name__,
            context=context or {}
        )