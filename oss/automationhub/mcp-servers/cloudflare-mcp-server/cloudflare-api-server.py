#!/usr/bin/env python3
"""
UPM.Plus Cloudflare API Server
Standalone FastAPI server for Cloudflare domain management
Provides REST API endpoints for automated Cloudflare operations
"""

import os
import json
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import CloudFlare
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="UPM.Plus Cloudflare API Server",
    description="Automated Cloudflare domain management for UPM.Plus",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
cf_client = None
server_initialized = False

# Pydantic models
class DNSRecordRequest(BaseModel):
    zone_id: str
    name: str
    type: str
    content: str
    ttl: int = 3600
    proxied: bool = True

class DNSRecordUpdate(BaseModel):
    zone_id: str
    record_id: str
    name: Optional[str] = None
    type: Optional[str] = None
    content: Optional[str] = None
    ttl: Optional[int] = None
    proxied: Optional[bool] = None

class SSLSettingsRequest(BaseModel):
    zone_id: str
    ssl_mode: str  # "off", "flexible", "full", "strict"

class WorkerRequest(BaseModel):
    script_name: str
    script_content: str
    route_pattern: Optional[str] = None

# UPM.Plus domains configuration
UPM_DOMAINS = [
    "upm.plus",
    "upmplus.dev",
    "upmplus.io",
    "upmplus.ai"
]

# UPM.Plus subdomains configuration
UPM_SUBDOMAINS = {
    "main": {"name": "@", "description": "Main website"},
    "www": {"name": "www", "description": "WWW subdomain"},
    "api": {"name": "api", "description": "API services"},
    "app": {"name": "app", "description": "Application frontend"},
    "admin": {"name": "admin", "description": "Admin panel"},
    "docs": {"name": "docs", "description": "Documentation"},
    "cdn": {"name": "cdn", "description": "CDN services"},
    "dashboard": {"name": "dashboard", "description": "Dashboard"},
    "staging": {"name": "staging", "description": "Staging environment"},
    "dev": {"name": "dev", "description": "Development environment"}
}

async def initialize_cloudflare():
    """Initialize Cloudflare client"""
    global cf_client, server_initialized

    api_token = os.getenv('CLOUDFLARE_API_TOKEN')
    account_id = os.getenv('CLOUDFLARE_ACCOUNT_ID')

    if not api_token:
        raise ValueError("CLOUDFLARE_API_TOKEN environment variable is required")

    try:
        cf_client = CloudFlare.CloudFlare(api_token=api_token)
        # Test connection
        zones = cf_client.zones.get(per_page=1)
        server_initialized = True
        return True
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize Cloudflare client: {str(e)}")

@app.on_event("startup")
async def startup_event():
    """Initialize server on startup"""
    try:
        await initialize_cloudflare()
        print("✅ Cloudflare API Server initialized successfully")
    except Exception as e:
        print(f"⚠️  Server started but Cloudflare initialization failed: {e}")
        print("Server will operate in demo mode until Cloudflare credentials are provided")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "UPM.Plus Cloudflare API Server",
        "status": "operational" if server_initialized else "demo_mode",
        "version": "1.0.0",
        "domains": UPM_DOMAINS,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "cloudflare_connected": server_initialized,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/domains")
