"""
Cloudflare Integration Service
Comprehensive Cloudflare API integration for DNS, CDN, Workers, and infrastructure management
"""

import os
import json
import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple, Union
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
from urllib.parse import urljoin

import httpx
from pydantic import BaseModel

from sqlalchemy.orm import Session
from app.models.infrastructure import InfrastructureProvider, InfrastructureResource
from app.core.config import settings

logger = logging.getLogger(__name__)

class CloudflareResourceType(Enum):
    """Cloudflare resource types"""
    ZONE = "zone"
    DNS_RECORD = "dns_record"
    WORKER = "worker"
    WORKER_ROUTE = "worker_route"
    KV_NAMESPACE = "kv_namespace"
    KV_VALUE = "kv_value"
    R2_BUCKET = "r2_bucket"
    R2_OBJECT = "r2_object"
    D1_DATABASE = "d1_database"
    D1_TABLE = "d1_table"
    TUNNEL = "tunnel"
    ACCESS_APPLICATION = "access_application"
    ACCESS_POLICY = "access_policy"
    PAGE_RULE = "page_rule"
    TRANSFORMATION_RULE = "transformation_rule"
    ORIGIN_CA_CERTIFICATE = "origin_ca_certificate"
    ARGO_TUNNEL = "argo_tunnel"
    SPECTRUM_APPLICATION = "spectrum_application"
    POOL = "pool"
    MONITOR = "monitor"
    IMAGE = "image"
    STREAM = "stream"

class CloudflareZoneStatus(Enum):
    """Cloudflare zone status"""
    ACTIVE = "active"
    PENDING = "pending"
    INITIALIZING = "initializing"
    MOVED = "moved"
    DELETED = "deleted"
    VERSIFIED = "verified"
    READ_ONLY = "read_only"

class CloudflareDNSRecordType(Enum):
    """Cloudflare DNS record types"""
    A = "A"
    AAAA = "AAAA"
    CNAME = "CNAME"
    TXT = "TXT"
    SRV = "SRV"
    PTR = "PTR"
    NS = "NS"
    MX = "MX"
    CAA = "CAA"
    CERT = "CERT"
    DNSKEY = "DNSKEY"
    DS = "DS"
    NSEC = "NSEC"
    RRSIG = "RRSIG"
    HTTPS = "HTTPS"
    SVCB = "SVCB"
    LOC = "LOC"
    SPF = "SPF"

@dataclass
class CloudflareCredentials:
    """Cloudflare API credentials"""
    api_token: str
    email: Optional[str] = None  # For legacy API key auth
    api_key: Optional[str] = None  # For legacy API key auth
    account_id: Optional[str] = None

@dataclass
class CloudflareZone:
    """Cloudflare zone information"""
    id: str
    name: str
    status: CloudflareZoneStatus
    account_id: str
    account_name: str
    name_servers: List[str]
    plan: Dict[str, Any]
    permissions: List[str]
    paused: bool
    type: str
    development_mode: bool
    meta: Dict[str, Any]
    created_at: datetime
    modified_at: datetime
    activated_on: datetime

@dataclass
class CloudflareDNSRecord:
    """Cloudflare DNS record"""
    id: str
    zone_id: str
    zone_name: str
    name: str
    type: CloudflareDNSRecordType
    content: str
    proxiable: bool
    proxied: bool
    ttl: int
    priority: Optional[int] = None
    comment: Optional[str] = None
    tags: List[str] = None
    created_on: datetime
    modified_on: datetime

@dataclass
class CloudflareWorker:
    """Cloudflare Worker"""
    id: str
    script_name: str
    size: int
    modified_on: datetime
    created_on: datetime
    usage_model: str
    placement: Dict[str, Any]
    compatibility_date: str
    compatibility_flags: List[str]
    logpush: bool
    tail_consumers: List[str]

@dataclass
class CloudflareTunnel:
    """Cloudflare Tunnel"""
    id: str
    name: str
    uuid: str
    created_at: datetime
    deleted_at: Optional[datetime]
    conn_id: str
    secret: str
    origin_config: Dict[str, Any]
    status: str
    remote_config: Dict[str, Any]
    client_version: str
    features: List[str]

