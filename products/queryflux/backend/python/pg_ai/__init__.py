"""
PGDesk AI Module
Advanced AI-powered features for PostgreSQL management
"""

from .sql_assistant import SQLAssistant
from .health_monitor import HealthMonitor
from .schema_optimizer import SchemaOptimizer
from .query_learner import QueryPatternLearner
from .insights_engine import DataInsightsEngine
from .config import AIConfig

__version__ = "1.0.0"
__all__ = [
    "SQLAssistant",
    "HealthMonitor", 
    "SchemaOptimizer",
    "QueryPatternLearner",
    "DataInsightsEngine",
    "AIConfig"
]