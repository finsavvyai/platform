#!/usr/bin/env python3
"""
Ultimate Database Manager - Secure API Server
FastAPI-based API server for Electron frontend integration
"""

import os
import sys
import json
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging

# Add our modules to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from ultimate_db_manager.core.security import (
    DatabaseCredentials,
    SecureCredentialManager,
    AuthenticationManager,
    SQLInjectionPrevention,
    SecurityError,
    credential_manager
)
from ultimate_db_manager.core.database import (
    SecureDatabaseManager,
    QueryResult,
    db_manager
)
from ultimate_db_manager.ai.query_genius import (
    AIQueryGenius,
    get_ai_query_genius
)
from ultimate_db_manager.monitoring.realtime_dashboard import (
    RealTimeMonitor,
    get_real_time_monitor
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Security
security = HTTPBearer()
SECRET_KEY = os.environ.get("UDB_SECRET_KEY", "dev-secret-key")

# Pydantic models for API
class ConnectionRequest(BaseModel):
    connection_id: str
    host: str
    port: int
    username: str
    password: str
    database: Optional[str] = None
    ssl: bool = False

class QueryRequest(BaseModel):
    connection_id: str
    query: str
    params: Optional[List] = None

class SchemaRequest(BaseModel):
    connection_id: str
    table_name: Optional[str] = None
    schema_name: str = "public"

class CredentialRequest(BaseModel):
    connection_id: str
    credentials: Dict[str, Any]

class APIResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None

# Global managers
auth_manager = AuthenticationManager(SECRET_KEY)
ai_assistant = get_ai_query_genius()
monitor = get_real_time_monitor(db_manager)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("🚀 Ultimate Database Manager API Server starting...")
    yield
    logger.info("👋 Ultimate Database Manager API Server shutting down...")

# Create FastAPI app
app = FastAPI(
    title="Ultimate Database Manager API",
    description="Secure API for Ultimate Database Manager",
    version="2.0.0",
    lifespan=lifespan
)

# Add CORS middleware for Electron
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Electron app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Verify JWT token"""
    try:
        # For now, just check if token matches secret key (simplified for Electron)
        if credentials.credentials == SECRET_KEY:
            return "electron_user"
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Ultimate Database Manager API v2.0", "status": "running"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "features": [
            "secure_credentials",
            "sql_injection_prevention",
            "multi_database_support",
            "connection_pooling"
        ]
    }

@app.post("/api/connect")
async def connect_database(
    request: ConnectionRequest,
    user_id: str = Depends(verify_token)
) -> APIResponse:
    """Connect to database and store credentials securely"""
    try:
        # Create credentials object
        credentials = DatabaseCredentials(
            host=request.host,
            port=request.port,
            username=request.username,
            password=request.password,
            database=request.database,
            ssl=request.ssl
        )

        # Register connection (this will test the connection too)
        db_manager.register_connection(request.connection_id, credentials)

        logger.info(f"Database connection '{request.connection_id}' registered successfully")

        return APIResponse(
            success=True,
            data={
                "connection_id": request.connection_id,
                "status": "connected"
            }
        )

    except SecurityError as e:
        logger.error(f"Security error in connection: {e}")
        return APIResponse(success=False, error=f"Security error: {str(e)}")

    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        return APIResponse(success=False, error=f"Connection failed: {str(e)}")

@app.post("/api/query")
async def execute_query(
    request: QueryRequest,
    user_id: str = Depends(verify_token)
) -> APIResponse:
    """Execute SQL query securely"""
    try:
        # Execute query with security checks
        result = db_manager.execute_query(
            request.connection_id,
            request.query,
            params=tuple(request.params) if request.params else None,
            allowed_operations={'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER'}
        )

        return APIResponse(
            success=True,
            data={
                "columns": result.columns,
                "data": result.data,
                "row_count": result.row_count,
                "execution_time": result.execution_time,
                "query": result.query
            }
        )

    except SecurityError as e:
        logger.error(f"Security error in query execution: {e}")
        return APIResponse(success=False, error=f"Security error: {str(e)}")

    except Exception as e:
        logger.error(f"Query execution failed: {e}")
        return APIResponse(success=False, error=f"Query failed: {str(e)}")

@app.post("/api/schema")
async def get_schema_info(
    request: SchemaRequest,
    user_id: str = Depends(verify_token)
) -> APIResponse:
    """Get database schema information"""
    try:
        if request.table_name:
            # Get table structure
            structure = db_manager.get_table_structure(
                request.connection_id,
                request.table_name,
                request.schema_name
            )
            return APIResponse(
                success=True,
                data={
                    "type": "table_structure",
                    "table_name": request.table_name,
                    "structure": structure
                }
            )
        else:
            # Get list of tables
            tables = db_manager.get_tables(request.connection_id, request.schema_name)
            return APIResponse(
                success=True,
                data={
                    "type": "tables_list",
                    "schema": request.schema_name,
                    "tables": tables
                }
            )

    except SecurityError as e:
        logger.error(f"Security error in schema operation: {e}")
        return APIResponse(success=False, error=f"Security error: {str(e)}")

    except Exception as e:
        logger.error(f"Schema operation failed: {e}")
        return APIResponse(success=False, error=f"Schema operation failed: {str(e)}")

@app.get("/api/databases/{connection_id}")
async def get_databases(
    connection_id: str,
    user_id: str = Depends(verify_token)
) -> APIResponse:
    """Get list of databases"""
    try:
        databases = db_manager.get_databases(connection_id)
        return APIResponse(
            success=True,
            data={"databases": databases}
        )

    except Exception as e:
        logger.error(f"Failed to get databases: {e}")
        return APIResponse(success=False, error=f"Failed to get databases: {str(e)}")

@app.post("/api/credentials-store")
async def store_credentials(
    request: CredentialRequest,
    user_id: str = Depends(verify_token)
) -> APIResponse:
    """Store database credentials securely"""
    try:
        credentials = DatabaseCredentials.from_dict(request.credentials)
        credential_manager.store_credentials(request.connection_id, credentials)

        return APIResponse(
            success=True,
            data={"message": "Credentials stored securely"}
        )

    except Exception as e:
        logger.error(f"Failed to store credentials: {e}")
        return APIResponse(success=False, error=f"Failed to store credentials: {str(e)}")

@app.post("/api/credentials-list")
async def list_credentials(user_id: str = Depends(verify_token)) -> APIResponse:
    """List stored connection IDs"""
    try:
        connections = credential_manager.list_connections()
        return APIResponse(
            success=True,
            data={"connections": connections}
        )

    except Exception as e:
        logger.error(f"Failed to list credentials: {e}")
        return APIResponse(success=False, error=f"Failed to list credentials: {str(e)}")

@app.get("/api/connections")
async def get_connections(user_id: str = Depends(verify_token)) -> APIResponse:
    """Get all connections with their info (without passwords)"""
    try:
        connection_ids = credential_manager.list_connections()
        connections = []

        for conn_id in connection_ids:
            creds = credential_manager.get_credentials(conn_id)
            if creds:
                connections.append({
                    "id": conn_id,
                    "host": creds.host,
                    "port": creds.port,
                    "username": creds.username,
                    "database": creds.database,
                    "ssl": creds.ssl
                })

        return APIResponse(
            success=True,
            data={"connections": connections}
        )

    except Exception as e:
        logger.error(f"Failed to get connections: {e}")
        return APIResponse(success=False, error=f"Failed to get connections: {str(e)}")

@app.delete("/api/connections/{connection_id}")
async def delete_connection(
    connection_id: str,
    user_id: str = Depends(verify_token)
) -> APIResponse:
    """Delete a connection"""
    try:
        db_manager.remove_connection(connection_id)
        return APIResponse(
            success=True,
            data={"message": f"Connection '{connection_id}' deleted successfully"}
        )

    except Exception as e:
        logger.error(f"Failed to delete connection: {e}")
        return APIResponse(success=False, error=f"Failed to delete connection: {str(e)}")

# 🤖 AI-POWERED ENDPOINTS - OUR KILLER FEATURES!

@app.post("/api/ai/natural-query")
async def natural_language_query(
    request: dict,
    user_id: str = Depends(verify_token)
) -> APIResponse:
    """🚀 Convert natural language to SQL - KILLER FEATURE!"""
    try:
        question = request.get("question", "")
        connection_id = request.get("connection_id", "")

        if not question:
            return APIResponse(success=False, error="Question is required")

        if not connection_id:
            return APIResponse(success=False, error="Connection ID is required")

        # Get schema information
        tables = db_manager.get_tables(connection_id, 'public')
        schema_info = {}

        for table in tables[:5]:  # Limit to first 5 tables for performance
            table_name = table['tablename']
            try:
                structure = db_manager.get_table_structure(connection_id, table_name, 'public')
                schema_info[table_name] = structure
            except:
                continue

        # Generate SQL using AI
        suggestion = await ai_assistant.natural_language_to_sql(question, schema_info)

        return APIResponse(
            success=True,
            data={
                "sql": suggestion.sql,
                "confidence": suggestion.confidence,
                "explanation": suggestion.explanation,
                "performance_prediction": suggestion.performance_prediction,
                "alternatives": suggestion.alternative_approaches
            }
        )

    except Exception as e:
        logger.error(f"Natural language query failed: {e}")
        return APIResponse(success=False, error=f"AI query generation failed: {str(e)}")

@app.post("/api/ai/optimize-query")
async def optimize_query(
    request: dict,
    user_id: str = Depends(verify_token)
) -> APIResponse:
    """🔥 AI-powered query optimization - GAME CHANGER!"""
    try:
        query = request.get("query", "")
        connection_id = request.get("connection_id", "")

        if not query:
            return APIResponse(success=False, error="Query is required")

        # Get schema information
        tables = db_manager.get_tables(connection_id, 'public')
        schema_info = {}

        for table in tables:
            table_name = table['tablename']
            try:
                structure = db_manager.get_table_structure(connection_id, table_name, 'public')
                schema_info[table_name] = structure
            except:
                continue

        # Optimize query using AI
        optimization = await ai_assistant.optimize_query(query, schema_info)

        return APIResponse(
            success=True,
            data=optimization
        )

    except Exception as e:
        logger.error(f"Query optimization failed: {e}")
        return APIResponse(success=False, error=f"Query optimization failed: {str(e)}")

@app.post("/api/ai/explain-query")
async def explain_query(
    request: dict,
    user_id: str = Depends(verify_token)
) -> APIResponse:
    """🧠 AI query explanation - EDUCATIONAL GOLD!"""
    try:
        query = request.get("query", "")

        if not query:
            return APIResponse(success=False, error="Query is required")

        explanation = await ai_assistant.explain_query(query)

        return APIResponse(
            success=True,
            data={"explanation": explanation}
        )

    except Exception as e:
        logger.error(f"Query explanation failed: {e}")
        return APIResponse(success=False, error=f"Query explanation failed: {str(e)}")

@app.post("/api/ai/analyze-schema")
async def analyze_schema(
    request: dict,
    user_id: str = Depends(verify_token)
) -> APIResponse:
    """🏗️ AI schema analysis - ARCHITECTURE INSIGHTS!"""
    try:
        connection_id = request.get("connection_id", "")

        if not connection_id:
            return APIResponse(success=False, error="Connection ID is required")

        # Get complete schema information
        tables = db_manager.get_tables(connection_id, 'public')
        schema_info = {}

        for table in tables:
            table_name = table['tablename']
            try:
                structure = db_manager.get_table_structure(connection_id, table_name, 'public')
                schema_info[table_name] = structure
            except:
                continue

        analysis = await ai_assistant.analyze_schema(schema_info)

        return APIResponse(
            success=True,
            data=analysis
        )

    except Exception as e:
        logger.error(f"Schema analysis failed: {e}")
        return APIResponse(success=False, error=f"Schema analysis failed: {str(e)}")

@app.post("/api/ai/generate-test-data")
async def generate_test_data(
    request: dict,
    user_id: str = Depends(verify_token)
) -> APIResponse:
    """🎲 AI test data generation - DEVELOPMENT ACCELERATOR!"""
    try:
        connection_id = request.get("connection_id", "")
        table_name = request.get("table_name", "")
        num_rows = request.get("num_rows", 100)

        if not connection_id or not table_name:
            return APIResponse(success=False, error="Connection ID and table name are required")

        # Get table structure
        structure = db_manager.get_table_structure(connection_id, table_name, 'public')

        # Convert to schema format
        schema = {col['column_name']: col for col in structure}

        test_data_sql = await ai_assistant.generate_test_data(table_name, schema, num_rows)

        return APIResponse(
            success=True,
            data={"sql": test_data_sql}
        )

    except Exception as e:
        logger.error(f"Test data generation failed: {e}")
        return APIResponse(success=False, error=f"Test data generation failed: {str(e)}")

# 📊 REAL-TIME MONITORING ENDPOINTS - PERFORMANCE INTELLIGENCE!

@app.get("/api/monitoring/dashboard")
async def get_dashboard_data(user_id: str = Depends(verify_token)) -> APIResponse:
    """📊 Get real-time dashboard data"""
    try:
        dashboard_data = monitor.get_dashboard_data()
        return APIResponse(success=True, data=dashboard_data)

    except Exception as e:
        logger.error(f"Failed to get dashboard data: {e}")
        return APIResponse(success=False, error=f"Dashboard data failed: {str(e)}")

@app.get("/api/monitoring/metrics/{connection_id}")
async def get_metrics_summary(
    connection_id: str,
    hours: int = 1,
    user_id: str = Depends(verify_token)
) -> APIResponse:
    """📈 Get metrics summary for connection"""
    try:
        summary = await monitor.get_metrics_summary(connection_id, hours)
        return APIResponse(success=True, data=summary)

    except Exception as e:
        logger.error(f"Failed to get metrics: {e}")
        return APIResponse(success=False, error=f"Metrics retrieval failed: {str(e)}")

@app.get("/api/monitoring/insights/{connection_id}")
async def get_performance_insights(
    connection_id: str,
    user_id: str = Depends(verify_token)
) -> APIResponse:
    """🔍 Get AI-powered performance insights"""
    try:
        insights = await monitor.get_performance_insights(connection_id)

        # Convert insights to dict format
        insights_data = [
            {
                "type": insight.type,
                "severity": insight.severity,
                "title": insight.title,
                "description": insight.description,
                "recommendation": insight.recommendation,
                "impact": insight.impact,
                "timestamp": insight.timestamp.isoformat()
            }
            for insight in insights
        ]

        return APIResponse(success=True, data={"insights": insights_data})

    except Exception as e:
        logger.error(f"Failed to get insights: {e}")
        return APIResponse(success=False, error=f"Insights generation failed: {str(e)}")

@app.post("/api/monitoring/start")
async def start_monitoring(user_id: str = Depends(verify_token)) -> APIResponse:
    """▶️ Start real-time monitoring"""
    try:
        if not monitor.monitoring:
            # Start monitoring in background
            asyncio.create_task(monitor.start_monitoring())

        return APIResponse(
            success=True,
            data={"message": "Real-time monitoring started", "status": "active"}
        )

    except Exception as e:
        logger.error(f"Failed to start monitoring: {e}")
        return APIResponse(success=False, error=f"Monitoring start failed: {str(e)}")

@app.post("/api/monitoring/stop")
async def stop_monitoring(user_id: str = Depends(verify_token)) -> APIResponse:
    """⏹️ Stop real-time monitoring"""
    try:
        await monitor.stop_monitoring()

        return APIResponse(
            success=True,
            data={"message": "Real-time monitoring stopped", "status": "inactive"}
        )

    except Exception as e:
        logger.error(f"Failed to stop monitoring: {e}")
        return APIResponse(success=False, error=f"Monitoring stop failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("UDB_PORT", 8000))
    host = os.environ.get("UDB_HOST", "127.0.0.1")

    print(f"🚀 Starting Ultimate Database Manager API Server on {host}:{port}")
    print(f"🔐 Secret Key: {SECRET_KEY[:10]}...")
    print(f"📚 API Documentation: http://{host}:{port}/docs")

    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )