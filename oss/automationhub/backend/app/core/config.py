"""
Configuration settings for UPM.Plus
"""

from pydantic_settings import BaseSettings
from pydantic import Field, ConfigDict
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings"""
    
    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra='ignore'  # Ignore extra environment variables
    )
    
    # Application
    APP_NAME: str = "UPM.Plus"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    DEBUG: bool = Field(default=True, env="DEBUG")
    
    # API
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = Field(default="dev_secret_key_change_in_production", env="SECRET_KEY")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    
    # CORS
    ALLOWED_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        env="ALLOWED_ORIGINS"
    )
    ALLOWED_HOSTS: List[str] = Field(
        default=["localhost", "127.0.0.1"],
        env="ALLOWED_HOSTS"
    )
    
    # Database Configuration
    DATABASE_URL: str = Field(default="sqlite+aiosqlite:///./test.db", env="DATABASE_URL")
    DATABASE_ECHO: bool = Field(default=False, env="DATABASE_ECHO")
    
    # Cloudflare D1 Configuration
    CLOUDFLARE_D1_DATABASE_URL: Optional[str] = Field(default=None, env="CLOUDFLARE_D1_DATABASE_URL")
    CLOUDFLARE_D1_ACCOUNT_ID: Optional[str] = Field(default=None, env="CLOUDFLARE_ACCOUNT_ID")
    CLOUDFLARE_D1_DATABASE_ID: Optional[str] = Field(default=None, env="CLOUDFLARE_D1_DATABASE_ID")
    CLOUDFLARE_D1_API_TOKEN: Optional[str] = Field(default=None, env="CLOUDFLARE_API_TOKEN")
    CLOUDFLARE_D1_SCHEMA: str = Field(default="upmplus", env="CLOUDFLARE_D1_SCHEMA")
    
    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")
    
    # Celery
    CELERY_BROKER_URL: str = Field(default="redis://localhost:6379/1", env="CELERY_BROKER_URL")
    CELERY_RESULT_BACKEND: str = Field(default="redis://localhost:6379/1", env="CELERY_RESULT_BACKEND")
    
    # AI Services
    OPENAI_API_KEY: Optional[str] = Field(default=None, env="OPENAI_API_KEY")
    ANTHROPIC_API_KEY: Optional[str] = Field(default=None, env="ANTHROPIC_API_KEY")
    
    # Vector Database
    CHROMA_HOST: str = Field(default="localhost", env="CHROMA_HOST")
    CHROMA_PORT: int = Field(default=8000, env="CHROMA_PORT")
    PINECONE_API_KEY: Optional[str] = Field(default=None, env="PINECONE_API_KEY")
    PINECONE_ENVIRONMENT: Optional[str] = Field(default=None, env="PINECONE_ENVIRONMENT")
    
    # Browser Automation
    BROWSER_HEADLESS: bool = Field(default=True, env="BROWSER_HEADLESS")
    BROWSER_TIMEOUT: int = Field(default=30, env="BROWSER_TIMEOUT")
    
    # Infrastructure
    ANSIBLE_VAULT_PASSWORD: Optional[str] = Field(default=None, env="ANSIBLE_VAULT_PASSWORD")
    
    # MCP Protocol
    MCP_SERVER_HOST: str = Field(default="localhost", env="MCP_SERVER_HOST")
    MCP_SERVER_PORT: int = Field(default=8001, env="MCP_SERVER_PORT")
    
    # Quantum Computing
    QUANTUM_BACKEND: str = Field(default="simulator", env="QUANTUM_BACKEND")
    IBM_QUANTUM_TOKEN: Optional[str] = Field(default=None, env="IBM_QUANTUM_TOKEN")
    
    # Monitoring
    SENTRY_DSN: Optional[str] = Field(default=None, env="SENTRY_DSN")
    PROMETHEUS_PORT: int = Field(default=8002, env="PROMETHEUS_PORT")
    
    # File Storage
    UPLOAD_DIR: str = Field(default="uploads", env="UPLOAD_DIR")
    MAX_FILE_SIZE: int = Field(default=100 * 1024 * 1024, env="MAX_FILE_SIZE")  # 100MB
    
    # Security
    BCRYPT_ROUNDS: int = Field(default=12, env="BCRYPT_ROUNDS")
    MFA_ENCRYPTION_KEY: Optional[str] = Field(default=None, env="MFA_ENCRYPTION_KEY")
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=30, env="REFRESH_TOKEN_EXPIRE_DAYS")

    # MFA Settings
    MFA_ISSUER: str = Field(default="UPM.Plus", env="MFA_ISSUER")
    MFA_TOTP_VALIDITY_WINDOW: int = Field(default=1, env="MFA_TOTP_VALIDITY_WINDOW")
    MFA_BACKUP_CODES_COUNT: int = Field(default=10, env="MFA_BACKUP_CODES_COUNT")
    MFA_MAX_ATTEMPTS: int = Field(default=3, env="MFA_MAX_ATTEMPTS")
    MFA_COOLDOWN_MINUTES: int = Field(default=5, env="MFA_COOLDOWN_MINUTES")

    # SMS Settings (Twilio)
    TWILIO_ACCOUNT_SID: Optional[str] = Field(default=None, env="TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN: Optional[str] = Field(default=None, env="TWILIO_AUTH_TOKEN")
    TWILIO_PHONE_NUMBER: Optional[str] = Field(default=None, env="TWILIO_PHONE_NUMBER")
    SMS_ENABLED: bool = Field(default=False, env="SMS_ENABLED")
    
    # HashiCorp Vault
    VAULT_URL: str = Field(default="http://localhost:8200", env="VAULT_URL")
    VAULT_TOKEN: Optional[str] = Field(default=None, env="VAULT_TOKEN")
    VAULT_ROLE_ID: Optional[str] = Field(default=None, env="VAULT_ROLE_ID")
    VAULT_SECRET_ID: Optional[str] = Field(default=None, env="VAULT_SECRET_ID")
    VAULT_NAMESPACE: Optional[str] = Field(default=None, env="VAULT_NAMESPACE")
    
    # OAuth Providers
    GOOGLE_CLIENT_ID: Optional[str] = Field(default=None, env="GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: Optional[str] = Field(default=None, env="GOOGLE_CLIENT_SECRET")
    MICROSOFT_CLIENT_ID: Optional[str] = Field(default=None, env="MICROSOFT_CLIENT_ID")
    MICROSOFT_CLIENT_SECRET: Optional[str] = Field(default=None, env="MICROSOFT_CLIENT_SECRET")
    GITHUB_CLIENT_ID: Optional[str] = Field(default=None, env="GITHUB_CLIENT_ID")
    GITHUB_CLIENT_SECRET: Optional[str] = Field(default=None, env="GITHUB_CLIENT_SECRET")
    
    # Admin Security
    ADMIN_ALLOWED_IPS: str = Field(default="127.0.0.1,::1", env="ADMIN_ALLOWED_IPS")
    
    # Email (for password reset)
    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int = Field(default=48, env="EMAIL_RESET_TOKEN_EXPIRE_HOURS")


# Create settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get application settings instance."""
    return settings


# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)