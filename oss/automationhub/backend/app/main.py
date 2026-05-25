"""
UPM.Plus - The Autonomous Digital Ecosystem Orchestrator
Main FastAPI application entry point
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import logging
from contextlib import asynccontextmanager
from datetime import datetime
import uuid

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.cloudflare_d1 import init_d1_database
from app.api.v1.api import api_router
from app.core.redis import redis_client
from app.core.vector_db import knowledge_manager
from app.agents import initialize_agents
from app.services.task_executor import get_task_executor, task_executor
from app.services.browser_use_integration import BrowserUseService
from app.core.database import get_db_session

# Import API Gateway components
from app.gateway.core import api_gateway
from app.gateway.middleware import GatewayMiddleware
from app.gateway.config import gateway_config
from app.gateway.analytics import analytics_engine
from app.gateway.endpoints import router as gateway_router

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting UPM.Plus application...")
    
    # Create database schema and initial data
    await init_d1_database()
    
    # Initialize Redis connection
    await redis_client.ping()
    logger.info("Redis connection established")
    
    # Initialize vector database and knowledge manager
    await knowledge_manager.initialize()
    logger.info("Knowledge management system initialized")

    # Initialize browser automation service
    try:
        browser_service = BrowserUseService()
        await browser_service.initialize()
        logger.info("Browser automation service initialized")
    except Exception as e:
        logger.error(f"Failed to initialize browser service: {e}")
        # Continue startup even if browser service fails to initialize
    
    # Initialize quantum computing layer (if available)
    try:
        from app.services.quantum import QuantumService
        quantum_service = QuantumService()
        await quantum_service.initialize()
        logger.info("Quantum computing layer initialized")
    except ImportError:
        logger.info("Quantum computing layer not available, using classical fallback")
    
    # Initialize API Gateway
    try:
        await api_gateway.initialize()
        await gateway_config.initialize()
        await analytics_engine.start()
        logger.info("API Gateway initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize API Gateway: {e}")
        # Continue startup even if gateway fails to initialize

    # Initialize agent system
    try:
        # Register agent types
        initialize_agents()

        # Initialize task executor (can work without db initially)
        executor = await get_task_executor()
        
        # Create default agents
        from app.agents import BrowserAgent, ConversationalAgent, InfrastructureAgent, DataAgent
        from app.agents.registry import agent_registry

        # Create and register agents
        browser_agent = BrowserAgent(name="DefaultBrowserAgent")
        conversational_agent = ConversationalAgent(name="DefaultConversationalAgent")
        infrastructure_agent = InfrastructureAgent(name="DefaultInfrastructureAgent")
        data_agent = DataAgent(name="DefaultDataAgent")

        # Register with registry
        agent_registry.register_agent(browser_agent)
        agent_registry.register_agent(conversational_agent)
        agent_registry.register_agent(infrastructure_agent)
        agent_registry.register_agent(data_agent)

        # Register with task executor
        await executor.register_agent(browser_agent)
        await executor.register_agent(conversational_agent)
        await executor.register_agent(infrastructure_agent)
        await executor.register_agent(data_agent)

        # Update executor with database session if available
        try:
            async with get_db_session() as db:
                executor.db = db
        except Exception as e:
            logger.warning(f"Could not attach database session to task executor: {e}")

        logger.info("Agent system initialized with 4 default agents")

    except Exception as e:
        logger.error(f"Failed to initialize agent system: {e}")
        import traceback
        logger.error(traceback.format_exc())
        # Continue startup even if agents fail to initialize

    logger.info("UPM.Plus application started successfully with API Gateway")
    
    yield
    
    # Shutdown
    logger.info("Shutting down UPM.Plus application...")

    # Shutdown API Gateway
    try:
        await analytics_engine.stop()
        await api_gateway.shutdown()
        logger.info("API Gateway shutdown complete")
    except Exception as e:
        logger.error(f"Error shutting down API Gateway: {e}")

    # Stop task executor and cleanup agents
    try:
        await task_executor.stop()
        logger.info("Task executor stopped")
    except Exception as e:
        logger.error(f"Error stopping task executor: {e}")

    await redis_client.close()
    await knowledge_manager.vector_db.disconnect()
    logger.info("UPM.Plus application shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="UPM.Plus API - Enterprise Gateway",
    description="The Autonomous Digital Ecosystem Orchestrator with Enterprise API Gateway",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan
)

# Add basic CORS middleware (will be enhanced by gateway middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
)

# Add comprehensive Gateway Middleware (this will apply all gateway features)
try:
    gateway_middleware = GatewayMiddleware(app, gateway_config.get_current_config())
except Exception as e:
    logger.warning(f"Could not initialize gateway middleware: {e}")

# Include API routes
app.include_router(api_router, prefix="/api/v1")

# Include Gateway management routes
try:
    app.include_router(gateway_router)
except Exception as e:
    logger.warning(f"Could not include gateway router: {e}")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "UPM.Plus - The Autonomous Digital Ecosystem Orchestrator",
        "version": "1.0.0",
        "status": "operational with Enterprise API Gateway",
        "features": [
            "API Key Authentication",
            "Rate Limiting",
            "Request/Response Transformation",
            "API Versioning",
            "WebSocket Proxy",
            "Usage Analytics",
            "Security Headers",
            "CORS Support"
        ],
        "docs": "/docs" if settings.ENVIRONMENT != "production" else "Contact support for API documentation",
        "gateway_management": "/api/v1/gateway/health"
    }


@app.get("/api/v1/gateway/info")
async def gateway_info():
    """Get gateway information and status"""
    try:
        gateway_status = api_gateway.get_status()
        gateway_metrics = api_gateway.get_metrics()

        return {
            "gateway": {
                "name": "UPM.Plus Enterprise API Gateway",
                "version": "1.0.0",
                "status": gateway_status,
                "metrics": gateway_metrics,
                "features": {
                    "authentication": True,
                    "rate_limiting": True,
                    "request_transformation": True,
                    "response_transformation": True,
                    "api_versioning": True,
                    "websocket_proxy": True,
                    "usage_analytics": True,
                    "security_headers": True,
                    "cors": True
                }
            }
        }
    except Exception as e:
        logger.error(f"Failed to get gateway info: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve gateway information")


# Request logging middleware (additional to gateway logging)
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Additional request logging middleware"""
    import time

    # Generate request ID if not already set by gateway
    if not hasattr(request.state, 'request_id'):
        request.state.request_id = str(uuid.uuid4())

    start_time = time.time()

    # Log request
    logger.info(f"Request [{request.state.request_id}] {request.method} {request.url.path}")

    try:
        response = await call_next(request)

        # Calculate processing time
        process_time = time.time() - start_time

        # Log response
        logger.info(
            f"Response [{request.state.request_id}] {request.method} {request.url.path} "
            f"- Status: {response.status_code} - Time: {process_time:.4f}s"
        )

        # Add headers if not already added by gateway
        if "X-Request-ID" not in response.headers:
            response.headers["X-Request-ID"] = request.state.request_id
        if "X-Process-Time" not in response.headers:
            response.headers["X-Process-Time"] = str(process_time)

        return response

    except Exception as e:
        process_time = time.time() - start_time
        logger.error(
            f"Error [{request.state.request_id}] {request.method} {request.url.path} "
            f"- Error: {str(e)} - Time: {process_time:.4f}s"
        )
        raise


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check database connection
        from app.core.database import get_db_session
        from sqlalchemy import text
        async with get_db_session() as db:
            await db.execute(text("SELECT 1"))
        
        # Check Redis connection
        await redis_client.ping()
        
        # Check vector database connection
        vector_db_healthy = await knowledge_manager.vector_db.health_check()
        
        return {
            "status": "healthy",
            "database": "connected",
            "redis": "connected",
            "vector_db": "connected" if vector_db_healthy else "disconnected",
            "timestamp": "2024-01-01T00:00:00Z"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred"
        }
    )


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
        log_level="info"
    )