class CloudflareService:
    """
    Comprehensive Cloudflare API integration service
    Handles DNS, CDN, Workers, R2, D1, and other Cloudflare services
    """

    def __init__(self, db: Session):
        self.db = db
        self.base_url = "https://api.cloudflare.com/client/v4"
        self.timeout = settings.CLOUDFLARE_API_TIMEOUT or 30
        self.rate_limit_delay = 0.2  # Delay between API calls to respect rate limits

    async def create_provider(
        self,
        name: str,
        credentials: CloudflareCredentials,
        region: Optional[str] = None,
        configuration: Optional[Dict[str, Any]] = None,
        created_by: Optional[str] = None
    ) -> InfrastructureProvider:
        """
        Create a new Cloudflare provider
        """
        try:
            provider = InfrastructureProvider(
                name=name,
                provider_type="cloudflare",
                region=region,
                credentials=self._encrypt_credentials(credentials),
                configuration=configuration or {},
                capabilities=[
                    "dns_management",
                    "cdn_management",
                    "workers",
                    "r2_storage",
                    "d1_database",
                    "tunnels",
                    "access_control",
                    "analytics",
                    "image_optimization",
                    "streaming"
                ],
                is_active=True,
                created_by=created_by,
                created_at=datetime.now(timezone.utc)
            )

            self.db.add(provider)
            self.db.commit()
            self.db.refresh(provider)

            # Verify connection
            await self._verify_connection(provider.id)

            logger.info(f"Created Cloudflare provider: {name}")
            return provider

        except Exception as e:
            logger.error(f"Failed to create Cloudflare provider {name}: {str(e)}")
            raise

    async def verify_connection(self, provider_id: str) -> bool:
        """
        Verify Cloudflare API connection
        """
        try:
            provider = self.db.query(InfrastructureProvider).filter(
                InfrastructureProvider.id == provider_id
            ).first()

            if not provider:
                raise ValueError(f"Provider {provider_id} not found")

            # Test API connection
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = await self._get_auth_headers(provider)
                response = await client.get(
                    f"{self.base_url}/user/tokens/verify",
                    headers=headers
                )

                if response.status_code == 200:
                    # Update provider status
                    provider.is_connected = True
                    provider.last_verified = datetime.now(timezone.utc)
                    provider.verification_error = None

                    # Update provider info from response
                    user_info = response.json().get("result", {})
                    provider.configuration = {
                        **provider.configuration,
                        "user_email": user_info.get("email"),
                        "user_status": user_info.get("status"),
                    }

                    self.db.commit()
                    return True
                else:
                    provider.is_connected = False
                    provider.verification_error = f"API verification failed: {response.status_code}"
                    self.db.commit()
                    return False

        except Exception as e:
            logger.error(f"Failed to verify Cloudflare connection for provider {provider_id}: {str(e)}")
            # Update provider with error
            try:
                provider.is_connected = False
                provider.verification_error = str(e)
                self.db.commit()
            except:
                pass
            return False

    async def _verify_connection(self, provider_id: str):
        """Internal method to verify connection during creation"""
        return await self.verify_connection(provider_id)

    async def _get_auth_headers(self, provider: InfrastructureProvider) -> Dict[str, str]:
        """Get authentication headers for Cloudflare API"""
        credentials = self._decrypt_credentials(provider.credentials)

        headers = {
            "Content-Type": "application/json",
            "User-Agent": f"UPM.Plus/1.0"
        }

        if credentials.api_token:
            # Use API Token authentication (preferred)
            headers["Authorization"] = f"Bearer {credentials.api_token}"
        elif credentials.email and credentials.api_key:
            # Use legacy API Key authentication
            headers["X-Auth-Email"] = credentials.email
            headers["X-Auth-Key"] = credentials.api_key
        else:
            raise ValueError("No valid Cloudflare credentials found")

        return headers

    async def list_zones(
        self,
        provider_id: str,
        name: Optional[str] = None,
        status: Optional[CloudflareZoneStatus] = None,
        page: int = 1,
        per_page: int = 50
    ) -> Tuple[List[CloudflareZone], Dict[str, Any]]:
        """
        List Cloudflare zones
        """
        try:
            provider = self.db.query(InfrastructureProvider).filter(
                InfrastructureProvider.id == provider_id
            ).first()

            if not provider:
                raise ValueError(f"Provider {provider_id} not found")

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = await self._get_auth_headers(provider)
                params = {
                    "page": page,
                    "per_page": per_page,
                    "match": "any"  # Search mode
                }

                if name:
                    params["name"] = name
                if status:
                    params["status"] = status.value

                response = await client.get(
                    f"{self.base_url}/zones",
                    headers=headers,
                    params=params
                )

                if response.status_code == 200:
                    data = response.json()
                    result = data.get("result", [])
                    result_info = data.get("result_info", {})

                    zones = []
                    for zone_data in result:
                        zone = CloudflareZone(
                            id=zone_data["id"],
                            name=zone_data["name"],
                            status=CloudflareZoneStatus(zone_data["status"]),
                            account_id=zone_data["account"]["id"],
                            account_name=zone_data["account"]["name"],
                            name_servers=zone_data.get("name_servers", []),
                            plan=zone_data.get("plan", {}),
                            permissions=zone_data.get("permissions", []),
                            paused=zone_data.get("paused", False),
                            type=zone_data.get("type", "full"),
                            development_mode=zone_data.get("development_mode", False),
                            meta=zone_data.get("meta", {}),
                            created_at=datetime.fromisoformat(zone_data["created_on"].replace('Z', '+00:00')),
                            modified_at=datetime.fromisoformat(zone_data["modified_on"].replace('Z', '+00:00')),
                            activated_on=datetime.fromisoformat(zone_data["activated_on"].replace('Z', '+00:00'))
                        )
                        zones.append(zone)

                    return zones, result_info
                else:
                    raise Exception(f"Cloudflare API error: {response.status_code} - {response.text}")

        except Exception as e:
            logger.error(f"Failed to list Cloudflare zones: {str(e)}")
            raise

    async def create_zone(
        self,
        provider_id: str,
        name: str,
        account_id: Optional[str] = None,
        jump_start: bool = False,
        organization_id: Optional[str] = None
    ) -> CloudflareZone:
        """
        Create a new Cloudflare zone
        """
        try:
            provider = self.db.query(InfrastructureProvider).filter(
                InfrastructureProvider.id == provider_id
            ).first()

            if not provider:
                raise ValueError(f"Provider {provider_id} not found")

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = await self._get_auth_headers(provider)

                data = {
                    "name": name,
                    "jump_start": jump_start,
                }

                if account_id:
                    data["account"] = {"id": account_id}
                if organization_id:
                    data["organization"] = {"id": organization_id}

                response = await client.post(
                    f"{self.base_url}/zones",
                    headers=headers,
                    json=data
                )

                if response.status_code == 200:
                    result = response.json().get("result", {})

                    zone = CloudflareZone(
                        id=result["id"],
                        name=result["name"],
                        status=CloudflareZoneStatus(result["status"]),
                        account_id=result["account"]["id"],
                        account_name=result["account"]["name"],
                        name_servers=result.get("name_servers", []),
                        plan=result.get("plan", {}),
                        permissions=result.get("permissions", []),
                        paused=result.get("paused", False),
                        type=result.get("type", "full"),
                        development_mode=result.get("development_mode", False),
                        meta=result.get("meta", {}),
                        created_at=datetime.fromisoformat(result["created_on"].replace('Z', '+00:00')),
                        modified_at=datetime.fromisoformat(result["modified_on"].replace('Z', '+00:00')),
                        activated_on=datetime.fromisoformat(result["activated_on"].replace('Z', '+00:00'))
                    )

                    # Store zone in database
                    await self._create_resource_record(
                        provider_id=provider_id,
                        resource_type=CloudflareResourceType.ZONE,
                        resource_id=zone.id,
                        name=zone.name,
                        description=f"Cloudflare zone: {zone.name}",
                        specifications={
                            "status": zone.status.value,
                            "name_servers": zone.name_servers,
                            "plan": zone.plan,
                            "type": zone.type,
                            "development_mode": zone.development_mode,
                            "paused": zone.paused
                        },
                        status=zone.status.value,
                        created_by=provider.created_by
                    )

                    logger.info(f"Created Cloudflare zone: {zone.name}")
                    return zone
                else:
                    error_data = response.json().get("errors", [])
                    error_message = error_data[0].get("message", "Unknown error") if error_data else f"API error: {response.status_code}"
                    raise Exception(f"Failed to create zone: {error_message}")

        except Exception as e:
            logger.error(f"Failed to create Cloudflare zone {name}: {str(e)}")
            raise

    async def list_dns_records(
        self,
        provider_id: str,
        zone_id: str,
        record_type: Optional[CloudflareDNSRecordType] = None,
        name: Optional[str] = None,
        content: Optional[str] = None,
        page: int = 1,
        per_page: int = 50
    ) -> Tuple[List[CloudflareDNSRecord], Dict[str, Any]]:
        """
        List DNS records for a zone
        """
        try:
            provider = self.db.query(InfrastructureProvider).filter(
                InfrastructureProvider.id == provider_id
            ).first()

            if not provider:
                raise ValueError(f"Provider {provider_id} not found")

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = await self._get_auth_headers(provider)
                params = {
                    "page": page,
                    "per_page": per_page,
                    "match": "any"
                }

                if record_type:
                    params["type"] = record_type.value
                if name:
                    params["name"] = name
                if content:
                    params["content"] = content

                response = await client.get(
                    f"{self.base_url}/zones/{zone_id}/dns_records",
                    headers=headers,
                    params=params
                )

                if response.status_code == 200:
                    data = response.json()
                    result = data.get("result", [])
                    result_info = data.get("result_info", {})

                    records = []
                    for record_data in result:
                        record = CloudflareDNSRecord(
                            id=record_data["id"],
                            zone_id=record_data["zone_id"],
                            zone_name=record_data["zone_name"],
                            name=record_data["name"],
                            type=CloudflareDNSRecordType(record_data["type"]),
                            content=record_data["content"],
                            proxiable=record_data.get("proxiable", False),
                            proxied=record_data.get("proxied", False),
                            ttl=record_data["ttl"],
                            priority=record_data.get("priority"),
                            comment=record_data.get("comment"),
                            tags=record_data.get("tags", []),
                            created_on=datetime.fromisoformat(record_data["created_on"].replace('Z', '+00:00')),
                            modified_on=datetime.fromisoformat(record_data["modified_on"].replace('Z', '+00:00'))
                        )
                        records.append(record)

                    return records, result_info
                else:
                    raise Exception(f"Cloudflare API error: {response.status_code} - {response.text}")

        except Exception as e:
            logger.error(f"Failed to list DNS records for zone {zone_id}: {str(e)}")
            raise

    async def create_dns_record(
        self,
        provider_id: str,
        zone_id: str,
        record_type: CloudflareDNSRecordType,
        name: str,
        content: str,
        ttl: int = 1,
        proxied: bool = False,
        priority: Optional[int] = None,
        comment: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> CloudflareDNSRecord:
        """
        Create a DNS record
        """
        try:
            provider = self.db.query(InfrastructureProvider).filter(
                InfrastructureProvider.id == provider_id
            ).first()

            if not provider:
                raise ValueError(f"Provider {provider_id} not found")

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = await self._get_auth_headers(provider)

                data = {
                    "type": record_type.value,
                    "name": name,
                    "content": content,
                    "ttl": ttl,
                    "proxied": proxied,
                }

                if priority is not None:
                    data["priority"] = priority
                if comment:
                    data["comment"] = comment
                if tags:
                    data["tags"] = tags

                response = await client.post(
                    f"{self.base_url}/zones/{zone_id}/dns_records",
                    headers=headers,
                    json=data
                )

                if response.status_code == 200:
                    result = response.json().get("result", {})

                    record = CloudflareDNSRecord(
                        id=result["id"],
                        zone_id=result["zone_id"],
                        zone_name=result["zone_name"],
                        name=result["name"],
                        type=CloudflareDNSRecordType(result["type"]),
                        content=result["content"],
                        proxiable=result.get("proxiable", False),
                        proxied=result.get("proxied", False),
                        ttl=result["ttl"],
                        priority=result.get("priority"),
                        comment=result.get("comment"),
                        tags=result.get("tags", []),
                        created_on=datetime.fromisoformat(result["created_on"].replace('Z', '+00:00')),
                        modified_on=datetime.fromisoformat(result["modified_on"].replace('Z', '+00:00'))
                    )

                    # Store DNS record in database
                    await self._create_resource_record(
                        provider_id=provider_id,
                        resource_type=CloudflareResourceType.DNS_RECORD,
                        resource_id=record.id,
                        name=f"{record.name}.{record.zone_name}",
                        description=f"DNS {record.type.value} record",
                        specifications={
                            "zone_id": zone_id,
                            "type": record.type.value,
                            "content": record.content,
                            "ttl": record.ttl,
                            "proxied": record.proxied,
                            "priority": record.priority,
                            "tags": record.tags
                        },
                        status="active",
                        created_by=provider.created_by
                    )

                    logger.info(f"Created DNS record: {record.name}.{record.zone_name} ({record.type.value})")
                    return record
                else:
                    error_data = response.json().get("errors", [])
                    error_message = error_data[0].get("message", "Unknown error") if error_data else f"API error: {response.status_code}"
                    raise Exception(f"Failed to create DNS record: {error_message}")

        except Exception as e:
            logger.error(f"Failed to create DNS record {name} ({record_type.value}): {str(e)}")
            raise

    async def deploy_worker(
        self,
        provider_id: str,
        script_name: str,
        script_content: str,
        bindings: Optional[List[Dict[str, Any]]] = None,
        kv_namespace_bindings: Optional[List[Dict[str, Any]]] = None,
        r2_bucket_bindings: Optional[List[Dict[str, Any]]] = None,
        environment: str = "production",
        compatibility_date: str = "2023-10-30"
    ) -> CloudflareWorker:
        """
        Deploy a Cloudflare Worker
        """
        try:
            provider = self.db.query(InfrastructureProvider).filter(
                InfrastructureProvider.id == provider_id
            ).first()

            if not provider:
                raise ValueError(f"Provider {provider_id} not found")

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = await self._get_auth_headers(provider)

                data = {
                    "name": script_name,
                    "content": script_content,
                    "main_module": script_name,
                    "compatibility_date": compatibility_date,
                    "compatibility_flags": ["nodejs_compat"],
                    "usage_model": "bundled",
                }

                if bindings:
                    data["bindings"] = bindings
                if kv_namespace_bindings:
                    data["kv_namespace_bindings"] = kv_namespace_bindings
                if r2_bucket_bindings:
                    data["r2_bucket_bindings"] = r2_bucket_bindings

                response = await client.put(
                    f"{self.base_url}/accounts/{provider.configuration.get('account_id', 'default')}/workers/scripts/{script_name}",
                    headers=headers,
                    json=data
                )

                if response.status_code == 200:
                    result = response.json().get("result", {})

                    worker = CloudflareWorker(
                        id=result.get("id", script_name),
                        script_name=script_name,
                        size=len(script_content),
                        modified_on=datetime.fromisoformat(result.get("modified_on", datetime.now(timezone.utc).isoformat()).replace('Z', '+00:00')),
                        created_on=datetime.fromisoformat(result.get("created_on", datetime.now(timezone.utc).isoformat()).replace('Z', '+00:00')),
                        usage_model="bundled",
                        placement=result.get("placement", {}),
                        compatibility_date=compatibility_date,
                        compatibility_flags=["nodejs_compat"],
                        logpush=False,
                        tail_consumers=[],
                    )

                    # Store worker in database
                    await self._create_resource_record(
                        provider_id=provider_id,
                        resource_type=CloudflareResourceType.WORKER,
                        resource_id=worker.id,
                        name=worker.script_name,
                        description=f"Cloudflare Worker: {worker.script_name}",
                        specifications={
                            "size": worker.size,
                            "usage_model": worker.usage_model,
                            "compatibility_date": worker.compatibility_date,
                            "environment": environment,
                            "bindings": bindings or [],
                            "kv_namespace_bindings": kv_namespace_bindings or [],
                            "r2_bucket_bindings": r2_bucket_bindings or []
                        },
                        status="active",
                        created_by=provider.created_by
                    )

                    logger.info(f"Deployed Cloudflare Worker: {script_name}")
                    return worker
                else:
                    error_data = response.json().get("errors", [])
                    error_message = error_data[0].get("message", "Unknown error") if error_data else f"API error: {response.status_code}"
                    raise Exception(f"Failed to deploy worker: {error_message}")

        except Exception as e:
            logger.error(f"Failed to deploy Cloudflare Worker {script_name}: {str(e)}")
            raise

    async def create_r2_bucket(
        self,
        provider_id: str,
        bucket_name: str,
        region: str = "auto"
    ) -> Dict[str, Any]:
        """
        Create an R2 bucket
        """
        try:
            provider = self.db.query(InfrastructureProvider).filter(
                InfrastructureProvider.id == provider_id
            ).first()

            if not provider:
                raise ValueError(f"Provider {provider_id} not found")

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = await self._get_auth_headers(provider)

                data = {
                    "name": bucket_name,
                }

                # For R2, we need to use the R2 API endpoint
                r2_base_url = f"https://api.cloudflare.com/client/v4/accounts/{provider.configuration.get('account_id', 'default')}/r2/buckets"

                response = await client.post(
                    r2_base_url,
                    headers=headers,
                    json=data
                )

                if response.status_code == 200:
                    result = response.json().get("result", {})

                    bucket_info = {
                        "id": result["id"],
                        "name": result["name"],
                        "creation_date": result["creation_date"],
                        "location": region,
                    }

                    # Store bucket in database
                    await self._create_resource_record(
                        provider_id=provider_id,
                        resource_type=CloudflareResourceType.R2_BUCKET,
                        resource_id=bucket_info["id"],
                        name=bucket_info["name"],
                        description=f"Cloudflare R2 bucket: {bucket_info['name']}",
                        specifications={
                            "creation_date": bucket_info["creation_date"],
                            "location": region
                        },
                        status="active",
                        created_by=provider.created_by
                    )

                    logger.info(f"Created R2 bucket: {bucket_name}")
                    return bucket_info
                else:
                    error_data = response.json().get("errors", [])
                    error_message = error_data[0].get("message", "Unknown error") if error_data else f"API error: {response.status_code}"
                    raise Exception(f"Failed to create R2 bucket: {error_message}")

        except Exception as e:
            logger.error(f"Failed to create R2 bucket {bucket_name}: {str(e)}")
            raise

    async def create_tunnel(
        self,
        provider_id: str,
        name: str,
        destination: str,
        tunnel_secret: Optional[str] = None,
        proto: str = "http"
    ) -> CloudflareTunnel:
        """
        Create a Cloudflare Tunnel
        """
        try:
            provider = self.db.query(InfrastructureProvider).filter(
                InfrastructureProvider.id == provider_id
            ).first()

            if not provider:
                raise ValueError(f"Provider {provider_id} not found")

            # Generate tunnel secret if not provided
            if not tunnel_secret:
                import secrets
                tunnel_secret = secrets.token_urlsafe(32)

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = await self._get_auth_headers(provider)

                data = {
                    "name": name,
                    "tunnel_secret": tunnel_secret,
                    "config_src": "cloudflare",
                    "origin_request": {
                        "url": destination if destination.startswith(('http://', 'https://')) else f"{proto}://{destination}"
                    }
                }

                response = await client.post(
                    f"{self.base_url}/accounts/{provider.configuration.get('account_id', 'default')}/cfd_tunnel",
                    headers=headers,
                    json=data
                )

                if response.status_code == 200:
                    result = response.json().get("result", {})

                    tunnel = CloudflareTunnel(
                        id=result["id"],
                        name=result["name"],
                        uuid=result["uuid"],
                        created_at=datetime.fromisoformat(result["created_at"].replace('Z', '+00:00')),
                        deleted_at=None,
                        conn_id=result["conn_id"],
                        secret=tunnel_secret,
                        origin_config=result.get("origin_config", {}),
                        status=result.get("status", "inactive"),
                        remote_config=result.get("remote_config", {}),
                        client_version=result.get("client_version", ""),
                        features=result.get("features", [])
                    )

                    # Store tunnel in database
                    await self._create_resource_record(
                        provider_id=provider_id,
                        resource_type=CloudflareResourceType.TUNNEL,
                        resource_id=tunnel.id,
                        name=tunnel.name,
                        description=f"Cloudflare Tunnel: {tunnel.name}",
                        specifications={
                            "uuid": tunnel.uuid,
                            "status": tunnel.status,
                            "proto": proto,
                            "destination": destination,
                            "features": tunnel.features
                        },
                        status=tunnel.status,
                        created_by=provider.created_by
                    )

                    logger.info(f"Created Cloudflare Tunnel: {name}")
                    return tunnel
                else:
                    error_data = response.json().get("errors", [])
                    error_message = error_data[0].get("message", "Unknown error") if error_data else f"API error: {response.status_code}"
                    raise Exception(f"Failed to create tunnel: {error_message}")

        except Exception as e:
            logger.error(f"Failed to create Cloudflare Tunnel {name}: {str(e)}")
            raise

    async def purge_cache(
        self,
        provider_id: str,
        zone_id: str,
        files: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
        hosts: Optional[List[str]] = None,
        purge_everything: bool = False
    ) -> Dict[str, Any]:
        """
        Purge Cloudflare cache
        """
        try:
            provider = self.db.query(InfrastructureProvider).filter(
                InfrastructureProvider.id == provider_id
            ).first()

            if not provider:
                raise ValueError(f"Provider {provider_id} not found")

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = await self._get_auth_headers(provider)

                data = {"purge_everything": purge_everything}

                if files:
                    data["files"] = files
                if tags:
                    data["tags"] = tags
                if hosts:
                    data["hosts"] = hosts

                response = await client.post(
                    f"{self.base_url}/zones/{zone_id}/purge_cache",
                    headers=headers,
                    json=data
                )

                if response.status_code == 200:
                    result = response.json().get("result", {})

                    logger.info(f"Purged cache for zone {zone_id}: {result.get('id', 'unknown')}")
                    return result
                else:
                    error_data = response.json().get("errors", [])
                    error_message = error_data[0].get("message", "Unknown error") if error_data else f"API error: {response.status_code}"
                    raise Exception(f"Failed to purge cache: {error_message}")

        except Exception as e:
            logger.error(f"Failed to purge cache for zone {zone_id}: {str(e)}")
            raise

    async def get_zone_analytics(
        self,
        provider_id: str,
        zone_id: str,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        metrics: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Get zone analytics data
        """
        try:
            provider = self.db.query(InfrastructureProvider).filter(
                InfrastructureProvider.id == provider_id
            ).first()

            if not provider:
                raise ValueError(f"Provider {provider_id} not found")

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = await self._get_auth_headers(provider)

                params = {}
                if since:
                    params["since"] = since.isoformat()
                if until:
                    params["until"] = until.isoformat()
                if metrics:
                    params["metrics"] = ",".join(metrics)

                response = await client.get(
                    f"{self.base_url}/zones/{zone_id}/analytics/dashboard",
                    headers=headers,
                    params=params
                )

                if response.status_code == 200:
                    result = response.json().get("result", {})

                    logger.info(f"Retrieved analytics for zone {zone_id}")
                    return result
                else:
                    error_data = response.json().get("errors", [])
                    error_message = error_data[0].get("message", "Unknown error") if error_data else f"API error: {response.status_code}"
                    raise Exception(f"Failed to get analytics: {error_message}")

        except Exception as e:
            logger.error(f"Failed to get analytics for zone {zone_id}: {str(e)}")
            raise

    async def sync_resources(self, provider_id: str) -> Dict[str, int]:
        """
        Sync all Cloudflare resources for a provider
        """
        try:
            sync_counts = {
                "zones": 0,
                "dns_records": 0,
                "workers": 0,
                "r2_buckets": 0,
                "tunnels": 0,
            }

            # Sync zones
            zones, _ = await self.list_zones(provider_id)
            sync_counts["zones"] = len(zones)

            for zone in zones:
                # Sync DNS records for each zone
                records, _ = await self.list_dns_records(provider_id, zone.id)
                sync_counts["dns_records"] += len(records)

            # Update provider's resource count
            provider = self.db.query(InfrastructureProvider).filter(
                InfrastructureProvider.id == provider_id
            ).first()

            if provider:
                total_resources = sum(sync_counts.values())
                provider.resource_count = total_resources
                provider.last_sync = datetime.now(timezone.utc)
                self.db.commit()

            logger.info(f"Synced Cloudflare resources for provider {provider_id}: {sync_counts}")
            return sync_counts

        except Exception as e:
            logger.error(f"Failed to sync Cloudflare resources for provider {provider_id}: {str(e)}")
            raise

    # Private helper methods

    async def _create_resource_record(
        self,
        provider_id: str,
        resource_type: CloudflareResourceType,
        resource_id: str,
        name: str,
        description: str,
        specifications: Dict[str, Any],
        status: str = "active",
        created_by: Optional[str] = None
    ) -> InfrastructureResource:
        """Create infrastructure resource record"""
        resource = InfrastructureResource(
            provider_id=provider_id,
            resource_type=resource_type.value,
            resource_id=resource_id,
            name=name,
            description=description,
            specifications=specifications,
            tags=[],
            status=status,
            health="healthy" if status == "active" else "unknown",
            last_seen=datetime.now(timezone.utc),
            created_at_provider=datetime.now(timezone.utc),
            created_by=created_by
        )

        self.db.add(resource)
        self.db.commit()
        self.db.refresh(resource)

        return resource

    def _encrypt_credentials(self, credentials: CloudflareCredentials) -> str:
        """Encrypt Cloudflare credentials for storage"""
        # In production, use proper encryption (e.g., cryptography.fernet)
        import json
        import base64

        # For now, just base64 encode (replace with proper encryption in production)
        credentials_json = json.dumps({
            "api_token": credentials.api_token,
            "email": credentials.email,
            "api_key": credentials.api_key,
            "account_id": credentials.account_id
        })

        return base64.b64encode(credentials_json.encode()).decode()

    def _decrypt_credentials(self, encrypted_credentials: str) -> CloudflareCredentials:
        """Decrypt Cloudflare credentials from storage"""
        import json
        import base64

        # For now, just base64 decode (replace with proper decryption in production)
        try:
            decoded_json = base64.b64decode(encrypted_credentials.encode()).decode()
            credentials_data = json.loads(decoded_json)

            return CloudflareCredentials(
                api_token=credentials_data["api_token"],
                email=credentials_data.get("email"),
                api_key=credentials_data.get("api_key"),
                account_id=credentials_data.get("account_id")
            )
        except Exception as e:
            raise ValueError(f"Failed to decrypt credentials: {str(e)}")

    async def _delay_for_rate_limit(self):
        """Add delay to respect Cloudflare rate limits"""
        await asyncio.sleep(self.rate_limit_delay)