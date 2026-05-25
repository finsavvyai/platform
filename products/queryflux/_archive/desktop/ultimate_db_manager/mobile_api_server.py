#!/usr/bin/env python3
"""
Ultimate Database Manager - Mobile API Server
FastAPI-based REST API server specifically designed for mobile companion apps
"""

import os
import sys
import json
import asyncio
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
import uvicorn
from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import logging
import jwt
from passlib.context import CryptContext

# Add our modules to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from ultimate_db_manager.core.connection_manager import ConnectionManager
from ultimate_db_manager.core.docker_manager import DockerManager
from ultimate_db_manager.adapters.adapter_factory import AdapterFactory
from ultimate_db_manager.core.security import SecurityManager
from ultimate_db_manager.mobile_push_notifications import (
    push_service, 
    notify_connection_lost, 
    notify_connection_restored,
    notify_high_cpu_usage,
    notify_container_stopped,
    notify_slow_query
)
from ultimate_db_manager.mobile_offline_cache import (
    mobile_cache,
    cache_connection_status,
    get_cached_connection_status,
    cache_health_metrics,
    get_cached_health_metrics,
    cache_container_status,
    get_cached_container_status,
    CacheEntryType
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Security configuration
security = HTTPBearer()
SECRET_KEY = os.environ.get("MOBILE_API_SECRET_KEY", "mobile-api-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Pydantic models for mobile API
class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int

class UserLogin(BaseModel):
    username: str
    password: str

class ConnectionStatus(BaseModel):
    connection_id: str
    name: str
    db_type: str
    status: str
    last_ping: Optional[datetime] = None
    response_time: Optional[float] = None
    error_message: Optional[str] = None

class HealthMetrics(BaseModel):
    connection_id: str
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    active_connections: Optional[int] = None
    queries_per_second: Optional[float] = None
    slow_queries: Optional[int] = None
    uptime: Optional[str] = None

class MobileQueryRequest(BaseModel):
    connection_id: str
    query: str
    limit: Optional[int] = Field(default=100, le=1000)  # Mobile-optimized limit
    timeout: Optional[int] = Field(default=30, le=60)   # Mobile-optimized timeout

class MobileQueryResult(BaseModel):
    success: bool
    data: List[Dict[str, Any]] = []
    columns: List[str] = []
    row_count: int = 0
    execution_time: float = 0.0
    truncated: bool = False
    error: Optional[str] = None

class ContainerInfo(BaseModel):
    container_id: str
    name: str
    db_type: str
    status: str
    port: Optional[int] = None
    created_at: Optional[datetime] = None
    uptime: Optional[str] = None

class AlertNotification(BaseModel):
    id: str
    connection_id: str
    type: str  # 'error', 'warning', 'info'
    title: str
    message: str
    timestamp: datetime
    acknowledged: bool = False

class DeviceRegistration(BaseModel):
    token: str
    platform: str  # 'ios' or 'android'
    user_id: str

class MobileAPIResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    cached: bool = False  # Indicates if data came from cache

# Global managers
connection_manager = ConnectionManager()
docker_manager = DockerManager()
security_manager = SecurityManager()

# In-memory storage for demo (in production, use Redis or database)
active_alerts: List[AlertNotification] = []
cached_metrics: Dict[str, Any] = {}

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password, hashed_password):
    """Verify password"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """Hash password"""
    return pwd_context.hash(password)

# Simple user store (in production, use proper database)
fake_users_db = {
    "admin": {
        "username": "admin",
        "hashed_password": get_password_hash("admin123"),  # Change in production
        "disabled": False,
    }
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("🚀 Mobile API Server starting...")
    # Start background tasks
    asyncio.create_task(monitor_connections())
    yield
    logger.info("👋 Mobile API Server shutting down...")

# Create FastAPI app
app = FastAPI(
    title="Ultimate Database Manager Mobile API",
    description="Mobile-optimized REST API for database management companion apps",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware for mobile apps
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = fake_users_db.get(username)
    if user is None:
        raise credentials_exception
    return user

async def monitor_connections():
    """Background task to monitor connection health"""
    while True:
        try:
            # Update connection statuses
            for connection_id in connection_manager.list_connections():
                try:
                    adapter = connection_manager.get_connection(connection_id)
                    if adapter:
                        # Ping connection
                        start_time = datetime.utcnow()
                        result = adapter.execute_query("SELECT 1")
                        response_time = (datetime.utcnow() - start_time).total_seconds()
                        
                        # Update cached status
                        cached_metrics[f"{connection_id}_status"] = {
                            "status": "connected",
                            "last_ping": datetime.utcnow(),
                            "response_time": response_time
                        }
                except Exception as e:
                    # Connection failed
                    cached_metrics[f"{connection_id}_status"] = {
                        "status": "disconnected",
                        "last_ping": datetime.utcnow(),
                        "error_message": str(e)
                    }
                    
                    # Create alert
                    alert = AlertNotification(
                        id=f"conn_error_{connection_id}_{int(datetime.utcnow().timestamp())}",
                        connection_id=connection_id,
                        type="error",
                        title="Connection Lost",
                        message=f"Connection {connection_id} is no longer responding: {str(e)}",
                        timestamp=datetime.utcnow()
                    )
                    active_alerts.append(alert)
                    
                    # Send push notification
                    try:
                        profile = connection_manager.get_connection_profile(connection_id)
                        connection_name = profile.name if profile else connection_id
                        await notify_connection_lost(connection_id, connection_name, str(e))
                    except Exception as notify_error:
                        logger.error(f"Failed to send push notification: {notify_error}")
            
            # Cache connection statuses for offline access
            for connection_id in connection_manager.list_connections():
                status_info = cached_metrics.get(f"{connection_id}_status", {})
                if status_info:
                    cache_connection_status(connection_id, status_info)
            
            await asyncio.sleep(30)  # Check every 30 seconds
        except Exception as e:
            logger.error(f"Error in connection monitoring: {e}")
            await asyncio.sleep(60)  # Wait longer on error

# Authentication endpoints
@app.post("/auth/login", response_model=Token)
async def login(user_credentials: UserLogin):
    """Authenticate user and return access token"""
    user = fake_users_db.get(user_credentials.username)
    if not user or not verify_password(user_credentials.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@app.get("/auth/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return MobileAPIResponse(
        success=True,
        data={"username": current_user["username"]}
    )

# Connection management endpoints
@app.get("/connections", response_model=MobileAPIResponse)
async def list_connections(current_user: dict = Depends(get_current_user)):
    """List all database connections with their status"""
    try:
        connections = []
        for connection_id in connection_manager.list_connections():
            profile = connection_manager.get_connection_profile(connection_id)
            status_info = cached_metrics.get(f"{connection_id}_status", {})
            
            connection_status = ConnectionStatus(
                connection_id=connection_id,
                name=profile.name if profile else connection_id,
                db_type=profile.db_type.value if profile else "unknown",
                status=status_info.get("status", "unknown"),
                last_ping=status_info.get("last_ping"),
                response_time=status_info.get("response_time"),
                error_message=status_info.get("error_message")
            )
            connections.append(connection_status.dict())
        
        return MobileAPIResponse(success=True, data={"connections": connections})
    
    except Exception as e:
        logger.error(f"Error listing connections: {e}")
        return MobileAPIResponse(success=False, error=str(e))

@app.get("/connections/{connection_id}/health", response_model=MobileAPIResponse)
async def get_connection_health(
    connection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed health metrics for a specific connection"""
    try:
        adapter = connection_manager.get_connection(connection_id)
        if not adapter:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Get basic metrics
        status_info = cached_metrics.get(f"{connection_id}_status", {})
        
        # Try to get database-specific metrics
        metrics = HealthMetrics(
            connection_id=connection_id,
            active_connections=1 if status_info.get("status") == "connected" else 0
        )
        
        # For PostgreSQL, get additional metrics
        if hasattr(adapter, 'get_health_metrics'):
            try:
                db_metrics = adapter.get_health_metrics()
                metrics.cpu_usage = db_metrics.get('cpu_usage')
                metrics.memory_usage = db_metrics.get('memory_usage')
                metrics.queries_per_second = db_metrics.get('queries_per_second')
                metrics.slow_queries = db_metrics.get('slow_queries')
                metrics.uptime = db_metrics.get('uptime')
            except Exception as e:
                logger.warning(f"Could not get detailed metrics for {connection_id}: {e}")
        
        return MobileAPIResponse(success=True, data=metrics.dict())
    
    except Exception as e:
        logger.error(f"Error getting connection health: {e}")
        return MobileAPIResponse(success=False, error=str(e))

@app.post("/connections/{connection_id}/query", response_model=MobileAPIResponse)
async def execute_mobile_query(
    connection_id: str,
    query_request: MobileQueryRequest,
    current_user: dict = Depends(get_current_user)
):
    """Execute query with mobile-optimized constraints"""
    try:
        adapter = connection_manager.get_connection(connection_id)
        if not adapter:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Security check - only allow SELECT queries for mobile
        query_upper = query_request.query.strip().upper()
        if not query_upper.startswith('SELECT'):
            raise HTTPException(
                status_code=403, 
                detail="Only SELECT queries are allowed from mobile devices"
            )
        
        # Execute query with timeout
        start_time = datetime.utcnow()
        result = adapter.execute_query(query_request.query)
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Apply mobile-specific limits
        data = result.data[:query_request.limit] if result.data else []
        truncated = len(result.data) > query_request.limit if result.data else False
        
        mobile_result = MobileQueryResult(
            success=True,
            data=data,
            columns=result.columns,
            row_count=len(data),
            execution_time=execution_time,
            truncated=truncated
        )
        
        return MobileAPIResponse(success=True, data=mobile_result.dict())
    
    except Exception as e:
        logger.error(f"Error executing mobile query: {e}")
        mobile_result = MobileQueryResult(success=False, error=str(e))
        return MobileAPIResponse(success=False, data=mobile_result.dict())

# Container management endpoints
@app.get("/containers", response_model=MobileAPIResponse)
async def list_containers(current_user: dict = Depends(get_current_user)):
    """List all database containers"""
    try:
        containers = []
        container_infos = docker_manager.list_database_containers()
        
        for container_info in container_infos:
            container = ContainerInfo(
                container_id=container_info.container_id,
                name=container_info.name,
                db_type=container_info.db_type.value,
                status=container_info.status,
                port=container_info.port,
                created_at=container_info.created_at,
                uptime=container_info.uptime
            )
            containers.append(container.dict())
        
        return MobileAPIResponse(success=True, data={"containers": containers})
    
    except Exception as e:
        logger.error(f"Error listing containers: {e}")
        return MobileAPIResponse(success=False, error=str(e))

@app.post("/containers/{container_id}/start", response_model=MobileAPIResponse)
async def start_container(
    container_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Start a database container"""
    try:
        result = docker_manager.start_container(container_id)
        return MobileAPIResponse(
            success=True, 
            data={"message": f"Container {container_id} started successfully"}
        )
    
    except Exception as e:
        logger.error(f"Error starting container: {e}")
        return MobileAPIResponse(success=False, error=str(e))

@app.post("/containers/{container_id}/stop", response_model=MobileAPIResponse)
async def stop_container(
    container_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Stop a database container"""
    try:
        result = docker_manager.stop_container(container_id)
        return MobileAPIResponse(
            success=True, 
            data={"message": f"Container {container_id} stopped successfully"}
        )
    
    except Exception as e:
        logger.error(f"Error stopping container: {e}")
        return MobileAPIResponse(success=False, error=str(e))

@app.get("/containers/{container_id}/status", response_model=MobileAPIResponse)
async def get_container_status(
    container_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed container status"""
    try:
        status = docker_manager.get_container_status(container_id)
        return MobileAPIResponse(success=True, data=status)
    
    except Exception as e:
        logger.error(f"Error getting container status: {e}")
        return MobileAPIResponse(success=False, error=str(e))

# Alert and notification endpoints
@app.get("/alerts", response_model=MobileAPIResponse)
async def get_alerts(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get recent alerts for mobile notifications"""
    try:
        # Sort alerts by timestamp (newest first)
        sorted_alerts = sorted(active_alerts, key=lambda x: x.timestamp, reverse=True)
        limited_alerts = sorted_alerts[:limit]
        
        alerts_data = [alert.dict() for alert in limited_alerts]
        return MobileAPIResponse(success=True, data={"alerts": alerts_data})
    
    except Exception as e:
        logger.error(f"Error getting alerts: {e}")
        return MobileAPIResponse(success=False, error=str(e))

@app.post("/alerts/{alert_id}/acknowledge", response_model=MobileAPIResponse)
async def acknowledge_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Acknowledge an alert"""
    try:
        for alert in active_alerts:
            if alert.id == alert_id:
                alert.acknowledged = True
                return MobileAPIResponse(
                    success=True, 
                    data={"message": "Alert acknowledged"}
                )
        
        raise HTTPException(status_code=404, detail="Alert not found")
    
    except Exception as e:
        logger.error(f"Error acknowledging alert: {e}")
        return MobileAPIResponse(success=False, error=str(e))

# Health and status endpoints
@app.get("/health")
async def health_check():
    """API health check"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "features": [
            "mobile_optimized_queries",
            "container_management",
            "real_time_monitoring",
            "push_notifications_ready"
        ]
    }

@app.get("/status", response_model=MobileAPIResponse)
async def get_system_status(current_user: dict = Depends(get_current_user)):
    """Get overall system status"""
    try:
        total_connections = len(connection_manager.list_connections())
        active_connections = sum(
            1 for conn_id in connection_manager.list_connections()
            if cached_metrics.get(f"{conn_id}_status", {}).get("status") == "connected"
        )
        
        total_containers = len(docker_manager.list_database_containers())
        running_containers = len([
            c for c in docker_manager.list_database_containers()
            if c.status == "running"
        ])
        
        unacknowledged_alerts = len([a for a in active_alerts if not a.acknowledged])
        
        status_data = {
            "connections": {
                "total": total_connections,
                "active": active_connections
            },
            "containers": {
                "total": total_containers,
                "running": running_containers
            },
            "alerts": {
                "unacknowledged": unacknowledged_alerts
            },
            "uptime": "System running",  # Could implement actual uptime tracking
            "last_updated": datetime.utcnow().isoformat()
        }
        
        return MobileAPIResponse(success=True, data=status_data)
    
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        return MobileAPIResponse(success=False, error=str(e))

# Push notification endpoints
@app.post("/notifications/register", response_model=MobileAPIResponse)
async def register_device_for_notifications(
    device_registration: DeviceRegistration,
    current_user: dict = Depends(get_current_user)
):
    """Register mobile device for push notifications"""
    try:
        success = push_service.register_device(
            device_registration.token,
            device_registration.platform,
            device_registration.user_id
        )
        
        if success:
            return MobileAPIResponse(
                success=True,
                data={"message": "Device registered for push notifications"}
            )
        else:
            return MobileAPIResponse(
                success=False,
                error="Failed to register device"
            )
    
    except Exception as e:
        logger.error(f"Error registering device: {e}")
        return MobileAPIResponse(success=False, error=str(e))

@app.delete("/notifications/unregister/{token}", response_model=MobileAPIResponse)
async def unregister_device_from_notifications(
    token: str,
    current_user: dict = Depends(get_current_user)
):
    """Unregister mobile device from push notifications"""
    try:
        success = push_service.unregister_device(token)
        
        if success:
            return MobileAPIResponse(
                success=True,
                data={"message": "Device unregistered from push notifications"}
            )
        else:
            return MobileAPIResponse(
                success=False,
                error="Device not found or already unregistered"
            )
    
    except Exception as e:
        logger.error(f"Error unregistering device: {e}")
        return MobileAPIResponse(success=False, error=str(e))

@app.get("/notifications/history", response_model=MobileAPIResponse)
async def get_notification_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get push notification history"""
    try:
        history = push_service.get_notification_history(limit)
        return MobileAPIResponse(success=True, data={"notifications": history})
    
    except Exception as e:
        logger.error(f"Error getting notification history: {e}")
        return MobileAPIResponse(success=False, error=str(e))

@app.get("/notifications/pending", response_model=MobileAPIResponse)
async def get_pending_notifications(current_user: dict = Depends(get_current_user)):
    """Get pending notifications"""
    try:
        pending = push_service.get_pending_notifications()
        return MobileAPIResponse(success=True, data={"notifications": pending})
    
    except Exception as e:
        logger.error(f"Error getting pending notifications: {e}")
        return MobileAPIResponse(success=False, error=str(e))

@app.get("/notifications/devices", response_model=MobileAPIResponse)
async def get_registered_devices(current_user: dict = Depends(get_current_user)):
    """Get count of registered devices"""
    try:
        device_count = push_service.get_device_count()
        return MobileAPIResponse(success=True, data=device_count)
    
    except Exception as e:
        logger.error(f"Error getting device count: {e}")
        return MobileAPIResponse(success=False, error=str(e))

# Offline cache endpoints
@app.get("/cache/stats", response_model=MobileAPIResponse)
async def get_cache_stats(current_user: dict = Depends(get_current_user)):
    """Get offline cache statistics"""
    try:
        stats = mobile_cache.get_cache_stats()
        return MobileAPIResponse(success=True, data=stats)
    
    except Exception as e:
        logger.error(f"Error getting cache stats: {e}")
        return MobileAPIResponse(success=False, error=str(e))

@app.post("/cache/cleanup", response_model=MobileAPIResponse)
async def cleanup_cache(current_user: dict = Depends(get_current_user)):
    """Clean up expired cache entries"""
    try:
        deleted_count = mobile_cache.cleanup_expired()
        return MobileAPIResponse(
            success=True,
            data={"message": f"Cleaned up {deleted_count} expired entries"}
        )
    
    except Exception as e:
        logger.error(f"Error cleaning up cache: {e}")
        return MobileAPIResponse(success=False, error=str(e))

@app.get("/cache/entries", response_model=MobileAPIResponse)
async def list_cache_entries(
    entry_type: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """List cache entries"""
    try:
        cache_entry_type = None
        if entry_type:
            try:
                cache_entry_type = CacheEntryType(entry_type)
            except ValueError:
                return MobileAPIResponse(
                    success=False,
                    error=f"Invalid entry type: {entry_type}"
                )
        
        entries = mobile_cache.list_entries(
            entry_type=cache_entry_type,
            limit=limit
        )
        
        return MobileAPIResponse(success=True, data={"entries": entries})
    
    except Exception as e:
        logger.error(f"Error listing cache entries: {e}")
        return MobileAPIResponse(success=False, error=str(e))

@app.delete("/cache/clear", response_model=MobileAPIResponse)
async def clear_cache(current_user: dict = Depends(get_current_user)):
    """Clear all cache entries"""
    try:
        success = mobile_cache.clear_all()
        
        if success:
            return MobileAPIResponse(
                success=True,
                data={"message": "Cache cleared successfully"}
            )
        else:
            return MobileAPIResponse(
                success=False,
                error="Failed to clear cache"
            )
    
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        return MobileAPIResponse(success=False, error=str(e))

# Enhanced connection endpoints with caching
@app.get("/connections/cached", response_model=MobileAPIResponse)
async def list_connections_with_cache(current_user: dict = Depends(get_current_user)):
    """List connections with offline cache support"""
    try:
        # Try to get fresh data first
        try:
            connections = []
            for connection_id in connection_manager.list_connections():
                profile = connection_manager.get_connection_profile(connection_id)
                status_info = cached_metrics.get(f"{connection_id}_status", {})
                
                connection_status = ConnectionStatus(
                    connection_id=connection_id,
                    name=profile.name if profile else connection_id,
                    db_type=profile.db_type.value if profile else "unknown",
                    status=status_info.get("status", "unknown"),
                    last_ping=status_info.get("last_ping"),
                    response_time=status_info.get("response_time"),
                    error_message=status_info.get("error_message")
                )
                connections.append(connection_status.dict())
                
                # Cache the status for offline access
                cache_connection_status(connection_id, connection_status.dict())
            
            return MobileAPIResponse(success=True, data={"connections": connections})
            
        except Exception as e:
            # Fall back to cached data if fresh data fails
            logger.warning(f"Failed to get fresh connection data, trying cache: {e}")
            
            cached_connections = []
            cache_entries = mobile_cache.list_entries(CacheEntryType.CONNECTION_STATUS)
            
            for entry in cache_entries:
                try:
                    cached_data = mobile_cache.get(CacheEntryType.CONNECTION_STATUS, entry['key'])
                    if cached_data:
                        cached_connections.append(cached_data)
                except Exception as cache_error:
                    logger.error(f"Error reading cached connection data: {cache_error}")
            
            return MobileAPIResponse(
                success=True,
                data={"connections": cached_connections},
                cached=True
            )
    
    except Exception as e:
        logger.error(f"Error getting connections with cache: {e}")
        return MobileAPIResponse(success=False, error=str(e))

@app.get("/connections/{connection_id}/health/cached", response_model=MobileAPIResponse)
async def get_connection_health_with_cache(
    connection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get connection health with offline cache support"""
    try:
        # Try to get fresh data first
        try:
            adapter = connection_manager.get_connection(connection_id)
            if not adapter:
                # Try cached data
                cached_health = get_cached_health_metrics(connection_id)
                if cached_health:
                    return MobileAPIResponse(
                        success=True,
                        data=cached_health,
                        cached=True
                    )
                raise HTTPException(status_code=404, detail="Connection not found")
            
            # Get fresh health metrics
            status_info = cached_metrics.get(f"{connection_id}_status", {})
            metrics = HealthMetrics(
                connection_id=connection_id,
                active_connections=1 if status_info.get("status") == "connected" else 0
            )
            
            # Try to get database-specific metrics
            if hasattr(adapter, 'get_health_metrics'):
                try:
                    db_metrics = adapter.get_health_metrics()
                    metrics.cpu_usage = db_metrics.get('cpu_usage')
                    metrics.memory_usage = db_metrics.get('memory_usage')
                    metrics.queries_per_second = db_metrics.get('queries_per_second')
                    metrics.slow_queries = db_metrics.get('slow_queries')
                    metrics.uptime = db_metrics.get('uptime')
                except Exception as e:
                    logger.warning(f"Could not get detailed metrics for {connection_id}: {e}")
            
            metrics_dict = metrics.dict()
            
            # Cache the health metrics
            cache_health_metrics(connection_id, metrics_dict)
            
            return MobileAPIResponse(success=True, data=metrics_dict)
            
        except Exception as e:
            # Fall back to cached data
            logger.warning(f"Failed to get fresh health data, trying cache: {e}")
            cached_health = get_cached_health_metrics(connection_id)
            
            if cached_health:
                return MobileAPIResponse(
                    success=True,
                    data=cached_health,
                    cached=True
                )
            else:
                raise e
    
    except Exception as e:
        logger.error(f"Error getting connection health with cache: {e}")
        return MobileAPIResponse(success=False, error=str(e))

if __name__ == "__main__":
    port = int(os.environ.get("MOBILE_API_PORT", 8001))
    host = os.environ.get("MOBILE_API_HOST", "0.0.0.0")  # Allow external connections for mobile
    
    print(f"🚀 Starting Mobile API Server on {host}:{port}")
    print(f"🔐 Secret Key: {SECRET_KEY[:10]}...")
    print(f"📱 Mobile API Documentation: http://{host}:{port}/docs")
    print(f"🔑 Default login: admin/admin123 (CHANGE IN PRODUCTION)")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )