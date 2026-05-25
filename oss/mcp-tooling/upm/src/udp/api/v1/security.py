"""
API endpoints for AI Security Service - Risk-Based Vulnerability Prioritization
"""

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user, require_permission
from ..core.database import get_async_session
from ..core.models import User
from ..services.ai_security import (
    PrioritizationMethod,
    RiskTrend,
    VulnerabilityPrioritizer,
)

router = APIRouter(prefix="/api/v1/security", tags=["security"])

# Global prioritizer instance
prioritizer = VulnerabilityPrioritizer()


@router.on_event("startup")
async def startup_event():
    """Initialize the security service."""
    await prioritizer.initialize()


@router.get(
    "/projects/{project_id}/vulnerabilities/prioritize",
    response_model=list[dict[str, Any]],
    summary="Prioritize vulnerabilities for a project",
    description="Get AI-driven vulnerability prioritization for a project",
)
async def prioritize_vulnerabilities(
    project_id: str = Path(..., description="Project ID"),
    vulnerability_ids: Optional[str] = Query(
        None, description="Comma-separated list of vulnerability IDs to prioritize"
    ),
    method: PrioritizationMethod = Query(
        PrioritizationMethod.HYBRID, description="Prioritization method"
    ),
    include_predictions: bool = Query(
        True, description="Include AI predictions in prioritization"
    ),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Prioritize vulnerabilities for a project."""
    try:
        # Check permissions
        require_permission("project:read", current_user)

        # Parse vulnerability IDs if provided
        vuln_ids = None
        if vulnerability_ids:
            vuln_ids = [v.strip() for v in vulnerability_ids.split(",") if v.strip()]

        # Get prioritized vulnerabilities
        priorities = await prioritizer.prioritize_vulnerabilities(
            project_id=project_id,
            vulnerability_ids=vuln_ids,
            method=method,
            include_predictions=include_predictions,
        )

        # Apply limit
        if limit and len(priorities) > limit:
            priorities = priorities[:limit]

        # Convert to response format
        response = []
        for priority in priorities:
            response.append(
                {
                    "vulnerability_id": priority.vulnerability_id,
                    "project_id": priority.project_id,
                    "priority_score": priority.priority_score,
                    "risk_tier": priority.risk_tier,
                    "urgency_days": priority.urgency.days,
                    "component_scores": {
                        "cvss_score": priority.cvss_score,
                        "contextual_score": priority.contextual_score,
                        "threat_intelligence_score": priority.threat_intelligence_score,
                        "ai_prediction_score": priority.ai_prediction_score,
                    },
                    "risk_factors": {
                        "exploitability": priority.exploitability,
                        "business_impact": priority.business_impact,
                        "exposure_level": priority.exposure_level,
                        "compliance_impact": priority.compliance_impact,
                    },
                    "temporal_factors": {
                        "time_to_exploitation_days": priority.time_to_exploitation.days,
                        "risk_trend": priority.risk_trend,
                        "trend_confidence": priority.trend_confidence,
                    },
                    "metadata": {
                        "prioritization_method": priority.prioritization_method,
                        "confidence": priority.confidence,
                        "recommended_actions": priority.recommended_actions,
                        "alternative_packages": priority.alternative_packages,
                        "last_updated": priority.last_updated.isoformat(),
                    },
                }
            )

        return response

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to prioritize vulnerabilities: {str(e)}",
        )


@router.get(
    "/projects/{project_id}/vulnerabilities/{vulnerability_id}/risk-analysis",
    response_model=dict[str, Any],
    summary="Get detailed risk analysis for a vulnerability",
    description="Get comprehensive risk analysis including trend predictions",
)
async def get_vulnerability_risk_analysis(
    project_id: str = Path(..., description="Project ID"),
    vulnerability_id: str = Path(..., description="Vulnerability ID"),
    include_predictions: bool = Query(
        True, description="Include future risk predictions"
    ),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Get detailed risk analysis for a specific vulnerability."""
    try:
        # Check permissions
        require_permission("project:read", current_user)

        # Get prioritized vulnerability
        priorities = await prioritizer.prioritize_vulnerabilities(
            project_id=project_id,
            vulnerability_ids=[vulnerability_id],
            method=PrioritizationMethod.HYBRID,
            include_predictions=include_predictions,
        )

        if not priorities:
            raise HTTPException(
                status_code=404,
                detail=f"Vulnerability {vulnerability_id} not found in project {project_id}",
            )

        priority = priorities[0]

        # Get detailed analysis
        analysis = {
            "vulnerability": {
                "id": priority.vulnerability_id,
                "project_id": priority.project_id,
                "priority_score": priority.priority_score,
                "risk_tier": priority.risk_tier,
                "urgency": {
                    "days": priority.urgency.days,
                    "human_readable": f"{priority.urgency.days} days",
                },
            },
            "scores": {
                "overall": priority.priority_score,
                "cvss": priority.cvss_score,
                "contextual": priority.contextual_score,
                "threat_intelligence": priority.threat_intelligence_score,
                "ai_prediction": priority.ai_prediction_score,
            },
            "risk_factors": {
                "exploitability": {
                    "score": priority.exploitability,
                    "level": "high"
                    if priority.exploitability > 0.7
                    else "medium"
                    if priority.exploitability > 0.3
                    else "low",
                },
                "business_impact": {
                    "score": priority.business_impact,
                    "level": "high"
                    if priority.business_impact > 0.7
                    else "medium"
                    if priority.business_impact > 0.3
                    else "low",
                },
                "exposure": {
                    "score": priority.exposure_level,
                    "level": "high"
                    if priority.exposure_level > 0.7
                    else "medium"
                    if priority.exposure_level > 0.3
                    else "low",
                },
                "compliance": {
                    "score": priority.compliance_impact,
                    "level": "high"
                    if priority.compliance_impact > 0.7
                    else "medium"
                    if priority.compliance_impact > 0.3
                    else "low",
                },
            },
            "timeline": {
                "time_to_exploitation": {
                    "days": priority.time_to_exploitation.days,
                    "probability": priority.exploitability,
                },
                "trend": {
                    "direction": priority.risk_trend,
                    "confidence": priority.trend_confidence,
                    "interpretation": _interpret_trend(
                        priority.risk_trend, priority.trend_confidence
                    ),
                },
            },
            "recommendations": {
                "immediate_actions": priority.recommended_actions[:3],
                "follow_up_actions": priority.recommended_actions[3:],
                "alternative_packages": priority.alternative_packages,
            },
            "metadata": {
                "prioritization_method": priority.prioritization_method,
                "confidence_score": priority.confidence,
                "confidence_level": "high"
                if priority.confidence > 0.7
                else "medium"
                if priority.confidence > 0.5
                else "low",
                "last_assessed": priority.last_updated.isoformat(),
            },
        }

        # Add predictions if requested
        if include_predictions:
            # Mock future predictions
            analysis["predictions"] = {
                "risk_projection": {
                    "7_days": {
                        "predicted_score": priority.priority_score * 1.05,
                        "confidence_interval": [
                            priority.priority_score * 0.95,
                            priority.priority_score * 1.15,
                        ],
                    },
                    "30_days": {
                        "predicted_score": priority.priority_score * 1.15,
                        "confidence_interval": [
                            priority.priority_score * 0.90,
                            priority.priority_score * 1.40,
                        ],
                    },
                    "90_days": {
                        "predicted_score": priority.priority_score * 1.25,
                        "confidence_interval": [
                            priority.priority_score * 0.85,
                            priority.priority_score * 1.65,
                        ],
                    },
                },
                "exploitation_probability": {
                    "current": priority.exploitability,
                    "30_days": min(1.0, priority.exploitability * 1.2),
                    "90_days": min(1.0, priority.exploitability * 1.5),
                },
            }

        return analysis

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get risk analysis: {str(e)}",
        )


