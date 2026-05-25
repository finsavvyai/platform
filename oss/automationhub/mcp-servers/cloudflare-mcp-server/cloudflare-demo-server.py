#!/usr/bin/env python3
"""
UPM.Plus Cloudflare Demo API Server
Standalone FastAPI server for Cloudflare domain management (Demo Mode)
Provides REST API endpoints for automated Cloudflare operations without actual Cloudflare connection
"""

import os
import json
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="UPM.Plus Cloudflare Demo API Server",
    description="Automated Cloudflare domain management for UPM.Plus (Demo Mode)",
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

# Demo data
demo_zones = {
    "upm.plus": {"id": "zone123", "name": "upm.plus", "status": "active"},
    "upmplus.dev": {"id": "zone456", "name": "upmplus.dev", "status": "active"},
    "upmplus.io": {"id": "zone789", "name": "upmplus.io", "status": "active"},
    "upmplus.ai": {"id": "zone101", "name": "upmplus.ai", "status": "active"}
}

demo_dns_records = {}

@app.on_event("startup")
async def startup_event():
    """Initialize server on startup"""
    print("✅ Cloudflare Demo API Server started successfully")
    print("📋 Available endpoints:")
    print("   GET  /                 - Server info")
    print("   GET  /health           - Health check")
    print("   GET  /domains          - List domains")
    print("   POST /dns/create       - Create DNS record")
    print("   GET  /dns/{zone_id}    - Get DNS records")
    print("   PUT  /dns/update       - Update DNS record")
    print("   DELETE /dns/{zone_id}/{record_id} - Delete DNS record")
    print("   POST /ssl/configure    - Configure SSL")
    print("   POST /cache/purge      - Purge cache")
    print("   GET  /analytics/{zone_id} - Get analytics")
    print("   POST /security/configure - Configure security")
    print("   GET  /upm/domains      - UPM.Plus domain config")
    print("   POST /upm/deploy-all   - Deploy all UPM domains")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "UPM.Plus Cloudflare Demo API Server",
        "status": "demo_mode",
        "version": "1.0.0",
        "domains": UPM_DOMAINS,
        "timestamp": datetime.now().isoformat(),
        "message": "Demo mode - no actual Cloudflare connection. Configure CLOUDFLARE_API_TOKEN to enable real operations."
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "cloudflare_connected": False,
        "mode": "demo",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/domains")
async def get_domains():
    """List all domains in the Cloudflare account"""
    return {
        "domains": [
            {
                "id": zone["id"],
                "name": zone["name"],
                "status": zone["status"],
                "name_servers": [f"ns1.cloudflare.com", f"ns2.cloudflare.com"]
            }
            for zone in demo_zones.values()
        ],
        "message": "Demo mode - showing UPM.Plus domains"
    }

@app.post("/dns/create")
async def create_dns_record(record: DNSRecordRequest):
    """Create a DNS record"""
    record_id = f"rec_{datetime.now().timestamp()}"

    # Initialize zone records if not exists
    if record.zone_id not in demo_dns_records:
        demo_dns_records[record.zone_id] = []

    new_record = {
        "id": record_id,
        "name": record.name,
        "type": record.type,
        "content": record.content,
        "ttl": record.ttl,
        "proxied": record.proxied,
        "created_on": datetime.now().isoformat()
    }

    demo_dns_records[record.zone_id].append(new_record)

    return {
        "success": True,
        "record": new_record,
        "message": f"Demo: DNS record '{record.name}' would be created for zone {record.zone_id}"
    }

@app.get("/dns/{zone_id}")
async def get_dns_records(zone_id: str):
    """Get DNS records for a zone"""
    records = demo_dns_records.get(zone_id, [])

    # Add some default demo records
    if not records:
        records = [
            {
                "id": f"rec_{zone_id}_1",
                "name": "@",
                "type": "A",
                "content": "192.168.1.100",
                "ttl": 3600,
                "proxied": True
            },
            {
                "id": f"rec_{zone_id}_2",
                "name": "www",
                "type": "CNAME",
                "content": "upm.plus",
                "ttl": 3600,
                "proxied": True
            }
        ]

    return {"records": records, "zone_id": zone_id}

@app.put("/dns/update")
async def update_dns_record(update: DNSRecordUpdate):
    """Update a DNS record"""
    # Find the record in demo data
    zone_records = demo_dns_records.get(update.zone_id, [])

    for i, record in enumerate(zone_records):
        if record["id"] == update.record_id:
            # Update record fields
            if update.name is not None:
                record["name"] = update.name
            if update.type is not None:
                record["type"] = update.type
            if update.content is not None:
                record["content"] = update.content
            if update.ttl is not None:
                record["ttl"] = update.ttl
            if update.proxied is not None:
                record["proxied"] = update.proxied

            record["modified_on"] = datetime.now().isoformat()

            return {
                "success": True,
                "record": record,
                "message": f"Demo: DNS record '{update.record_id}' would be updated"
            }

    raise HTTPException(status_code=404, detail="DNS record not found")

@app.delete("/dns/{zone_id}/{record_id}")
async def delete_dns_record(zone_id: str, record_id: str):
    """Delete a DNS record"""
    zone_records = demo_dns_records.get(zone_id, [])

    for i, record in enumerate(zone_records):
        if record["id"] == record_id:
            del zone_records[i]
            return {
                "success": True,
                "message": f"Demo: DNS record '{record_id}' would be deleted from zone {zone_id}"
            }

    raise HTTPException(status_code=404, detail="DNS record not found")

@app.post("/ssl/configure")
async def configure_ssl(settings: SSLSettingsRequest):
    """Configure SSL/TLS settings for a zone"""
    valid_modes = ["off", "flexible", "full", "strict"]

    if settings.ssl_mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Invalid SSL mode. Must be one of: {valid_modes}")

    return {
        "success": True,
        "zone_id": settings.zone_id,
        "ssl_mode": settings.ssl_mode,
        "message": f"Demo: SSL mode would be set to '{settings.ssl_mode}' for zone {settings.zone_id}"
    }

@app.post("/cache/purge")
async def purge_cache(zone_id: str):
    """Purge cache for a zone"""
    return {
        "success": True,
        "zone_id": zone_id,
        "message": f"Demo: Cache would be purged for zone {zone_id}",
        "estimated_time": "30 seconds"
    }

@app.get("/analytics/{zone_id}")
async def get_analytics(zone_id: str):
    """Get analytics for a zone"""
    return {
        "analytics": {
            "zone_id": zone_id,
            "requests": {
                "total": 15420,
                "cached": 12336,
                "uncached": 3084,
                "cached_percent": 80.0
            },
            "bandwidth": {
                "total": 2147483648,  # 2GB in bytes
                "cached": 1717986918,  # 1.6GB in bytes
                "uncached": 429496730,
                "cached_percent": 80.0
            },
            "threats": {
                "total": 42,
                "threat_types": {
                    "sql_injection": 15,
                    "xss": 12,
                    "lfi": 8,
                    "other": 7
                }
            },
            "pageviews": {
                "total": 8750,
                "unique_visitors": 2340
            },
            "date_range": {
                "since": "2025-10-01",
                "until": "2025-10-20"
            }
        },
        "message": "Demo analytics data"
    }

