"""
AI Configuration Management
Handles settings for AI features, model providers, and safety constraints
"""

import os
import json
from typing import Dict, Any, Optional, List
from pathlib import Path
from dataclasses import dataclass, asdict
from enum import Enum

class ModelProvider(Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    OLLAMA = "ollama"
    LOCAL = "local"

class SafetyLevel(Enum):
    STRICT = "strict"      # Read-only, single SELECT with LIMIT
    MODERATE = "moderate"  # Allow some DDL/DML with confirmation
    PERMISSIVE = "permissive"  # Full access with warnings

@dataclass
class AIConfig:
    """AI configuration settings"""
    
    # Model settings
    provider: ModelProvider = ModelProvider.OPENAI
    model_name: str = "gpt-4o-mini"
    api_key: Optional[str] = None
    base_url: Optional[str] = None  # For local/custom endpoints
    temperature: float = 0.1
    max_tokens: int = 2000
    
    # Safety settings
    safety_level: SafetyLevel = SafetyLevel.STRICT
    max_retries: int = 2
    statement_timeout: int = 15  # seconds
    max_rows: int = 50
    require_confirmation: bool = True
    
    # Feature flags
    enable_sql_assistant: bool = True
    enable_health_monitor: bool = True
    enable_schema_optimizer: bool = True
    enable_query_learner: bool = True
    enable_insights_engine: bool = True
    
    # Privacy settings
    anonymize_schema: bool = False
    local_mode_only: bool = False
    telemetry_enabled: bool = False
    
    # Cache settings
    schema_cache_ttl: int = 3600  # 1 hour
    enable_query_cache: bool = True
    cache_directory: str = "~/.pgdesk_ai_cache"
    
    # Budget controls
    max_cost_per_session: float = 5.0  # USD
    warn_cost_threshold: float = 1.0   # USD
    
    @classmethod
    def load_from_file(cls, config_path: Optional[str] = None) -> 'AIConfig':
        """Load configuration from file"""
        if config_path is None:
            config_path = os.path.expanduser("~/.pgdesk_ai_config.json")
        
        if not os.path.exists(config_path):
            return cls.create_default()
        
        try:
            with open(config_path, 'r') as f:
                data = json.load(f)
            
            # Convert string enums back to enum objects
            if 'provider' in data:
                data['provider'] = ModelProvider(data['provider'])
            if 'safety_level' in data:
                data['safety_level'] = SafetyLevel(data['safety_level'])
            
            return cls(**data)
        except Exception as e:
            print(f"Error loading AI config: {e}, using defaults")
            return cls.create_default()
    
    def save_to_file(self, config_path: Optional[str] = None):
        """Save configuration to file"""
        if config_path is None:
            config_path = os.path.expanduser("~/.pgdesk_ai_config.json")
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        
        # Convert to dict and handle enums
        data = asdict(self)
        data['provider'] = self.provider.value
        data['safety_level'] = self.safety_level.value
        
        try:
            with open(config_path, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving AI config: {e}")
    
    @classmethod
    def create_default(cls) -> 'AIConfig':
        """Create default configuration"""
        config = cls()
        
        # Try to get API key from environment
        config.api_key = os.getenv('OPENAI_API_KEY') or os.getenv('ANTHROPIC_API_KEY')
        
        # Auto-detect local mode if no API key
        if not config.api_key:
            config.provider = ModelProvider.OLLAMA
            config.local_mode_only = True
            config.base_url = "http://localhost:11434"
            config.model_name = "llama3.1:8b"
        
        return config
    
    def get_cache_dir(self) -> Path:
        """Get expanded cache directory path"""
        return Path(os.path.expanduser(self.cache_directory))
    
    def validate(self) -> List[str]:
        """Validate configuration and return list of issues"""
        issues = []
        
        # Check API key for cloud providers
        if self.provider in [ModelProvider.OPENAI, ModelProvider.ANTHROPIC]:
            if not self.api_key:
                issues.append(f"API key required for {self.provider.value}")
        
        # Check local endpoints
        if self.provider == ModelProvider.OLLAMA:
            if not self.base_url:
                issues.append("Base URL required for Ollama")
        
        # Validate ranges
        if self.temperature < 0 or self.temperature > 2:
            issues.append("Temperature must be between 0 and 2")
        
        if self.max_tokens < 1:
            issues.append("Max tokens must be positive")
        
        if self.statement_timeout < 1:
            issues.append("Statement timeout must be positive")
        
        if self.max_rows < 1 or self.max_rows > 10000:
            issues.append("Max rows must be between 1 and 10000")
        
        return issues
    
    def is_feature_enabled(self, feature: str) -> bool:
        """Check if a specific feature is enabled"""
        feature_map = {
            'sql_assistant': self.enable_sql_assistant,
            'health_monitor': self.enable_health_monitor,
            'schema_optimizer': self.enable_schema_optimizer,
            'query_learner': self.enable_query_learner,
            'insights_engine': self.enable_insights_engine
        }
        return feature_map.get(feature, False)
    
    def get_model_config(self) -> Dict[str, Any]:
        """Get model-specific configuration"""
        base_config = {
            'model': self.model_name,
            'temperature': self.temperature,
            'max_tokens': self.max_tokens,
        }
        
        if self.provider == ModelProvider.OPENAI:
            base_config['api_key'] = self.api_key
        elif self.provider == ModelProvider.ANTHROPIC:
            base_config['api_key'] = self.api_key
        elif self.provider == ModelProvider.OLLAMA:
            base_config['base_url'] = self.base_url
        
        return base_config


# Global configuration instance
_global_config: Optional[AIConfig] = None

def get_ai_config() -> AIConfig:
    """Get global AI configuration instance"""
    global _global_config
    if _global_config is None:
        _global_config = AIConfig.load_from_file()
    return _global_config

def set_ai_config(config: AIConfig):
    """Set global AI configuration instance"""
    global _global_config
    _global_config = config

def reload_ai_config():
    """Reload configuration from file"""
    global _global_config
    _global_config = AIConfig.load_from_file()