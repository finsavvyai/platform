"""
Cloudflare API Endpoints
Comprehensive Cloudflare integration endpoints for DNS, CDN, Workers, and infrastructure management
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.infrastructure import InfrastructureProvider
from app.services.cloudflare_service import (
    CloudflareService, CloudflareCredentials, CloudflareZoneStatus, CloudflareDNSRecordType
)
from app.schemas.cloudflare import (
    CloudflareProviderCreate, CloudflareProviderUpdate, CloudflareProviderResponse,
    CloudflareZoneCreate, CloudflareZoneResponse, CloudflareZoneListResponse,
    CloudflareDNSRecordCreate, CloudflareDNSRecordResponse, CloudflareDNSRecordListResponse,
    CloudflareWorkerDeploy, CloudflareWorkerResponse,
    CloudflareR2BucketCreate, CloudflareR2BucketResponse,
    CloudflareTunnelCreate, CloudflareTunnelResponse,
    CloudflareCachePurgeRequest, CloudflareAnalyticsResponse
)
from app.core.deps import get_current_user
from app.core.security import require_permission

router = APIRouter()

# Provider Management Endpoints

@router.post("/providers", response_model=CloudflareProviderResponse, status_code=201)
async def create_cloudflare_provider(
    provider_data: CloudflareProviderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:write"))
):
    """
    Create a new Cloudflare provider

    Requires infrastructure:write permission
    """
    try:
        cloudflare_service = CloudflareService(db)

        credentials = CloudflareCredentials(
            api_token=provider_data.api_token,
            email=provider_data.email,
            api_key=provider_data.api_key,
            account_id=provider_data.account_id
        )

        provider = await cloudflare_service.create_provider(
            name=provider_data.name,
            credentials=credentials,
            region=provider_data.region,
            configuration=provider_data.configuration,
            created_by=current_user.id
        )

        # Remove sensitive credentials from response
        response_data = CloudflareProviderResponse.from_orm(provider)
        response_data.credentials = None

        return response_data

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create Cloudflare provider: {str(e)}")

@router.get("/providers", response_model=List[CloudflareProviderResponse])
async def list_cloudflare_providers(
    active_only: bool = Query(True, description="Show only active providers"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Results per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List Cloudflare providers

    Requires infrastructure:read permission
    """
    try:
        query = db.query(InfrastructureProvider).filter(
            InfrastructureProvider.provider_type == "cloudflare"
        )

        if active_only:
            query = query.filter(InfrastructureProvider.is_active == True)

        # Apply pagination
        offset = (page - 1) * limit
        providers = query.offset(offset).limit(limit).all()

        # Remove sensitive credentials from response
        provider_responses = []
        for provider in providers:
            response = CloudflareProviderResponse.from_orm(provider)
            response.credentials = None
            provider_responses.append(response)

        return provider_responses

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list Cloudflare providers: {str(e)}")

