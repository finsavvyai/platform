"""
AI/ML Service for QuantumBeam Fraud Detection
Provides Hugging Face model inference and LLM provider integration
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.models import ModelManager
from app.providers import LLMProviderManager
from app.api import router
from app.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global managers
model_manager = None
llm_provider_manager = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global model_manager, llm_provider_manager
    
    # Startup
    logger.info("Starting AI/ML service...")
    model_manager = ModelManager()
    llm_provider_manager = LLMProviderManager()
    
    # Load default models
    await model_manager.load_default_models()
    
    # Initialize LLM providers
    llm_provider_manager.set_model_manager(model_manager)
    await llm_provider_manager.initialize_providers()
    
    logger.info("AI/ML service started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down AI/ML service...")
    if model_manager:
        await model_manager.cleanup()
    if llm_provider_manager:
        await llm_provider_manager.cleanup()


app = FastAPI(
    title="QuantumBeam AI/ML Service",
    description="Hugging Face and LLM integration for fraud detection",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ai-ml",
        "models_loaded": len(model_manager.loaded_models) if model_manager else 0,
        "providers_available": len(llm_provider_manager.providers) if llm_provider_manager else 0
    }


def get_model_manager() -> ModelManager:
    """Dependency to get model manager"""
    if not model_manager:
        raise HTTPException(status_code=503, detail="Model manager not initialized")
    return model_manager


def get_llm_provider_manager() -> LLMProviderManager:
    """Dependency to get LLM provider manager"""
    if not llm_provider_manager:
        raise HTTPException(status_code=503, detail="LLM provider manager not initialized")
    return llm_provider_manager


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )