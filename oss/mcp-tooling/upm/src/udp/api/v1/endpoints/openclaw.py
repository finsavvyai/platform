"""OpenClaw API endpoints."""

import json
import shutil
import tempfile
from dataclasses import asdict, is_dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from udp.ecosystems.openclaw import OpenClawAdapter
from udp.security.auth import get_current_user
from udp.services.openclaw_policy_enforcer import OpenClawPolicyEnforcer
from udp.services.openclaw_scanner import MarketplaceMonitor, OpenClawScanner

router = APIRouter()


class SkillScanRequest(BaseModel):
    """Request payload for OpenClaw skill scanning."""

    skill_url: Optional[str] = Field(
        default=None, description="URL to skill repository or ClawHub page"
    )
    skill_path: Optional[str] = Field(
        default=None, description="Local path to skill directory"
    )
    depth: int = Field(default=3, ge=1, le=5)
    include_code_scan: bool = True
    check_policies: bool = True


class SkillValidationRequest(BaseModel):
    """Request payload for OpenClaw manifest validation."""

    manifest: dict[str, Any]


class MarketplaceMonitorRequest(BaseModel):
    """Request payload for marketplace monitoring."""

    skills: list[str]
    interval_seconds: int = Field(default=300, ge=30)
    webhook_url: Optional[str] = None


class SkillHashRequest(BaseModel):
    """Hash lookup request payload."""

    file_hash: str


class BatchScanRequest(BaseModel):
    """Batch scan request payload."""

    skill_urls: list[str]


def _to_dict(item: Any) -> dict[str, Any]:
    """Serialize a result item from dataclass/pydantic/object into a dict."""
    if is_dataclass(item):
        return asdict(item)
    if hasattr(item, "model_dump"):
        return item.model_dump()
    if hasattr(item, "dict"):
        return item.dict()
    if isinstance(item, dict):
        return item
    if hasattr(item, "__dict__"):
        return {
            k: v for k, v in vars(item).items() if not k.startswith("_")
        }
    return {"value": str(item)}


def _scan_response(result: Any) -> dict[str, Any]:
    """Normalize scanner result object for API responses."""
    return {
        "skill_id": result.skill_id,
        "skill_name": result.skill_name,
        "version": result.version,
        "scanned_at": result.scanned_at,
        "dependencies": [_to_dict(dep) for dep in result.dependencies],
        "vulnerabilities": [_to_dict(vuln) for vuln in result.vulnerabilities],
        "policy_violations": [_to_dict(v) for v in result.policy_violations],
        "security_issues": [_to_dict(issue) for issue in result.security_issues],
        "risk_score": result.risk_score,
        "recommendations": result.recommendations,
    }


@router.post("/skills/scan")
async def scan_openclaw_skill(
    request: SkillScanRequest,
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Scan an OpenClaw skill from local path or repository URL."""
    scanner = OpenClawScanner()

    skill_path = request.skill_path
    downloaded_path: Optional[str] = None

    if request.skill_url and not skill_path:
        downloaded_path = await scanner._download_skill(request.skill_url)
        skill_path = downloaded_path

    if not skill_path:
        raise HTTPException(
            status_code=400,
            detail="Either skill_url or skill_path must be provided",
        )

    try:
        result = await scanner.scan_skill(
            skill_path=skill_path,
            depth=request.depth,
            scan_code=request.include_code_scan,
            check_policies=request.check_policies,
        )
        return _scan_response(result)
    finally:
        if downloaded_path:
            shutil.rmtree(downloaded_path, ignore_errors=True)


@router.post("/skills/upload/scan")
async def upload_and_scan_skill(
    file: UploadFile = File(...),
    depth: int = 3,
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Upload a ZIP skill package and scan it."""
    scanner = OpenClawScanner()
    temp_dir = tempfile.mkdtemp(prefix="upm_openclaw_scan_")

    try:
        file_path = Path(temp_dir) / (file.filename or "skill.zip")
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        if str(file_path).endswith(".zip"):
            import zipfile

            with zipfile.ZipFile(file_path, "r") as zip_ref:
                zip_ref.extractall(temp_dir)

        result = await scanner.scan_skill(
            skill_path=temp_dir,
            depth=depth,
            scan_code=True,
            check_policies=True,
        )
        return _scan_response(result)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.get("/skills/{skill_id}/sbom")
async def get_skill_sbom(
    skill_id: str,
    format: str = "cyclonedx",
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Generate SBOM for a local OpenClaw skill path."""
    skill_path = Path(skill_id)
    if not skill_path.exists():
        raise HTTPException(status_code=404, detail="Skill path not found")

    adapter = OpenClawAdapter()
    sbom = await adapter.generate_skill_sbom(skill_path=str(skill_path), format=format)
    return sbom


@router.post("/skills/validate")
async def validate_skill_manifest(
    request: SkillValidationRequest,
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Validate OpenClaw manifest data against configured policies."""
    enforcer = OpenClawPolicyEnforcer()
    temp_dir = tempfile.mkdtemp(prefix="upm_openclaw_validate_")

    try:
        import yaml

        manifest_path = Path(temp_dir) / "skill.yaml"
        with open(manifest_path, "w") as f:
            yaml.safe_dump(request.manifest, f)

        violations = await enforcer.validate_skill(
            skill_path=temp_dir,
            manifest=request.manifest,
        )

        critical = [v for v in violations if v.severity == "critical"]
        high = [v for v in violations if v.severity == "high"]

        status = "passed"
        if critical:
            status = "blocked"
        elif high:
            status = "warning"

        return {
            "status": status,
            "violations": [_to_dict(v) for v in violations],
            "summary": {
                "total_violations": len(violations),
                "critical": len(critical),
                "high": len(high),
                "medium": len([v for v in violations if v.severity == "medium"]),
                "low": len([v for v in violations if v.severity == "low"]),
            },
        }
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.get("/skills/{skill_id}/compliance")
async def get_skill_compliance(
    skill_id: str,
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Get OpenClaw compliance report for a skill path."""
    enforcer = OpenClawPolicyEnforcer()
    if not Path(skill_id).exists():
        raise HTTPException(status_code=404, detail="Skill path not found")
    return await enforcer.get_compliance_report(skill_id)


@router.post("/marketplace/monitor")
async def monitor_marketplace(
    request: MarketplaceMonitorRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Start background monitoring of a skill list."""
    monitor = MarketplaceMonitor()
    monitor_id = f"monitor_{int(datetime.utcnow().timestamp())}"

    background_tasks.add_task(
        monitor.monitor_skills,
        request.skills,
        request.interval_seconds,
        request.webhook_url,
    )

    return {
        "monitor_id": monitor_id,
        "status": "started",
        "skills_count": len(request.skills),
        "interval_seconds": request.interval_seconds,
    }


@router.post("/skills/check-hash")
async def check_skill_hash(
    request: SkillHashRequest,
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Check whether a hash matches known malicious OpenClaw samples."""
    known_malicious: dict[str, str] = {}
    file_hash = request.file_hash.lower()

    is_malicious = file_hash in known_malicious
    return {
        "hash": file_hash,
        "is_malicious": is_malicious,
        "known_threat": known_malicious.get(file_hash) if is_malicious else None,
        "checked_at": datetime.utcnow().isoformat(),
    }


@router.get("/policies")
async def list_policies(current_user=Depends(get_current_user)) -> list[dict[str, Any]]:
    """List all OpenClaw security policies."""
    enforcer = OpenClawPolicyEnforcer()
    return enforcer.list_policies()


@router.put("/policies/{policy_id}/enable")
async def enable_policy(
    policy_id: str,
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Enable one OpenClaw policy."""
    enforcer = OpenClawPolicyEnforcer()
    if not enforcer.enable_policy(policy_id):
        raise HTTPException(status_code=404, detail="Policy not found")
    return {"policy_id": policy_id, "enabled": True}


@router.put("/policies/{policy_id}/disable")
async def disable_policy(
    policy_id: str,
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Disable one OpenClaw policy."""
    enforcer = OpenClawPolicyEnforcer()
    if not enforcer.disable_policy(policy_id):
        raise HTTPException(status_code=404, detail="Policy not found")
    return {"policy_id": policy_id, "enabled": False}


@router.post("/scan/batch")
async def batch_scan_skills(
    request: BatchScanRequest,
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Run batch scan for multiple skill URLs."""
    scanner = OpenClawScanner()
    results = await scanner.batch_scan(request.skill_urls)
    return {
        "total_requested": len(request.skill_urls),
        "total_scanned": len(results),
        "results": [_scan_response(result) for result in results],
    }


@router.post("/export/report")
async def export_compliance_report(
    skill_ids: list[str],
    current_user=Depends(get_current_user),
) -> StreamingResponse:
    """Export compliance report for provided skill paths."""
    enforcer = OpenClawPolicyEnforcer()

    reports = []
    for skill_id in skill_ids:
        if Path(skill_id).exists():
            reports.append(await enforcer.get_compliance_report(skill_id))

    payload = {
        "generated_at": datetime.utcnow().isoformat(),
        "report_count": len(reports),
        "reports": reports,
    }
    return StreamingResponse(
        iter([json.dumps(payload)]),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=openclaw_report.json"},
    )


@router.get("/stats")
async def get_openclaw_stats(current_user=Depends(get_current_user)) -> dict[str, Any]:
    """Return basic OpenClaw scan/policy stats."""
    policies = OpenClawPolicyEnforcer().list_policies()
    return {
        "total_policies": len(policies),
        "enabled_policies": len([p for p in policies if p.get("enabled")]),
        "disabled_policies": len([p for p in policies if not p.get("enabled")]),
        "last_scan": None,
    }
