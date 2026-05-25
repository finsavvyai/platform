"""
Health check endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
import logging

from app.core.database import get_db
from app.core.redis import redis_client

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/")
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "UPM.Plus API"
    }


@router.get("/detailed")
async def detailed_health_check(db: AsyncSession = Depends(get_db)):
    """Detailed health check with dependency status"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "UPM.Plus API",
        "version": "0.1.0",
        "dependencies": {}
    }
    
    # Check database
    try:
        await db.execute("SELECT 1")
        health_status["dependencies"]["database"] = {
            "status": "healthy",
            "type": "postgresql"
        }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        health_status["dependencies"]["database"] = {
            "status": "unhealthy",
            "error": str(e),
            "type": "postgresql"
        }
        health_status["status"] = "degraded"
    
    # Check Redis
    try:
        await redis_client.ping()
        health_status["dependencies"]["redis"] = {
            "status": "healthy",
            "type": "redis"
        }
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        health_status["dependencies"]["redis"] = {
            "status": "unhealthy",
            "error": str(e),
            "type": "redis"
        }
        health_status["status"] = "degraded"
    
    # Check AI services (optional)
    try:
        from app.services.llm import LLMService
        llm_service = LLMService()
        if await llm_service.health_check():
            health_status["dependencies"]["llm"] = {
                "status": "healthy",
                "type": "openai"
            }
        else:
            health_status["dependencies"]["llm"] = {
                "status": "unhealthy",
                "type": "openai"
            }
    except Exception as e:
        health_status["dependencies"]["llm"] = {
            "status": "unavailable",
            "error": str(e),
            "type": "openai"
        }
    
    # Return appropriate status code
    if health_status["status"] == "unhealthy":
        raise HTTPException(status_code=503, detail=health_status)
    
    return health_status


@router.get("/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness check for Kubernetes"""
    try:
        # Check if we can connect to database
        await db.execute("SELECT 1")
        
        # Check if we can connect to Redis
        await redis_client.ping()
        
        return {"status": "ready"}
    
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(status_code=503, detail={"status": "not ready", "error": str(e)})


@router.get("/live")
async def liveness_check():
    """Liveness check for Kubernetes"""
    return {"status": "alive"}