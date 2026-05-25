"""
Configuration settings for AI/ML service
"""

import os
from typing import List, Optional
from pydantic import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # Server configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    DEBUG: bool = False
    
    # Model configuration
    DEFAULT_MODELS: List[str] = [
        "distilbert-base-uncased-finetuned-sst-2-english",  # Sentiment analysis
        "microsoft/DialoGPT-medium",  # Text generation
        "sentence-transformers/all-MiniLM-L6-v2"  # Embeddings
    ]
    
    # Cache configuration
    REDIS_URL: str = "redis://localhost:6379"
    MODEL_CACHE_TTL: int = 3600  # 1 hour
    
    # LLM Provider configuration
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    
    # Performance settings
    MAX_BATCH_SIZE: int = 32
    MODEL_TIMEOUT: int = 30
    
    # Hugging Face settings
    HF_CACHE_DIR: str = "./models"
    HF_TOKEN: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()