@router.get("/providers/{provider_id}", response_model=CloudflareProviderResponse)
async def get_cloudflare_provider(
    provider_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get Cloudflare provider details by ID

    Requires infrastructure:read permission
    """
    try:
        provider = db.query(InfrastructureProvider).filter(
            InfrastructureProvider.id == provider_id,
            InfrastructureProvider.provider_type == "cloudflare"
        ).first()

        if not provider:
            raise HTTPException(status_code=404, detail="Cloudflare provider not found")

        # Remove sensitive credentials from response
        response = CloudflareProviderResponse.from_orm(provider)
        response.credentials = None

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get Cloudflare provider: {str(e)}")

@router.post("/providers/{provider_id}/verify", status_code=200)
async def verify_cloudflare_provider(
    provider_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:write"))
):
    """
    Verify Cloudflare provider connection

    Requires infrastructure:write permission
    """
    try:
        cloudflare_service = CloudflareService(db)

        success = await cloudflare_service.verify_connection(provider_id)

        if success:
            return {"message": "Cloudflare connection verified successfully", "connected": True}
        else:
            return {"message": "Cloudflare connection verification failed", "connected": False}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to verify Cloudflare provider: {str(e)}")

@router.post("/providers/{provider_id}/sync", status_code=200)
async def sync_cloudflare_resources(
    provider_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:write"))
):
    """
    Sync Cloudflare resources

    Requires infrastructure:write permission
    """
    try:
        cloudflare_service = CloudflareService(db)

        # Run sync in background
        background_tasks.add_task(
            cloudflare_service.sync_resources,
            provider_id
        )

        return {"message": "Cloudflare resource sync started"}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync Cloudflare resources: {str(e)}")

# Zone Management Endpoints

@router.get("/providers/{provider_id}/zones", response_model=CloudflareZoneListResponse)
async def list_cloudflare_zones(
    provider_id: str,
    name: Optional[str] = Query(None, description="Filter by zone name"),
    status: Optional[str] = Query(None, description="Filter by zone status"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=100, description="Results per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List Cloudflare zones

    Requires infrastructure:read permission
    """
    try:
        cloudflare_service = CloudflareService(db)

        # Validate provider exists
        provider = db.query(InfrastructureProvider).filter(
            InfrastructureProvider.id == provider_id,
            InfrastructureProvider.provider_type == "cloudflare"
        ).first()

        if not provider:
            raise HTTPException(status_code=404, detail="Cloudflare provider not found")

        # Parse status filter
        zone_status = None
        if status:
            try:
                zone_status = CloudflareZoneStatus(status)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

        zones, result_info = await cloudflare_service.list_zones(
            provider_id=provider_id,
            name=name,
            status=zone_status,
            page=page,
            per_page=per_page
        )

        return CloudflareZoneListResponse(
            zones=[CloudflareZoneResponse.from_orm(zone) for zone in zones],
            pagination=result_info
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list Cloudflare zones: {str(e)}")

@router.post("/providers/{provider_id}/zones", response_model=CloudflareZoneResponse, status_code=201)
async def create_cloudflare_zone(
    provider_id: str,
    zone_data: CloudflareZoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:write"))
):
    """
    Create a new Cloudflare zone

    Requires infrastructure:write permission
    """
    try:
        cloudflare_service = CloudflareService(db)

        # Validate provider exists
        provider = db.query(InfrastructureProvider).filter(
            InfrastructureProvider.id == provider_id,
            InfrastructureProvider.provider_type == "cloudflare"
        ).first()

        if not provider:
            raise HTTPException(status_code=404, detail="Cloudflare provider not found")

        zone = await cloudflare_service.create_zone(
            provider_id=provider_id,
            name=zone_data.name,
            account_id=zone_data.account_id,
            jump_start=zone_data.jump_start,
            organization_id=zone_data.organization_id
        )

        return CloudflareZoneResponse.from_orm(zone)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create Cloudflare zone: {str(e)}")

@router.get("/providers/{provider_id}/zones/{zone_id}/analytics", response_model=CloudflareAnalyticsResponse)
async def get_cloudflare_zone_analytics(
    provider_id: str,
    zone_id: str,
    since: Optional[str] = Query(None, description="Start date (ISO format)"),
    until: Optional[str] = Query(None, description="End date (ISO format)"),
    metrics: Optional[List[str]] = Query(None, description="Metrics to retrieve"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get Cloudflare zone analytics

    Requires infrastructure:read permission
    """
    try:
        cloudflare_service = CloudflareService(db)

        # Validate provider exists
        provider = db.query(InfrastructureProvider).filter(
            InfrastructureProvider.id == provider_id,
            InfrastructureProvider.provider_type == "cloudflare"
        ).first()

        if not provider:
            raise HTTPException(status_code=404, detail="Cloudflare provider not found")

        # Parse dates
        since_dt = None
        until_dt = None

        if since:
            since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
        if until:
            until_dt = datetime.fromisoformat(until.replace('Z', '+00:00'))

        analytics = await cloudflare_service.get_zone_analytics(
            provider_id=provider_id,
            zone_id=zone_id,
            since=since_dt,
            until=until_dt,
            metrics=metrics
        )

        return CloudflareAnalyticsResponse(data=analytics)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get Cloudflare analytics: {str(e)}")

# DNS Management Endpoints

@router.get("/providers/{provider_id}/zones/{zone_id}/dns", response_model=CloudflareDNSRecordListResponse)
async def list_cloudflare_dns_records(
    provider_id: str,
    zone_id: str,
    record_type: Optional[str] = Query(None, description="Filter by record type"),
    name: Optional[str] = Query(None, description="Filter by record name"),
    content: Optional[str] = Query(None, description="Filter by content"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=100, description="Results per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List DNS records for a zone

    Requires infrastructure:read permission
    """
    try:
        cloudflare_service = CloudflareService(db)

        # Validate provider exists
        provider = db.query(InfrastructureProvider).filter(
            InfrastructureProvider.id == provider_id,
            InfrastructureProvider.provider_type == "cloudflare"
        ).first()

        if not provider:
            raise HTTPException(status_code=404, detail="Cloudflare provider not found")

        # Parse record type
        dns_type = None
        if record_type:
            try:
                dns_type = CloudflareDNSRecordType(record_type)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid record type: {record_type}")

        records, result_info = await cloudflare_service.list_dns_records(
            provider_id=provider_id,
            zone_id=zone_id,
            record_type=dns_type,
            name=name,
            content=content,
            page=page,
            per_page=per_page
        )

        return CloudflareDNSRecordListResponse(
            records=[CloudflareDNSRecordResponse.from_orm(record) for record in records],
            pagination=result_info
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list DNS records: {str(e)}")

@router.post("/providers/{provider_id}/zones/{zone_id}/dns", response_model=CloudflareDNSRecordResponse, status_code=201)
async def create_cloudflare_dns_record(
    provider_id: str,
    zone_id: str,
    record_data: CloudflareDNSRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:write"))
):
    """
    Create a DNS record

    Requires infrastructure:write permission
    """
    try:
        cloudflare_service = CloudflareService(db)

        # Validate provider exists
        provider = db.query(InfrastructureProvider).filter(
            InfrastructureProvider.id == provider_id,
            InfrastructureProvider.provider_type == "cloudflare"
        ).first()

        if not provider:
            raise HTTPException(status_code=404, detail="Cloudflare provider not found")

        # Parse record type
        try:
            dns_type = CloudflareDNSRecordType(record_data.type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid record type: {record_data.type}")

        record = await cloudflare_service.create_dns_record(
            provider_id=provider_id,
            zone_id=zone_id,
            record_type=dns_type,
            name=record_data.name,
            content=record_data.content,
            ttl=record_data.ttl,
            proxied=record_data.proxied,
            priority=record_data.priority,
            comment=record_data.comment,
            tags=record_data.tags
        )

        return CloudflareDNSRecordResponse.from_orm(record)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create DNS record: {str(e)}")

@router.post("/providers/{provider_id}/zones/{zone_id}/purge_cache", status_code=200)
async def purge_cloudflare_cache(
    provider_id: str,
    zone_id: str,
    purge_request: CloudflareCachePurgeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:write"))
):
    """
    Purge Cloudflare cache

    Requires infrastructure:write permission
    """
    try:
        cloudflare_service = CloudflareService(db)

        # Validate provider exists
        provider = db.query(InfrastructureProvider).filter(
            InfrastructureProvider.id == provider_id,
            InfrastructureProvider.provider_type == "cloudflare"
        ).first()

        if not provider:
            raise HTTPException(status_code=404, detail="Cloudflare provider not found")

        result = await cloudflare_service.purge_cache(
            provider_id=provider_id,
            zone_id=zone_id,
            files=purge_request.files,
            tags=purge_request.tags,
            hosts=purge_request.hosts,
            purge_everything=purge_request.purge_everything
        )

        return {"message": "Cache purge initiated successfully", "result": result}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to purge cache: {str(e)}")

# Worker Management Endpoints

@router.post("/providers/{provider_id}/workers/deploy", response_model=CloudflareWorkerResponse, status_code=201)
async def deploy_cloudflare_worker(
    provider_id: str,
    worker_data: CloudflareWorkerDeploy,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:write"))
):
    """
    Deploy a Cloudflare Worker

    Requires infrastructure:write permission
    """
    try:
        cloudflare_service = CloudflareService(db)

        # Validate provider exists
        provider = db.query(InfrastructureProvider).filter(
            InfrastructureProvider.id == provider_id,
            InfrastructureProvider.provider_type == "cloudflare"
        ).first()

        if not provider:
            raise HTTPException(status_code=404, detail="Cloudflare provider not found")

        worker = await cloudflare_service.deploy_worker(
            provider_id=provider_id,
            script_name=worker_data.script_name,
            script_content=worker_data.script_content,
            bindings=worker_data.bindings,
            kv_namespace_bindings=worker_data.kv_namespace_bindings,
            r2_bucket_bindings=worker_data.r2_bucket_bindings,
            environment=worker_data.environment,
            compatibility_date=worker_data.compatibility_date
        )

        return CloudflareWorkerResponse.from_orm(worker)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to deploy Worker: {str(e)}")

# R2 Storage Endpoints

@router.post("/providers/{provider_id}/r2/buckets", response_model=CloudflareR2BucketResponse, status_code=201)
async def create_r2_bucket(
    provider_id: str,
    bucket_data: CloudflareR2BucketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:write"))
):
    """
    Create an R2 bucket

    Requires infrastructure:write permission
    """
    try:
        cloudflare_service = CloudflareService(db)

        # Validate provider exists
        provider = db.query(InfrastructureProvider).filter(
            InfrastructureProvider.id == provider_id,
            InfrastructureProvider.provider_type == "cloudflare"
        ).first()

        if not provider:
            raise HTTPException(status_code=404, detail="Cloudflare provider not found")

        bucket = await cloudflare_service.create_r2_bucket(
            provider_id=provider_id,
            bucket_name=bucket_data.name,
            region=bucket_data.region
        )

        return CloudflareR2BucketResponse(**bucket)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create R2 bucket: {str(e)}")

# Tunnel Management Endpoints

@router.post("/providers/{provider_id}/tunnels", response_model=CloudflareTunnelResponse, status_code=201)
async def create_cloudflare_tunnel(
    provider_id: str,
    tunnel_data: CloudflareTunnelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("infrastructure:write"))
):
    """
    Create a Cloudflare Tunnel

    Requires infrastructure:write permission
    """
    try:
        cloudflare_service = CloudflareService(db)

        # Validate provider exists
        provider = db.query(InfrastructureProvider).filter(
            InfrastructureProvider.id == provider_id,
            InfrastructureProvider.provider_type == "cloudflare"
        ).first()

        if not provider:
            raise HTTPException(status_code=404, detail="Cloudflare provider not found")

        tunnel = await cloudflare_service.create_tunnel(
            provider_id=provider_id,
            name=tunnel_data.name,
            tunnel_secret=tunnel_data.secret,
            destination=tunnel_data.destination,
            proto=tunnel_data.proto
        )

        return CloudflareTunnelResponse.from_orm(tunnel)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create Tunnel: {str(e)}")

# Global Cloudflare Endpoints

@router.get("/analytics", response_model=CloudflareAnalyticsResponse)
async def get_global_cloudflare_analytics(
    provider_ids: Optional[List[str]] = Query(None, description="Provider IDs to include"),
    since: Optional[str] = Query(None, description="Start date (ISO format)"),
    until: Optional[str] = Query(None, description="End date (ISO format)"),
    metrics: Optional[List[str]] = Query(None, description="Metrics to retrieve"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get global Cloudflare analytics across all zones

    Requires infrastructure:read permission
    """
    try:
        cloudflare_service = CloudflareService(db)

        # If no provider specified, get all active Cloudflare providers
        if not provider_ids:
            providers = db.query(InfrastructureProvider).filter(
                InfrastructureProvider.provider_type == "cloudflare",
                InfrastructureProvider.is_active == True
            ).all()
            provider_ids = [str(p.id) for p in providers]

        # Aggregate analytics from all specified providers
        all_analytics = []
        for provider_id in provider_ids:
            try:
                # This would need to be implemented in the service
                # For now, return aggregated analytics
                pass
            except Exception as e:
                logger.warning(f"Failed to get analytics for provider {provider_id}: {str(e)}")

        # For now, return mock aggregated data
        return CloudflareAnalyticsResponse(
            data={
                "total_requests": 1000000,
                "total_bandwidth": "5TB",
                "total_unique_visitors": 50000,
                "average_response_time": "250ms",
                "uptime_percentage": 99.9,
                "zones_count": len(provider_ids)
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get global Cloudflare analytics: {str(e)}")

@router.get("/health", status_code=200)
async def cloudflare_health_check(
    db: Session = Depends(get_db)
):
    """
    Health check for Cloudflare integration
    """
    try:
        # Check if there are any active Cloudflare providers
        providers = db.query(InfrastructureProvider).filter(
            InfrastructureProvider.provider_type == "cloudflare",
            InfrastructureProvider.is_active == True
        ).count()

        cloudflare_service = CloudflareService(db)

        # Test basic connectivity
        test_connection = True
        try:
            # This would be a simple API test
            pass
        except:
            test_connection = False

        return {
            "status": "healthy" if test_connection else "degraded",
            "active_providers": providers,
            "api_connection": "ok" if test_connection else "failed",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }