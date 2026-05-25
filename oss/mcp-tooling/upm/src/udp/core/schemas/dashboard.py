"""Schema definitions for security dashboard responses."""

from datetime import datetime
from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel, Field


class TimeRange(str, Enum):
    """Time range options for dashboard data."""

    LAST_7_DAYS = "last_7_days"
    LAST_30_DAYS = "last_30_days"
    LAST_90_DAYS = "last_90_days"
    LAST_6_MONTHS = "last_6_months"
    LAST_YEAR = "last_year"


class SeverityLevel(str, Enum):
    """Vulnerability severity levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ComplianceFramework(str, Enum):
    """Compliance framework options."""

    SOX = "sox"
    HIPAA = "hipaa"
    PCI_DSS = "pci_dss"
    GDPR = "gdpr"
    SOC2 = "soc2"
    ISO27001 = "iso27001"


class DashboardFilters(BaseModel):
    """Filters for dashboard data."""

    severity_levels: Optional[List[SeverityLevel]] = None
    compliance_frameworks: Optional[List[ComplianceFramework]] = None
    project_ids: Optional[List[str]] = None
    min_risk_score: Optional[float] = Field(None, ge=0.0, le=10.0)
    max_risk_score: Optional[float] = Field(None, ge=0.0, le=10.0)
    status: Optional[List[str]] = None
    tags: Optional[List[str]] = None


class VulnerabilityTrend(BaseModel):
    """Vulnerability trend data point."""

    date: str
    critical: int
    high: int
    medium: int
    low: int
    total: int


class ComplianceOverview(BaseModel):
    """Compliance status overview."""

    total_projects: int
    compliant_projects: int
    non_compliant_projects: int
    overall_compliance_score: float = Field(..., ge=0.0, le=1.0)
    framework_scores: Dict[str, float]


class RiskMetrics(BaseModel):
    """Risk metrics and indicators."""

    average_risk_score: float = Field(..., ge=0.0, le=10.0)
    max_risk_score: float = Field(..., ge=0.0, le=10.0)
    critical_risk_count: int
    high_risk_count: int
    critical_risk_percentage: float = Field(..., ge=0.0, le=100.0)
    high_risk_percentage: float = Field(..., ge=0.0, le=100.0)
    risk_trend_percentage: float  # Can be negative for improvement
    total_vulnerabilities: int


class SecurityKPI(BaseModel):
    """Security Key Performance Indicators."""

    mean_time_to_remediate_hours: float
    vulnerability_detection_rate: float = Field(..., ge=0.0, le=100.0)
    security_coverage_percentage: float = Field(..., ge=0.0, le=100.0)
    false_positive_rate: float = Field(..., ge=0.0, le=100.0)
    automated_remediation_rate: float = Field(..., ge=0.0, le=100.0)
    security_score: float = Field(..., ge=0.0, le=100.0)


class CriticalVulnerability(BaseModel):
    """Critical vulnerability requiring attention."""

    id: str
    vulnerability_id: str
    title: str
    severity: SeverityLevel
    risk_score: float = Field(..., ge=0.0, le=10.0)
    project_name: str
    project_id: str
    package_name: str
    package_version: str
    status: str
    detected_at: str
    description: Optional[str] = None


class PolicyViolation(BaseModel):
    """Policy violation information."""

    id: str
    policy_name: str
    severity: SeverityLevel
    description: str
    project_name: str
    project_id: str
    created_at: str
    status: str


class ProjectSecurityScore(BaseModel):
    """Project security score and metrics."""

    project_id: str
    project_name: str
    security_score: float = Field(..., ge=0.0, le=100.0)
    vulnerability_count: int
    average_risk_score: float = Field(..., ge=0.0, le=10.0)
    remediation_rate: float = Field(..., ge=0.0, le=100.0)
    last_scan: Optional[str] = None


class RemediationProgress(BaseModel):
    """Remediation progress metrics."""

    vulnerabilities_created: int
    vulnerabilities_remediated: int
    open_vulnerabilities: int
    remediation_rate_percent: float = Field(..., ge=0.0, le=100.0)
    remediation_velocity_per_week: float
    estimated_weeks_to_clear: Optional[float] = None


class SecurityDashboardResponse(BaseModel):
    """Complete security dashboard response."""

    vulnerability_trends: List[VulnerabilityTrend]
    compliance_overview: ComplianceOverview
    risk_metrics: RiskMetrics
    security_kpis: SecurityKPI
    critical_vulnerabilities: List[Dict[str, Any]]
    policy_violations_summary: Dict[str, Any]
    project_security_scores: List[Dict[str, Any]]
    vulnerability_severity_distribution: Dict[str, int]
    remediation_progress: Dict[str, Any]
    generated_at: datetime
    time_range: TimeRange
    filters: DashboardFilters


class DashboardWidget(BaseModel):
    """Dashboard widget configuration."""

    id: str
    title: str
    widget_type: str
    position_x: int
    position_y: int
    width: int
    height: int
    config: Dict[str, Any] = {}
    enabled: bool = True


class DashboardLayout(BaseModel):
    """Dashboard layout configuration."""

    id: str
    name: str
    description: Optional[str] = None
    widgets: List[DashboardWidget]
    is_default: bool = False
    created_by: str
    created_at: datetime
    updated_at: datetime


class SecurityAlert(BaseModel):
    """Security alert for real-time notifications."""

    id: str
    alert_type: str
    severity: SeverityLevel
    title: str
    message: str
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    vulnerability_id: Optional[str] = None
    action_required: bool = False
    created_at: datetime
    metadata: Dict[str, Any] = {}


class HeatmapData(BaseModel):
    """Data for risk heatmap visualization."""

    x_axis: List[str]  # e.g., project names
    y_axis: List[str]  # e.g., risk categories
    data: List[List[float]]  # Risk scores matrix
    metadata: Dict[str, Any] = {}


class ComplianceReportSummary(BaseModel):
    """Summary of compliance report."""

    framework: ComplianceFramework
    overall_score: float = Field(..., ge=0.0, le=100.0)
    compliant_controls: int
    total_controls: int
    last_updated: datetime
    exceptions: List[Dict[str, Any]] = []


class SecurityMetricsHistory(BaseModel):
    """Historical security metrics data."""

    date: str
    metrics: Dict[str, float]
    annotations: List[Dict[str, Any]] = []


class DashboardExport(BaseModel):
    """Dashboard export configuration."""

    format: str = Field(..., regex="^(pdf|csv|json)$")
    time_range: TimeRange
    filters: Optional[DashboardFilters] = None
    include_charts: bool = True
    include_raw_data: bool = False


class DashboardShare(BaseModel):
    """Dashboard sharing configuration."""

    dashboard_id: str
    share_type: str = Field(..., regex="^(public|internal|restricted)$")
    recipients: List[str] = []
    expires_at: Optional[datetime] = None
    permissions: List[str] = ["view"]