@router.get(
    "/projects/{project_id}/risk-dashboard",
    response_model=dict[str, Any],
    summary="Get risk dashboard for a project",
    description="Get comprehensive risk dashboard with trends and statistics",
)
async def get_risk_dashboard(
    project_id: str = Path(..., description="Project ID"),
    time_range_days: int = Query(30, ge=1, le=365, description="Time range in days"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Get risk dashboard for a project."""
    try:
        # Check permissions
        require_permission("project:read", current_user)

        # Get all prioritized vulnerabilities
        priorities = await prioritizer.prioritize_vulnerabilities(
            project_id=project_id,
            method=PrioritizationMethod.HYBRID,
            include_predictions=True,
        )

        # Calculate dashboard statistics
        total_vulnerabilities = len(priorities)
        critical_count = len([p for p in priorities if p.risk_tier == "critical"])
        high_count = len([p for p in priorities if p.risk_tier == "high"])
        medium_count = len([p for p in priorities if p.risk_tier == "medium"])
        low_count = len([p for p in priorities if p.risk_tier == "low"])

        # Calculate average scores
        avg_priority_score = (
            sum(p.priority_score for p in priorities) / total_vulnerabilities
            if total_vulnerabilities > 0
            else 0
        )
        avg_cvss_score = (
            sum(p.cvss_score for p in priorities) / total_vulnerabilities
            if total_vulnerabilities > 0
            else 0
        )

        # Risk trend analysis
        trends = {}
        for trend in RiskTrend:
            count = len([p for p in priorities if p.risk_trend == trend])
            trends[trend.value] = {
                "count": count,
                "percentage": (count / total_vulnerabilities * 100)
                if total_vulnerabilities > 0
                else 0,
            }

        # Urgency distribution
        urgency_buckets = {
            "immediate": len([p for p in priorities if p.urgency.days <= 1]),
            "1-7_days": len([p for p in priorities if 1 < p.urgency.days <= 7]),
            "8-30_days": len([p for p in priorities if 7 < p.urgency.days <= 30]),
            "30+_days": len([p for p in priorities if p.urgency.days > 30]),
        }

        # Top critical vulnerabilities
        top_critical = sorted(
            [p for p in priorities if p.risk_tier in ["critical", "high"]],
            key=lambda p: p.priority_score,
            reverse=True,
        )[:10]

        # Build dashboard response
        dashboard = {
            "summary": {
                "total_vulnerabilities": total_vulnerabilities,
                "risk_distribution": {
                    "critical": critical_count,
                    "high": high_count,
                    "medium": medium_count,
                    "low": low_count,
                },
                "average_scores": {
                    "priority_score": round(avg_priority_score, 2),
                    "cvss_score": round(avg_cvss_score, 2),
                },
                "risk_trend_distribution": trends,
                "urgency_distribution": urgency_buckets,
            },
            "top_vulnerabilities": [
                {
                    "vulnerability_id": p.vulnerability_id,
                    "priority_score": p.priority_score,
                    "risk_tier": p.risk_tier,
                    "urgency_days": p.urgency.days,
                    "risk_trend": p.risk_trend,
                    "exploitability": p.exploitability,
                }
                for p in top_critical
            ],
            "recommendations": {
                "immediate_actions": [
                    f"Address {critical_count} critical vulnerabilities immediately",
                    "Implement emergency mitigations for high-risk exposures",
                ],
                "short_term_goals": [
                    f"Remediate {high_count} high-risk vulnerabilities within 7 days",
                    "Review and update security controls",
                ],
                "long_term_goals": [
                    "Establish continuous vulnerability monitoring",
                    "Implement automated patch management",
                    "Enhance threat intelligence capabilities",
                ],
            },
            "metadata": {
                "project_id": project_id,
                "time_range_days": time_range_days,
                "generated_at": datetime.utcnow().isoformat(),
            },
        }

        return dashboard

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate risk dashboard: {str(e)}",
        )


@router.post(
    "/projects/{project_id}/vulnerabilities/{vulnerability_id}/acknowledge",
    response_model=dict[str, str],
    summary="Acknowledge a vulnerability",
    description="Acknowledge a vulnerability and update its status",
)
async def acknowledge_vulnerability(
    project_id: str = Path(..., description="Project ID"),
    vulnerability_id: str = Path(..., description="Vulnerability ID"),
    ack_data: dict[str, Any] = ...,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Acknowledge a vulnerability."""
    try:
        # Check permissions
        require_permission("project:write", current_user)

        # Get acknowledgment details
        reason = ack_data.get("reason", "Acknowledged")
        accepted_risk = ack_data.get("accepted_risk", False)
        remediation_plan = ack_data.get("remediation_plan", "")

        # Update vulnerability status in database
        # This would be implemented with proper database operations
        # For now, return success response

        return {
            "status": "success",
            "message": f"Vulnerability {vulnerability_id} acknowledged",
            "acknowledged_by": current_user.email,
            "acknowledged_at": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to acknowledge vulnerability: {str(e)}",
        )


@router.get(
    "/threat-intelligence/summary",
    response_model=dict[str, Any],
    summary="Get threat intelligence summary",
    description="Get summary of current threat landscape",
)
async def get_threat_intelligence_summary(
    limit: int = Query(50, ge=1, le=100, description="Maximum number of threats"),
    current_user: User = Depends(get_current_user),
):
    """Get threat intelligence summary."""
    try:
        # Check permissions
        require_permission("security:read", current_user)

        # Mock threat intelligence summary
        summary = {
            "active_threats": {
                "total": 127,
                "critical": 8,
                "high": 23,
                "medium": 64,
                "low": 32,
            },
            "recent_exploits": [
                {
                    "cve_id": "CVE-2024-0001",
                    "description": "Remote code execution in popular library",
                    "first_seen": "2024-01-15T10:30:00Z",
                    "exploit_maturity": "weaponized",
                    "affected_industries": ["technology", "finance"],
                },
                {
                    "cve_id": "CVE-2024-0002",
                    "description": "SQL injection vulnerability",
                    "first_seen": "2024-01-14T15:45:00Z",
                    "exploit_maturity": "poc",
                    "affected_industries": ["healthcare", "retail"],
                },
            ],
            "threat_actors": [
                {
                    "name": "APT-28",
                    "activity": "high",
                    "targeting": ["government", "defense"],
                    "ttps": ["phishing", "credential stuffing"],
                },
                {
                    "name": "Conti Ransomware",
                    "activity": "medium",
                    "targeting": ["healthcare", "manufacturing"],
                    "ttps": ["ransomware", "data exfiltration"],
                },
            ],
            "trends": {
                "exploit_development": "increasing",
                "ransomware_activity": "stable",
                "supply_chain_attacks": "increasing",
            },
            "metadata": {
                "generated_at": datetime.utcnow().isoformat(),
                "data_sources": ["CISA KEV", "ExploitDB", "Metasploit", "GitHub"],
            },
        }

        return summary

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get threat intelligence summary: {str(e)}",
        )


def _interpret_trend(trend: RiskTrend, confidence: float) -> str:
    """Interpret risk trend for human consumption."""
    if confidence < 0.3:
        return "Insufficient data for trend analysis"

    interpretations = {
        RiskTrend.INCREASING: "Risk is increasing over time - immediate attention recommended",
        RiskTrend.STABLE: "Risk is stable - continue regular monitoring",
        RiskTrend.DECREASING: "Risk is decreasing - maintain current mitigations",
        RiskTrend.UNKNOWN: "Trend cannot be determined at this time",
    }

    return interpretations.get(trend, "Unknown trend")
