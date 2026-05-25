#!/usr/bin/env python3
"""
UPM.Plus Cloudflare Production API Server
Real Cloudflare integration for UPM.Plus domain management
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
load_dotenv('/Users/shaharsolomon/dev/projects/github/upm.plus/mcp-servers/.env')

# Initialize FastAPI app
app = FastAPI(
    title="UPM.Plus Cloudflare Production API Server",
    description="Real Cloudflare domain management for UPM.Plus",
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

# UPM.Plus configuration from environment
UPM_CONFIG = {
    "domains": {
        "upm.plus": {
            "zone_id": os.getenv('CLOUDFLARE_ZONE_ID_UPM_PLUS'),
            "name": "UPM.Plus Production",
            "ssl_mode": "strict",
            "security_level": "high"
        },
        "upmplus.dev": {
            "zone_id": os.getenv('CLOUDFLARE_ZONE_ID_UPMPLUS_DEV'),
            "name": "UPM.Plus Development",
            "ssl_mode": "full",
            "security_level": "medium"
        },
        "upmplus.io": {
            "zone_id": os.getenv('CLOUDFLARE_ZONE_ID_UPMPLUS_IO'),
            "name": "UPM.Plus Staging",
            "ssl_mode": "full",
            "security_level": "medium"
        },
        "upmplus.ai": {
            "zone_id": os.getenv('CLOUDFLARE_ZONE_ID_UPMPLUS_AI'),
            "name": "UPM.Plus AI Services",
            "ssl_mode": "strict",
            "security_level": "high"
        }
    }
}

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
    "dev": {"name": "dev", "description": "Development environment"},
    "ai": {"name": "ai", "description": "AI services"}
}

# Pydantic models
class DNSRecordRequest(BaseModel):
    domain: str
    name: str
    type: str
    content: str
    ttl: int = 3600
    proxied: bool = True

class SSLSettingsRequest(BaseModel):
    domain: str
    ssl_mode: str

class SecuritySettingsRequest(BaseModel):
    domain: str
    security_level: str

# Cloudflare client (will be initialized with real credentials)
try:
    import CloudFlare
    cf_client = CloudFlare.CloudFlare(
        email=os.getenv('CLOUDFLARE_EMAIL'),
        token=os.getenv('CLOUDFLARE_API_TOKEN')
    )
    CLOUDFLARE_CONNECTED = True
    print("✅ Connected to Cloudflare API")
except Exception as e:
    print(f"⚠️  Cloudflare connection failed: {e}")
    cf_client = None
    CLOUDFLARE_CONNECTED = False

@app.on_event("startup")
async def startup_event():
    """Initialize server on startup"""
    print("🚀 UPM.Plus Cloudflare Production API Server Starting...")
    print(f"📊 Cloudflare Connected: {CLOUDFLARE_CONNECTED}")
    print(f"🌐 Domains Configured: {len(UPM_CONFIG['domains'])}")
    for domain, config in UPM_CONFIG['domains'].items():
        print(f"   - {domain}: {config['name']} (Zone: {config['zone_id'][:8]}...)")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "UPM.Plus Cloudflare Production API Server",
        "status": "production_ready" if CLOUDFLARE_CONNECTED else "demo_mode",
        "version": "1.0.0",
        "cloudflare_connected": CLOUDFLARE_CONNECTED,
        "domains": list(UPM_CONFIG["domains"].keys()),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "cloudflare_connected": CLOUDFLARE_CONNECTED,
        "domains_count": len(UPM_CONFIG["domains"]),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/domains")
async def get_domains():
    """List all UPM.Plus domains with their status"""
    if not CLOUDFLARE_CONNECTED:
        return {
            "domains": [
                {
                    "name": domain,
                    "zone_id": config["zone_id"],
                    "description": config["name"],
                    "status": "not_connected"
                }
                for domain, config in UPM_CONFIG["domains"].items()
            ],
            "message": "Demo mode - configure CLOUDFLARE_API_TOKEN for real data"
        }

    try:
        domains_data = []
        for domain, config in UPM_CONFIG["domains"].items():
            try:
                zone_info = cf_client.zones.get(config["zone_id"])
                domains_data.append({
                    "name": domain,
                    "zone_id": config["zone_id"],
                    "description": config["name"],
                    "status": zone_info["status"],
                    "name_servers": zone_info["name_servers"],
                    "ssl_mode": config["ssl_mode"],
                    "security_level": config["security_level"]
                })
            except Exception as e:
                domains_data.append({
                    "name": domain,
                    "zone_id": config["zone_id"],
                    "description": config["name"],
                    "status": "error",
                    "error": str(e)
                })

        return {"domains": domains_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch domains: {str(e)}")

@app.post("/dns/create")
async def create_dns_record(record: DNSRecordRequest):
    """Create a DNS record"""
    if not CLOUDFLARE_CONNECTED:
        return {
            "message": "Demo mode - DNS record would be created",
            "record": record.dict()
        }

    if record.domain not in UPM_CONFIG["domains"]:
        raise HTTPException(status_code=400, detail=f"Domain {record.domain} not configured")

    zone_id = UPM_CONFIG["domains"][record.domain]["zone_id"]

    try:
        dns_record = cf_client.zones.dns_records.post(
            zone_id,
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
            "message": f"DNS record '{record.name}' created successfully for {record.domain}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create DNS record: {str(e)}")

@app.get("/dns/{domain}")
async def get_dns_records(domain: str):
    """Get DNS records for a domain"""
    if domain not in UPM_CONFIG["domains"]:
        raise HTTPException(status_code=400, detail=f"Domain {domain} not configured")

    zone_id = UPM_CONFIG["domains"][domain]["zone_id"]

    if not CLOUDFLARE_CONNECTED:
        # Return demo data
        return {
            "domain": domain,
            "zone_id": zone_id,
            "records": [
                {"name": "@", "type": "A", "content": "192.168.1.100", "proxied": True},
                {"name": "www", "type": "CNAME", "content": domain, "proxied": True},
                {"name": "api", "type": "A", "content": "192.168.1.101", "proxied": True}
            ],
            "message": "Demo mode - configure CLOUDFLARE_API_TOKEN for real data"
        }

    try:
        records = cf_client.zones.dns_records.get(zone_id, per_page=100)
        return {
            "domain": domain,
            "zone_id": zone_id,
            "records": records
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch DNS records: {str(e)}")

@app.post("/ssl/configure")
async def configure_ssl(settings: SSLSettingsRequest):
    """Configure SSL/TLS settings for a domain"""
    if settings.domain not in UPM_CONFIG["domains"]:
        raise HTTPException(status_code=400, detail=f"Domain {settings.domain} not configured")

    zone_id = UPM_CONFIG["domains"][settings.domain]["zone_id"]

    if not CLOUDFLARE_CONNECTED:
        return {
            "message": "Demo mode - SSL settings would be configured",
            "domain": settings.domain,
            "ssl_mode": settings.ssl_mode
        }

    try:
        ssl_settings = cf_client.zones.settings.ssl.put(
            zone_id,
            data={"value": settings.ssl_mode}
        )
        return {
            "success": True,
            "domain": settings.domain,
            "ssl_mode": settings.ssl_mode,
            "settings": ssl_settings,
            "message": f"SSL mode set to '{settings.ssl_mode}' for {settings.domain}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to configure SSL: {str(e)}")

@app.post("/security/configure")
async def configure_security(settings: SecuritySettingsRequest):
    """Configure security settings for a domain"""
    if settings.domain not in UPM_CONFIG["domains"]:
        raise HTTPException(status_code=400, detail=f"Domain {settings.domain} not configured")

    zone_id = UPM_CONFIG["domains"][settings.domain]["zone_id"]

    if not CLOUDFLARE_CONNECTED:
        return {
            "message": "Demo mode - Security settings would be configured",
            "domain": settings.domain,
            "security_level": settings.security_level
        }

    try:
        security_settings = cf_client.zones.settings.security_level.put(
            zone_id,
            data={"value": settings.security_level}
        )
        return {
            "success": True,
            "domain": settings.domain,
            "security_level": settings.security_level,
            "settings": security_settings,
            "message": f"Security level set to '{settings.security_level}' for {settings.domain}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to configure security: {str(e)}")

@app.post("/cache/purge/{domain}")
async def purge_cache(domain: str):
    """Purge cache for a domain"""
    if domain not in UPM_CONFIG["domains"]:
        raise HTTPException(status_code=400, detail=f"Domain {domain} not configured")

    zone_id = UPM_CONFIG["domains"][domain]["zone_id"]

    if not CLOUDFLARE_CONNECTED:
        return {
            "message": "Demo mode - Cache would be purged",
            "domain": domain
        }

    try:
        purge_result = cf_client.zones.purge_cache.post(
            zone_id,
            data={"purge_everything": True}
        )
        return {
            "success": True,
            "domain": domain,
            "result": purge_result,
            "message": f"Cache purged successfully for {domain}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to purge cache: {str(e)}")

@app.get("/upm/config")
async def get_upm_config():
    """Get complete UPM.Plus configuration"""
    return {
        "domains": UPM_CONFIG["domains"],
        "subdomains": UPM_SUBDOMAINS,
        "cloudflare_connected": CLOUDFLARE_CONNECTED,
        "recommended_ips": {
            "upm.plus": {
                "main": "203.0.113.100",
                "api": "203.0.113.101",
                "app": "203.0.113.102",
                "admin": "203.0.113.103"
            },
            "upmplus.dev": {
                "main": "203.0.113.110",
                "api": "203.0.113.111",
                "dev": "203.0.113.112"
            },
            "upmplus.io": {
                "main": "203.0.113.120",
                "api": "203.0.113.121",
                "staging": "203.0.113.122"
            },
            "upmplus.ai": {
                "main": "203.0.113.130",
                "api": "203.0.113.131",
                "ai": "203.0.113.132"
            }
        }
    }

@app.post("/upm/deploy-all")
async def deploy_upm_domains(background_tasks: BackgroundTasks):
    """Deploy all UPM.Plus domains with recommended configuration"""
    background_tasks.add_task(deploy_all_upm_domains_task)
    return {"message": "UPM.Plus domain deployment started in background"}

async def deploy_all_upm_domains_task():
    """Background task to deploy all UPM.Plus domains"""
    print("🚀 Starting UPM.Plus domain deployment...")

    if not CLOUDFLARE_CONNECTED:
        print("⚠️  Running in demo mode - no actual changes made")
        return

    # Recommended IP addresses (replace with actual server IPs)
    recommended_ips = {
        "upm.plus": {"@": "203.0.113.100", "api": "203.0.113.101", "app": "203.0.113.102"},
        "upmplus.dev": {"@": "203.0.113.110", "api": "203.0.113.111"},
        "upmplus.io": {"@": "203.0.113.120", "api": "203.0.113.121"},
        "upmplus.ai": {"@": "203.0.113.130", "api": "203.0.113.131"}
    }

    for domain, config in UPM_CONFIG["domains"].items():
        try:
            print(f"   Deploying {domain}...")
            zone_id = config["zone_id"]

            # Configure SSL
            cf_client.zones.settings.ssl.put(zone_id, data={"value": config["ssl_mode"]})
            print(f"     ✅ SSL set to {config['ssl_mode']}")

            # Configure security
            cf_client.zones.settings.security_level.put(zone_id, data={"value": config["security_level"]})
            print(f"     ✅ Security set to {config['security_level']}")

            # Create DNS records
            if domain in recommended_ips:
                for subdomain, ip in recommended_ips[domain].items():
                    cf_client.zones.dns_records.post(
                        zone_id,
                        data={
                            "name": subdomain,
                            "type": "A",
                            "content": ip,
                            "ttl": 3600,
                            "proxied": True
                        }
                    )
                    print(f"     ✅ DNS: {subdomain}.{domain} -> {ip}")

            print(f"   ✅ {domain} deployment completed")

        except Exception as e:
            print(f"   ❌ {domain} deployment failed: {e}")

    print("✅ UPM.Plus domain deployment completed")

@app.post("/test/connection")
async def test_cloudflare_connection():
    """Test connection to Cloudflare API"""
    if not CLOUDFLARE_CONNECTED:
        return {
            "connected": False,
            "message": "Cloudflare client not initialized. Check API token."
        }

    try:
        # Test by fetching user info
        user_info = cf_client.user.get()
        return {
            "connected": True,
            "user": {
                "id": user_info["id"],
                "email": user_info["email"]
            },
            "message": "Cloudflare connection successful"
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e),
            "message": "Cloudflare connection failed"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8083, log_level="info")