#!/usr/bin/env python3
"""
Simple test backend for UPM.Plus dashboard
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="UPM.Plus Test Backend", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3030", "http://127.0.0.1:3030"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health")
async def health():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "uptime": 3600,
        "database": True,
        "redis": True,
        "chroma": False
    }

# In-memory storage for projects
projects_db = [
    {
        "id": "project-1",
        "name": "E-commerce Platform",
        "description": "Modern e-commerce solution with microservices",
        "status": "active",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-20T14:45:00Z"
    },
    {
        "id": "project-2",
        "name": "AI Assistant API",
        "description": "REST API for AI-powered assistant",
        "status": "active",
        "created_at": "2024-01-18T09:15:00Z",
        "updated_at": "2024-01-19T16:20:00Z"
    },
    {
        "id": "project-3",
        "name": "Data Analytics Dashboard",
        "description": "Real-time analytics and reporting",
        "status": "development",
        "created_at": "2024-01-20T11:00:00Z",
        "updated_at": "2024-01-21T13:30:00Z"
    }
]

@app.get("/api/v1/projects")
async def get_projects():
    return {
        "data": projects_db,
        "status": "success"
    }

@app.post("/api/v1/projects")
async def create_project(project_data: dict):
    from datetime import datetime
    import uuid

    # Generate new project
    new_project = {
        "id": f"project-{uuid.uuid4().hex[:8]}",
        "name": project_data.get("name", "Untitled Project"),
        "description": project_data.get("description", ""),
        "status": project_data.get("status", "development"),
        "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "updated_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    }

    # Add to our in-memory database
    projects_db.append(new_project)

    return {
        "data": new_project,
        "status": "success",
        "message": "Project created successfully"
    }

@app.get("/api/v1/deployments")
async def get_deployments():
    from datetime import datetime, timedelta

    # Generate recent deployments with current dates
    today = datetime.now()
    yesterday = today - timedelta(days=1)

    return {
        "data": [
            {
                "id": "deploy-1",
                "project_id": "project-1",
                "environment": "production",
                "status": "success",
                "url": "https://ecommerce.example.com",
                "created_at": today.strftime("%Y-%m-%dT%H:%M:%SZ")
            },
            {
                "id": "deploy-2",
                "project_id": "project-2",
                "environment": "staging",
                "status": "success",
                "url": "https://api-staging.example.com",
                "created_at": today.strftime("%Y-%m-%dT%H:%M:%SZ")
            },
            {
                "id": "deploy-3",
                "project_id": "project-1",
                "environment": "staging",
                "status": "success",
                "url": "https://staging.ecommerce.example.com",
                "created_at": yesterday.strftime("%Y-%m-%dT%H:%M:%SZ")
            },
            {
                "id": "deploy-4",
                "project_id": "project-3",
                "environment": "development",
                "status": "success",
                "url": "https://dev.analytics.example.com",
                "created_at": today.strftime("%Y-%m-%dT%H:%M:%SZ")
            }
        ],
        "status": "success"
    }

@app.get("/api/v1/agents")
async def get_agents():
    return {
        "data": [
            {
                "id": "agent-1",
                "name": "Browser Agent",
                "type": "browser",
                "status": "active",
                "capabilities": ["web_scraping", "automation", "testing"]
            },
            {
                "id": "agent-2",
                "name": "Infrastructure Agent",
                "type": "infrastructure",
                "status": "active",
                "capabilities": ["deployment", "monitoring", "scaling"]
            }
        ],
        "status": "success"
    }

@app.get("/api/v1/tasks")
async def get_tasks():
    return {
        "data": [
            {
                "id": "task-1",
                "name": "Deploy to Production",
                "status": "completed",
                "progress": 100,
                "created_at": "2024-01-21T08:00:00Z"
            },
            {
                "id": "task-2",
                "name": "Run Integration Tests",
                "status": "running",
                "progress": 75,
                "created_at": "2024-01-21T09:30:00Z"
            }
        ],
        "status": "success"
    }

if __name__ == "__main__":
    print("🚀 Starting UPM.Plus Test Backend on http://localhost:8015")
    uvicorn.run(app, host="127.0.0.1", port=8015, log_level="info")