@app.post("/security/configure")
async def configure_security(zone_id: str, security_level: str = "medium"):
    """Configure security settings for a zone"""
    valid_levels = ["off", "essentially_off", "low", "medium", "high", "under_attack"]

    if security_level not in valid_levels:
        raise HTTPException(status_code=400, detail=f"Invalid security level. Must be one of: {valid_levels}")

    return {
        "success": True,
        "zone_id": zone_id,
        "security_level": security_level,
        "message": f"Demo: Security level would be set to '{security_level}' for zone {zone_id}"
    }

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
                    {"name": "app", "type": "A", "content": "192.168.1.102", "proxied": True},
                    {"name": "admin", "type": "A", "content": "192.168.1.103", "proxied": True},
                    {"name": "docs", "type": "A", "content": "192.168.1.104", "proxied": True}
                ]
            },
            "upmplus.dev": {
                "description": "Development domain",
                "records": [
                    {"name": "@", "type": "A", "content": "192.168.1.110", "proxied": True},
                    {"name": "api", "type": "A", "content": "192.168.1.111", "proxied": True},
                    {"name": "dev", "type": "A", "content": "192.168.1.112", "proxied": True}
                ]
            },
            "upmplus.io": {
                "description": "Staging domain",
                "records": [
                    {"name": "@", "type": "A", "content": "192.168.1.120", "proxied": True},
                    {"name": "api", "type": "A", "content": "192.168.1.121", "proxied": True},
                    {"name": "staging", "type": "A", "content": "192.168.1.122", "proxied": True}
                ]
            },
            "upmplus.ai": {
                "description": "AI services domain",
                "records": [
                    {"name": "@", "type": "A", "content": "192.168.1.130", "proxied": True},
                    {"name": "api", "type": "A", "content": "192.168.1.131", "proxied": True},
                    {"name": "ai", "type": "A", "content": "192.168.1.132", "proxied": True}
                ]
            }
        }
    }

@app.post("/upm/deploy-all")
async def deploy_upm_domains(background_tasks: BackgroundTasks):
    """Deploy DNS records for all UPM.Plus domains"""
    background_tasks.add_task(deploy_all_upm_domains_task)
    return {"message": "UPM.Plus domain deployment started in background (Demo mode)"}

async def deploy_all_upm_domains_task():
    """Background task to deploy all UPM.Plus domains"""
    print("🚀 Starting UPM.Plus domain deployment (Demo)...")

    # Simulate deployment steps
    steps = [
        "Creating DNS records for upm.plus (Production)",
        "Configuring SSL certificates for all domains",
        "Setting up CDN and caching rules",
        "Configuring security settings",
        "Creating analytics tracking",
        "Testing all domain configurations"
    ]

    for i, step in enumerate(steps, 1):
        await asyncio.sleep(1)  # Simulate work
        print(f"   {i}/{len(steps)}: {step}")

    print("✅ UPM.Plus domain deployment completed (Demo)")

# Test endpoints
@app.get("/test/dns-setup")
async def test_dns_setup():
    """Test DNS setup for all UPM.Plus domains"""
    results = {}

    for domain in UPM_DOMAINS:
        zone_id = demo_zones[domain]["id"]

        # Create test DNS records
        test_records = [
            {"name": "@", "type": "A", "content": "192.168.1.100"},
            {"name": "www", "type": "CNAME", "content": domain},
            {"name": "api", "type": "A", "content": "192.168.1.101"}
        ]

        results[domain] = {
            "zone_id": zone_id,
            "records_created": len(test_records),
            "status": "success",
            "message": f"Demo: {len(test_records)} DNS records would be created for {domain}"
        }

    return {
        "test_results": results,
        "summary": f"Demo: DNS setup test completed for {len(UPM_DOMAINS)} domains"
    }

@app.get("/test/ssl-setup")
async def test_ssl_setup():
    """Test SSL setup for all UPM.Plus domains"""
    results = {}

    ssl_configs = {
        "upm.plus": "strict",
        "upmplus.dev": "full",
        "upmplus.io": "full",
        "upmplus.ai": "strict"
    }

    for domain, ssl_mode in ssl_configs.items():
        zone_id = demo_zones[domain]["id"]

        results[domain] = {
            "zone_id": zone_id,
            "ssl_mode": ssl_mode,
            "status": "success",
            "message": f"Demo: SSL would be set to '{ssl_mode}' for {domain}"
        }

    return {
        "test_results": results,
        "summary": f"Demo: SSL setup test completed for {len(ssl_configs)} domains"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8082, log_level="info")