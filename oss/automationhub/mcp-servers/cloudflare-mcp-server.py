#!/usr/bin/env python3
"""
Cloudflare MCP Server for UPM.Plus
Model Context Protocol server for managing Cloudflare domains, DNS, SSL, and edge functions

This MCP server provides tools to:
- Manage DNS records across multiple domains
- Configure SSL/TLS settings
- Manage Cloudflare Workers
- Monitor analytics and security
- Control cache rules and page rules
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime
from dataclasses import dataclass

import aiohttp
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class CloudflareConfig:
    """Cloudflare configuration"""
    api_token: str
    email: str
    base_url: str = "https://api.cloudflare.com/client/v4"

class CloudflareMCPServer:
    """MCP Server for Cloudflare operations"""

    def __init__(self, config: CloudflareConfig):
        self.config = config
        self.session = None
        self.zone_cache: Dict[str, str] = {}  # domain -> zone_id mapping

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get HTTP session with proper headers"""
        if self.session is None:
            headers = {
                "Authorization": f"Bearer {self.config.api_token}",
                "Content-Type": "application/json",
                "X-Auth-Email": self.config.email,
            }
            self.session = aiohttp.ClientSession(headers=headers)
        return self.session

    async def _get_zone_id(self, domain: str) -> Optional[str]:
        """Get zone ID for a domain (with caching)"""
        if domain in self.zone_cache:
            return self.zone_cache[domain]

        session = await self._get_session()
        try:
            # List zones and find matching domain
            async with session.get(f"{self.config.base_url}/zones") as response:
                if response.status_code == 200:
                    zones = await response.json()
                    for zone in zones.get("result", []):
                        if zone["name"] == domain:
                            self.zone_cache[domain] = zone["id"]
                            return zone["id"]
                return None
        except Exception as e:
            logger.error(f"Error getting zone ID for {domain}: {e}")
            return None

    async def get_domains(self) -> List[Dict[str, Any]]:
        """List all domains in the account"""
        session = await self._get_session()
        try:
            async with session.get(f"{self.config.base_url}/zones") as response:
                if response.status_code == 200:
                    data = await response.json()
                    return data.get("result", [])
                else:
                    return []
        except Exception as e:
            logger.error(f"Error fetching domains: {e}")
            return []

    async def get_dns_records(self, domain: str, record_type: str = "A") -> List[Dict[str, Any]]:
        """Get DNS records for a domain"""
        zone_id = await self._get_zone_id(domain)
        if not zone_id:
            return []

        session = await self._get_session()
        try:
            async with session.get(f"{self.config.base_url}/zones/{zone_id}/dns_records",
                                 params={"type": record_type}) as response:
                if response.status_code == 200:
                    data = await response.json()
                    return data.get("result", [])
                else:
                    return []
        except Exception as e:
            logger.error(f"Error fetching DNS records for {domain}: {e}")
            return []

    async def create_dns_record(self, domain: str, record_type: str, name: str,
                             content: str, ttl: int = 300) -> Dict[str, Any]:
        """Create a DNS record"""
        zone_id = await self._get_zone_id(domain)
        if not zone_id:
            return {"error": f"Zone not found for domain: {domain}"}

        session = await self._get_session()
        try:
            record_data = {
                "type": record_type,
                "name": name,
                "content": content,
                "ttl": ttl,
                "proxied": False,
            }

            async with session.post(f"{self.config.base_url}/zones/{zone_id}/dns_records",
                                      json=record_data) as response:
                if response.status_code == 200:
                    result = await response.json()
                    return result.get("result", {})
                else:
                    error_text = await response.text()
                    return {"error": f"HTTP {response.status_code}: {error_text}"}
        except Exception as e:
            logger.error(f"Error creating DNS record: {e}")
            return {"error": str(e)}

    async def update_dns_record(self, domain: str, record_id: str,
                              updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update a DNS record"""
        zone_id = await self._get_zone_id(domain)
        if not zone_id:
            return {"error": f"Zone not found for domain: {domain}"}

        session = await self._get_session()
        try:
            async with session.put(f"{self.config.base_url}/zones/{zone_id}/dns_records/{record_id}",
                                    json=updates) as response:
                if response.status_code == 200:
                    result = await response.json()
                    return result.get("result", {})
                else:
                    error_text = await response.text()
                    return {"error": f"HTTP {response.status_code}: {error_text}"}
        except Exception as e:
            logger.error(f"Error updating DNS record: {e}")
            return {"error": str(e)}

    async def delete_dns_record(self, domain: str, record_id: str) -> Dict[str, Any]:
        """Delete a DNS record"""
        zone_id = await self._get_zone_id(domain)
        if not zone_id:
            return {"error": f"Zone not found for domain: {domain}"}

        session = await self._get_session()
        try:
            async with session.delete(f"{self.config.base_url}/zones/{zone_id}/dns_records/{record_id}") as response:
                if response.status_code == 200:
                    result = await response.json()
                    return result.get("result", {})
                else:
                    error_text = await response.text()
                    return {"error": f"HTTP {response.status_code}: {error_text}"}
        except Exception as e:
            logger.error(f"Error deleting DNS record: {e}")
            return {"error": str(e)}

    async def get_ssl_settings(self, domain: str) -> Dict[str, Any]:
        """Get SSL/TLS settings for a domain"""
        zone_id = await self._get_zone_id(domain)
        if not zone_id:
            return {"error": f"Zone not found for domain: {domain}"}

        session = await self._get_session()
        try:
            async with session.get(f"{self.config.base_url}/zones/{zone_id}/ssl/settings") as response:
                if response.status_code == 200:
                    return await response.json()
                else:
                    return {"error": f"HTTP {response.status_code}"}
        except Exception as e:
            logger.error(f"Error fetching SSL settings: {e}")
            return {"error": str(e)}

    async def update_ssl_settings(self, domain: str, settings: Dict[str, Any]) -> Dict[str, Any]:
        """Update SSL/TLS settings for a domain"""
        zone_id = await self._get_zone_id(domain)
        if not zone_id:
            return {"error": f"Zone not found for domain: {domain}"}

        session = await self._get_session()
        try:
            async with session.patch(f"{self.config.base_url}/zones/{zone_id}/ssl/settings",
                                     json=settings) as response:
                if response.status_code == 200:
                    return await response.json()
                else:
                    error_text = await response.text()
                    return {"error": f"HTTP {response.status_code}: {error_text}"}
        except Exception as e:
            logger.error(f"Error updating SSL settings: {e}")
            return {"error": str(e)}

    async def get_workers(self) -> List[Dict[str, Any]]:
        """List all Cloudflare Workers"""
        session = await self._get_session()
        try:
            async with session.get(f"{self.config.base_url}/workers/scripts") as response:
                if response.status_code == 200:
                    data = await response.json()
                    return data.get("result", [])
                else:
                    return []
        except Exception as e:
            logger.error(f"Error fetching workers: {e}")
            return []

    async def create_worker(self, name: str, script_content: str,
                           compatibility_date: str = "2023-10-30") -> Dict[str, Any]:
        """Create a Cloudflare Worker"""
        session = await self._get_session()
        try:
            worker_data = {
                "name": name,
                "content": script_content,
                "compatibility_date": compatibility_date,
            }

            async with session.post(f"{self.config.base_url}/workers/scripts",
                                      json=worker_data) as response:
                if response.status_code == 201:
                    result = await response.json()
                    return result.get("result", {})
                else:
                    error_text = await response.text()
                    return {"error": f"HTTP {response.status_code}: {error_text}"}
        except Exception as e:
            logger.error(f"Error creating worker: {e}")
            return {"error": str(e)}

    async def get_analytics(self, zone_id: str, since: str = None, until: str = None) -> Dict[str, Any]:
        """Get analytics for a zone"""
        session = await self._get_session()
        try:
            params = {}
            if since:
                params["since"] = since
            if until:
                params["until"] = until

            async with session.get(f"{self.config.base_url}/zones/{zone_id}/analytics/dashboard",
                                    params=params) as response:
                if response.status_code == 200:
                    return await response.json()
                else:
                    return {"error": f"HTTP {response.status_code}"}
        except Exception as e:
            logger.error(f"Error fetching analytics: {e}")
            return {"error": str(e)}

    async def purge_cache(self, zone_id: str, purge_everything: bool = False,
                          urls: List[str] = None) -> Dict[str, Any]:
        """Purge cache for a zone"""
        session = await self._get_session()
        try:
            if purge_everything:
                purge_data = {"purge_everything": True}
            elif urls:
                purge_data = {"files": urls}
            else:
                return {"error": "Either purge_everything=true or provide urls"}

            async with session.post(f"{self.config.base_url}/zones/{zone_id}/purge_cache",
                                      json=purge_data) as response:
                if response.status_code == 200:
                    return await response.json()
                else:
                    error_text = await response.text()
                    return {"error": f"HTTP {response.status_code}: {error_text}"}
        except Exception as e:
            logger.error(f"Error purging cache: {e}")
            return {"error": str(e)}

async def create_server():
    """Create and start the MCP server"""
    import os

    # Get configuration from environment variables
    api_token = os.getenv("CLOUDFLARE_API_TOKEN")
    email = os.getenv("CLOUDFLARE_EMAIL")

    if not api_token or not email:
        print("Error: CLOUDFLARE_API_TOKEN and CLOUDFLARE_EMAIL environment variables are required")
        return

    config = CloudflareConfig(api_token=api_token, email=email)
    server = stdio_server()
    cloudflare = CloudflareMCPServer(config)

    # Define MCP tools
    tools = [
        Tool(
            name="list_domains",
            description="List all Cloudflare domains",
            inputSchema={
                "type": "object",
                "properties": {},
            },
            handler=lambda args: cloudflare.get_domains()
        ),
        Tool(
            name="get_dns_records",
            description="Get DNS records for a domain",
            inputSchema={
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "description": "Domain name"},
                    "record_type": {"type": "string", "description": "DNS record type (default: A)", "default": "A"},
                },
                "required": ["domain"],
            },
            handler=lambda args: cloudflare.get_dns_records(
                args["domain"],
                args.get("record_type", "A")
            )
        ),
        Tool(
            name="create_dns_record",
            description="Create a DNS record",
            inputSchema={
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "description": "Domain name"},
                    "record_type": {"type": "string", "description": "Record type (A, AAAA, CNAME, etc.)"},
                    "name": {"type": "string", "description": "Record name"},
                    "content": {"type": "string", "description": "Record content/IP address"},
                    "ttl": {"type": "integer", "description": "TTL in seconds (default: 300)", "default": 300},
                },
                "required": ["domain", "record_type", "name", "content"],
            },
            handler=lambda args: cloudflare.create_dns_record(
                args["domain"],
                args["record_type"],
                args["name"],
                args["content"],
                args.get("ttl", 300)
            )
        ),
        Tool(
            name="update_dns_record",
            description="Update a DNS record",
            inputSchema={
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "description": "Domain name"},
                    "record_id": {"type": "string", "description": "DNS record ID"},
                    "content": {"type": "string", "description": "New record content/IP address"},
                    "ttl": {"type": "integer", "description": "New TTL in seconds"},
                },
                "required": ["domain", "record_id"],
            },
            handler=lambda args: cloudflare.update_dns_record(
                args["domain"],
                args["record_id"],
                {k: v for k, v in args.items() if k not in ["domain", "record_id"] and v is not None}
            )
        ),
        Tool(
            name="delete_dns_record",
            description="Delete a DNS record",
            inputSchema={
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "description": "Domain name"},
                    "record_id": {"type": "string", "description": "DNS record ID"},
                },
                "required": ["domain", "record_id"],
            },
            handler=lambda args: cloudflare.delete_dns_record(args["domain"], args["record_id"])
        ),
        Tool(
            name="get_ssl_settings",
            description="Get SSL/TLS settings for a domain",
            inputSchema={
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "description": "Domain name"},
                },
                "required": ["domain"],
            },
            handler=lambda args: cloudflare.get_ssl_settings(args["domain"])
        ),
        Tool(
            name="update_ssl_settings",
            description="Update SSL/TLS settings for a domain",
            inputSchema={
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "description": "Domain name"},
                    "ssl": {"type": "string", "description": "SSL mode (off, flexible, full, strict)"},
                    "tls_1_3": {"type": "string", "description": "TLS 1.3 (on/off)"},
                    "hsts": {"type": "string", "description": "HSTS (on/off)"},
                    "hsts_max_age": {"type": "integer", "description": "HSTS max age in seconds"},
                },
                "required": ["domain"],
            },
            handler=lambda args: cloudflare.update_ssl_settings(args["domain"],
                {k: v for k, v in args.items() if k != "domain" and v is not None})
        ),
        Tool(
            name="get_workers",
            description="List all Cloudflare Workers",
            inputSchema={
                "type": "object",
                "properties": {},
            },
            handler=lambda args: cloudflare.get_workers()
        ),
        Tool(
            name="create_worker",
            description="Create a Cloudflare Worker",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Worker name"},
                    "script_content": {"type": "string", "description": "Worker script content"},
                    "compatibility_date": {"type": "string", "description": "Compatibility date", "default": "2023-10-30"},
                },
                "required": ["name", "script_content"],
            },
            handler=lambda args: cloudflare.create_worker(
                args["name"],
                args["script_content"],
                args.get("compatibility_date", "2023-10-30")
            )
        ),
        Tool(
            name="get_analytics",
            description="Get analytics data for a zone",
            inputSchema={
                "type": "object",
                "properties": {
                    "zone_id": {"type": "string", "description": "Zone ID"},
                    "since": {"type": "string", "description": "Start date (YYYY-MM-DD)"},
                    "until": {"type": "string", "description": "End date (YYYY-MM-DD)"},
                },
                "required": ["zone_id"],
            },
            handler=lambda args: cloudflare.get_analytics(
                args["zone_id"],
                args.get("since"),
                args.get("until")
            )
        ),
        Tool(
            name="purge_cache",
            description="Purge cache for a zone",
            inputSchema={
                "type": "object",
                "properties": {
                    "zone_id": {"type": "string", "description": "Zone ID"},
                    "purge_everything": {"type": "boolean", "description": "Purge everything (default: false)", "default": False},
                    "urls": {"type": "array", "items": {"type": "string"}, "description": "Specific URLs to purge"},
                },
                "required": ["zone_id"],
            },
            handler=lambda args: cloudflare.purge_cache(
                args["zone_id"],
                args.get("purge_everything", False),
                args.get("urls")
            )
        ),
    ]

    # Add tools to server
    for tool in tools:
        server.add_tool(tool)

    print("🌐 Cloudflare MCP Server for UPM.Plus")
    print(f"📧 Managing domains: {', '.join([d['name'] for d in os.getenv('UPM_PLUS_DOMAINS', '').split(',') if d.strip()]) if os.getenv('UPM_PLUS_DOMAINS') else 'None'}")
    print("🔗 Ready to accept connections...")

    await server.run()

if __name__ == "__main__":
    asyncio.run(create_server())