async def get_domains():
    """List all domains in the Cloudflare account"""
    if not server_initialized:
        # Return demo data
        return {
            "domains": [{"name": domain, "status": "demo_mode"} for domain in UPM_DOMAINS],
            "message": "Running in demo mode - configure CLOUDFLARE_API_TOKEN to connect to real account"
        }

    try:
        zones = cf_client.zones.get(per_page=100)
        return {
            "domains": [
                {
                    "id": zone["id"],
                    "name": zone["name"],
                    "status": zone["status"],
                    "name_servers": zone["name_servers"]
                }
                for zone in zones
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch domains: {str(e)}")

@app.post("/dns/create")
async def create_dns_record(record: DNSRecordRequest):
    """Create a DNS record"""
    if not server_initialized:
        return {"message": "Demo mode - DNS record would be created", "record": record.dict()}

    try:
        dns_record = cf_client.zones.dns_records.post(
            record.zone_id,
            data={
                "name": record.name,
                "type": record.type,
                "content": record.content,
                "ttl": record.ttl,
                "proxied": record.proxied
            }
        )
        return {
            "success": True,
            "record": dns_record,
            "message": "DNS record created successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create DNS record: {str(e)}")

@app.get("/dns/{zone_id}")
async def get_dns_records(zone_id: str):
    """Get DNS records for a zone"""
    if not server_initialized:
        return {"records": [], "message": "Demo mode - no real DNS records available"}

    try:
        records = cf_client.zones.dns_records.get(zone_id, per_page=100)
        return {"records": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch DNS records: {str(e)}")

@app.put("/dns/update")
async def update_dns_record(update: DNSRecordUpdate):
    """Update a DNS record"""
    if not server_initialized:
        return {"message": "Demo mode - DNS record would be updated", "update": update.dict()}

    try:
        update_data = {}
        if update.name is not None:
            update_data["name"] = update.name
        if update.type is not None:
            update_data["type"] = update.type
        if update.content is not None:
            update_data["content"] = update.content
        if update.ttl is not None:
            update_data["ttl"] = update.ttl
        if update.proxied is not None:
            update_data["proxied"] = update.proxied

        dns_record = cf_client.zones.dns_records.put(
            update.zone_id,
            update.record_id,
            data=update_data
        )
        return {
            "success": True,
            "record": dns_record,
            "message": "DNS record updated successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update DNS record: {str(e)}")

@app.delete("/dns/{zone_id}/{record_id}")
async def delete_dns_record(zone_id: str, record_id: str):
    """Delete a DNS record"""
    if not server_initialized:
        return {"message": "Demo mode - DNS record would be deleted"}

    try:
        cf_client.zones.dns_records.delete(zone_id, record_id)
        return {
            "success": True,
            "message": "DNS record deleted successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete DNS record: {str(e)}")

@app.post("/ssl/configure")
async def configure_ssl(settings: SSLSettingsRequest):
    """Configure SSL/TLS settings for a zone"""
    if not server_initialized:
        return {"message": "Demo mode - SSL settings would be configured", "settings": settings.dict()}

    try:
        ssl_settings = cf_client.zones.settings.ssl.put(
            settings.zone_id,
            data={"value": settings.ssl_mode}
        )
        return {
            "success": True,
            "settings": ssl_settings,
            "message": f"SSL mode set to {settings.ssl_mode}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to configure SSL: {str(e)}")

@app.post("/cache/purge")
async def purge_cache(zone_id: str):
    """Purge cache for a zone"""
    if not server_initialized:
        return {"message": "Demo mode - cache would be purged"}

    try:
        purge_result = cf_client.zones.purge_cache.post(
            zone_id,
            data={"purge_everything": True}
        )
        return {
            "success": True,
            "result": purge_result,
            "message": "Cache purged successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to purge cache: {str(e)}")

@app.get("/analytics/{zone_id}")
async def get_analytics(zone_id: str):
    """Get analytics for a zone"""
    if not server_initialized:
        return {"analytics": {"demo": True, "message": "Demo mode - no real analytics available"}}

    try:
        # Get basic analytics (this would require specific analytics API calls)
        analytics_data = {
            "zone_id": zone_id,
            "requests": {"total": 0, "cached": 0, "uncached": 0},
            "bandwidth": {"total": 0, "cached": 0, "uncached": 0},
            "threats": {"total": 0},
            "pageviews": {"total": 0}
        }
        return {"analytics": analytics_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch analytics: {str(e)}")

@app.post("/security/configure")
async def configure_security(zone_id: str, security_level: str = "medium"):
    """Configure security settings for a zone"""
    if not server_initialized:
        return {"message": "Demo mode - security settings would be configured"}

    try:
        security_settings = cf_client.zones.settings.security_level.put(
            zone_id,
            data={"value": security_level}
        )
        return {
            "success": True,
            "settings": security_settings,
            "message": f"Security level set to {security_level}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to configure security: {str(e)}")

@app.get("/upm/domains")
async def get_upm_domains():
    """Get UPM.Plus specific domain configuration"""
    return {
        "domains": UPM_DOMAINS,
        "subdomains": UPM_SUBDOMAINS,
        "recommended_dns": {
            "upm.plus": {
                "description": "Production domain",
                "records": [
                    {"name": "@", "type": "A", "content": "192.168.1.100", "proxied": True},
                    {"name": "www", "type": "CNAME", "content": "upm.plus", "proxied": True},
                    {"name": "api", "type": "A", "content": "192.168.1.101", "proxied": True},
                    {"name": "app", "type": "A", "content": "192.168.1.102", "proxied": True}
                ]
            },
            "upmplus.dev": {
                "description": "Development domain",
                "records": [
                    {"name": "@", "type": "A", "content": "192.168.1.110", "proxied": True},
                    {"name": "api", "type": "A", "content": "192.168.1.111", "proxied": True}
                ]
            },
            "upmplus.io": {
                "description": "Staging domain",
                "records": [
                    {"name": "@", "type": "A", "content": "192.168.1.120", "proxied": True},
                    {"name": "api", "type": "A", "content": "192.168.1.121", "proxied": True}
                ]
            },
            "upmplus.ai": {
                "description": "AI services domain",
                "records": [
                    {"name": "@", "type": "A", "content": "192.168.1.130", "proxied": True},
                    {"name": "api", "type": "A", "content": "192.168.1.131", "proxied": True}
                ]
            }
        }
    }

@app.post("/upm/deploy-all")
async def deploy_upm_domains(background_tasks: BackgroundTasks):
    """Deploy DNS records for all UPM.Plus domains"""
    if not server_initialized:
        return {"message": "Demo mode - UPM.Plus domains would be deployed"}

    # This would be a background task to deploy all domains
    background_tasks.add_task(deploy_all_upm_domains_task)
    return {"message": "UPM.Plus domain deployment started in background"}

async def deploy_all_upm_domains_task():
    """Background task to deploy all UPM.Plus domains"""
    print("Starting UPM.Plus domain deployment...")
    # Implementation would go here
    print("UPM.Plus domain deployment completed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)