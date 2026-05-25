"""
Enhanced pytest configuration and shared fixtures for UDP comprehensive testing.
"""

import os
import pytest
import asyncio
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import AsyncMock, Mock, patch
from typing import AsyncGenerator, Generator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from httpx import AsyncClient

# Ensure required env vars for app settings before importing app
os.environ.setdefault("SECURITY__SECRET_KEY", "x" * 40)
from udp.api.main import app
from udp.core.database import Base, get_async_session
from udp.domain.models import Package, EcosystemType, LicenseType, SecurityLevel
from udp.infrastructure.models import OrganizationModel, PackageModel, VulnerabilityModel
from udp.analytics.engine import AnalyticsMetric, MetricType, TimeInterval
from udp.workflows.state import DependencyAnalysisState, ApprovalWorkflowState


# ============================================================================
# Core Pytest Configuration
# ============================================================================

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ============================================================================
# Database Fixtures
# ============================================================================

@pytest.fixture
async def async_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create an async database session for testing with in-memory SQLite."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False}
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session_factory = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
    
    await engine.dispose()


@pytest.fixture
def mock_db_session() -> AsyncMock:
    """Create a comprehensive mock database session."""
    session = AsyncMock(spec=AsyncSession)
    
    # Configure realistic mock responses
    mock_result = Mock()
    mock_result.fetchall.return_value = []
    mock_result.scalar.return_value = None
    mock_result.scalars.return_value = Mock(all=Mock(return_value=[]))
    
    session.execute.return_value = mock_result
    session.get.return_value = None
    session.add.return_value = None
    session.commit.return_value = None
    session.rollback.return_value = None
    session.close.return_value = None
    session.refresh.return_value = None
    
    return session


@pytest.fixture
async def populated_db_session(async_db_session: AsyncSession) -> AsyncSession:
    """Database session populated with comprehensive test data."""
    # Create organization
    org = OrganizationModel(
        name="Test Organization",
        slug="test-org",
        domain="test.com",
        industry="Technology",
        size="Medium",
        compliance_frameworks=["SOX", "ISO27001"],
        allowed_licenses=["MIT", "Apache-2.0"],
        blocked_licenses=["GPL-3.0"]
    )
    async_db_session.add(org)
    
    # Create packages
    packages_data = [
        ("react", "18.2.0", EcosystemType.NPM, LicenseType.MIT),
        ("django", "4.2.0", EcosystemType.PYPI, LicenseType.BSD_3_CLAUSE),
        ("vulnerable-lib", "1.0.0", EcosystemType.NPM, LicenseType.GPL_3_0)
    ]
    
    for name, version, ecosystem, license_type in packages_data:
        package = PackageModel(
            name=name,
            version=version,
            ecosystem=ecosystem,
            license=license_type,
            description=f"Test package {name}"
        )
        async_db_session.add(package)
    
    # Create vulnerabilities
    vuln = VulnerabilityModel(
        cve_id="CVE-2023-TEST",
        advisory_id="GHSA-test-001",
        title="Test Critical Vulnerability",
        description="A critical test vulnerability",
        severity=SecurityLevel.CRITICAL,
        cvss_score=9.8,
        affected_versions=["1.0.0"],
        fixed_versions=["1.0.1"],
        source="Test Source",
        published_at=datetime.utcnow(),
        exploit_available=True,
        patch_available=True
    )
    async_db_session.add(vuln)
    
    await async_db_session.commit()
    return async_db_session


# ============================================================================
# Domain Model Fixtures
# ============================================================================

@pytest.fixture
def sample_organization() -> Mock:
    """Create a comprehensive sample organization."""
    org = Mock(spec=OrganizationModel)
    org.id = uuid4()
    org.name = "Acme Corporation"
    org.slug = "acme-corp"
    org.domain = "acme.com"
    org.industry = "Technology"
    org.size = "Enterprise"
    org.country = "US"
    org.compliance_frameworks = ["SOX", "ISO27001", "NIST"]
    org.allowed_licenses = ["MIT", "Apache-2.0", "BSD-3-Clause"]
    org.blocked_licenses = ["GPL-3.0", "AGPL-3.0", "SSPL-1.0"]
    org.max_vulnerability_score = 7.0
    org.auto_update_enabled = False
    org.require_approval = True
    org.notification_emails = ["security@acme.com", "devops@acme.com"]
    org.settings = {
        "security_scan_enabled": True,
        "license_check_enabled": True,
        "auto_merge_low_risk": False
    }
    org.created_at = datetime.utcnow()
    org.updated_at = None
    org.is_deleted = False
    
    return org


@pytest.fixture
def sample_packages() -> list[Package]:
    """Create diverse sample packages for comprehensive testing."""
    return [
        Package(
            name="react",
            version="18.2.0",
            ecosystem=EcosystemType.NPM,
            license=LicenseType.MIT,
            description="A JavaScript library for building user interfaces",
            author="Meta",
            homepage="https://reactjs.org",
            repository_url="https://github.com/facebook/react"
        ),
        Package(
            name="django",
            version="4.2.5",
            ecosystem=EcosystemType.PYPI,
            license=LicenseType.BSD_3_CLAUSE,
            description="A high-level Python web framework",
            author="Django Software Foundation",
            homepage="https://www.djangoproject.com"
        ),
        Package(
            name="spring-boot-starter",
            version="3.1.0",
            ecosystem=EcosystemType.MAVEN,
            license=LicenseType.APACHE_2_0,
            namespace="org.springframework.boot",
            description="Spring Boot Starter",
            author="Pivotal Software"
        ),
        Package(
            name="vulnerable-package",
            version="1.0.0",
            ecosystem=EcosystemType.NPM,
            license=LicenseType.GPL_3_0,
            description="A package with vulnerabilities for testing",
            author="Test Author"
        ),
        Package(
            name="express",
            version="4.18.2",
            ecosystem=EcosystemType.NPM,
            license=LicenseType.MIT,
            description="Fast web framework for Node.js",
            author="TJ Holowaychuk"
        )
    ]


@pytest.fixture
def sample_vulnerabilities() -> list[dict]:
    """Create comprehensive vulnerability test data."""
    return [
        {
            "cve_id": "CVE-2023-1001",
            "advisory_id": "GHSA-test-001",
            "title": "Remote Code Execution",
            "description": "Critical RCE vulnerability in authentication module",
            "severity": SecurityLevel.CRITICAL,
            "cvss_score": 9.8,
            "affected_versions": ["1.0.0", "1.1.0"],
            "fixed_versions": ["1.2.0"],
            "source": "GitHub Security Advisory",
            "published_at": datetime.utcnow(),
            "exploit_available": True,
            "patch_available": True,
            "cwe_ids": ["CWE-78", "CWE-94"],
            "references": [
                "https://github.com/advisories/GHSA-test-001",
                "https://nvd.nist.gov/vuln/detail/CVE-2023-1001"
            ]
        },
        {
            "cve_id": "CVE-2023-2001",
            "advisory_id": "GHSA-test-002",
            "title": "Cross-Site Scripting (XSS)",
            "description": "Reflected XSS in user input validation",
            "severity": SecurityLevel.HIGH,
            "cvss_score": 7.5,
            "affected_versions": ["2.0.0"],
            "fixed_versions": ["2.0.1"],
            "source": "NVD",
            "published_at": datetime.utcnow() - timedelta(days=5),
            "exploit_available": False,
            "patch_available": True,
            "cwe_ids": ["CWE-79"],
            "references": ["https://nvd.nist.gov/vuln/detail/CVE-2023-2001"]
        },
        {
            "cve_id": "CVE-2023-3001",
            "advisory_id": "GHSA-test-003",
            "title": "Information Disclosure",
            "description": "Sensitive information exposed in error messages",
            "severity": SecurityLevel.MEDIUM,
            "cvss_score": 5.3,
            "affected_versions": ["3.0.0"],
            "fixed_versions": ["3.0.1"],
            "source": "MITRE",
            "published_at": datetime.utcnow() - timedelta(days=10),
            "exploit_available": False,
            "patch_available": True,
            "cwe_ids": ["CWE-200"],
            "references": ["https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2023-3001"]
        }
    ]


# ============================================================================
# Analytics Fixtures
# ============================================================================

@pytest.fixture
def comprehensive_analytics_metrics() -> dict[str, AnalyticsMetric]:
    """Create comprehensive analytics metrics for testing."""
    timestamp = datetime.utcnow()
    
    return {
        "critical_vulnerabilities": AnalyticsMetric(
            name="Critical Vulnerabilities",
            value=8.0,
            metric_type=MetricType.COUNT,
            timestamp=timestamp,
            metadata={
                "severity_distribution": {
                    "CRITICAL": 8,
                    "HIGH": 15,
                    "MEDIUM": 32,
                    "LOW": 67
                },
                "time_range": "1M"
            },
            trend_direction="up",
            trend_percentage=12.5
        ),
        "average_cvss_score": AnalyticsMetric(
            name="Average CVSS Score",
            value=6.8,
            metric_type=MetricType.SCORE,
            timestamp=timestamp,
            metadata={"max_score": 10.0, "median_score": 6.2},
            trend_direction="stable",
            trend_percentage=1.2
        ),
        "exploitable_packages": AnalyticsMetric(
            name="Exploitable Packages",
            value=5.0,
            metric_type=MetricType.COUNT,
            timestamp=timestamp,
            metadata={"total_packages": 150},
            trend_direction="down",
            trend_percentage=-8.3
        ),
        "license_distribution": AnalyticsMetric(
            name="License Distribution",
            value=250.0,
            metric_type=MetricType.DISTRIBUTION,
            timestamp=timestamp,
            metadata={
                "distribution": {
                    "MIT": 100,
                    "Apache-2.0": 75,
                    "GPL-3.0": 30,
                    "BSD-3-Clause": 25,
                    "ISC": 20
                },
                "percentages": {
                    "MIT": 40.0,
                    "Apache-2.0": 30.0,
                    "GPL-3.0": 12.0,
                    "BSD-3-Clause": 10.0,
                    "ISC": 8.0
                }
            }
        ),
        "copyleft_percentage": AnalyticsMetric(
            name="Copyleft License Percentage",
            value=18.5,
            metric_type=MetricType.PERCENTAGE,
            timestamp=timestamp,
            metadata={"copyleft_count": 37, "total_count": 200}
        ),
        "enterprise_friendly_percentage": AnalyticsMetric(
            name="Enterprise-Friendly License Percentage",
            value=81.5,
            metric_type=MetricType.PERCENTAGE,
            timestamp=timestamp,
            metadata={"enterprise_count": 163, "total_count": 200}
        ),
        "workflow_completion_rate": AnalyticsMetric(
            name="Workflow Completion Rate",
            value=92.3,
            metric_type=MetricType.PERCENTAGE,
            timestamp=timestamp,
            metadata={
                "total_workflows": 150,
                "completed_workflows": 139,
                "failed_workflows": 6,
                "cancelled_workflows": 5
            }
        ),
        "average_processing_time": AnalyticsMetric(
            name="Average Processing Time",
            value=28.7,
            metric_type=MetricType.RATIO,
            timestamp=timestamp,
            metadata={"seconds": 1722.0, "time_range": "1M"}
        ),
        "pending_approvals": AnalyticsMetric(
            name="Pending Approvals",
            value=7.0,
            metric_type=MetricType.COUNT,
            timestamp=timestamp,
            metadata={"overdue_approvals": 2}
        ),
        "ecosystem_distribution": AnalyticsMetric(
            name="Ecosystem Distribution",
            value=200.0,
            metric_type=MetricType.DISTRIBUTION,
            timestamp=timestamp,
            metadata={
                "distribution": {
                    "npm": 120,
                    "pypi": 50,
                    "maven": 20,
                    "nuget": 10
                },
                "percentages": {
                    "npm": 60.0,
                    "pypi": 25.0,
                    "maven": 10.0,
                    "nuget": 5.0
                }
            }
        )
    }


# ============================================================================
# Workflow State Fixtures
# ============================================================================

@pytest.fixture
def sample_dependency_analysis_state() -> DependencyAnalysisState:
    """Create comprehensive dependency analysis workflow state."""
    return DependencyAnalysisState(
        request_id=f"dep_analysis_{uuid4()}",
        organization_id=uuid4(),
        packages=[
            {
                "name": "react",
                "version": "18.2.0",
                "ecosystem": "npm",
                "license": "MIT"
            },
            {
                "name": "vulnerable-lib", 
                "version": "1.0.0",
                "ecosystem": "npm",
                "license": "GPL-3.0"
            }
        ],
        raw_dependencies=[
            {"name": "react", "version": "18.2.0", "dependencies": {"react-dom": "18.2.0"}},
            {"name": "vulnerable-lib", "version": "1.0.0", "dependencies": {}}
        ],
        resolved_dependencies=[
            {"name": "react", "version": "18.2.0", "resolved": True},
            {"name": "react-dom", "version": "18.2.0", "resolved": True},
            {"name": "vulnerable-lib", "version": "1.0.0", "resolved": True}
        ],
        vulnerabilities=[
            {
                "package": "vulnerable-lib",
                "cve_id": "CVE-2023-TEST",
                "severity": "CRITICAL",
                "cvss_score": 9.8,
                "description": "Critical RCE vulnerability"
            }
        ],
        license_issues=[
            {
                "package": "vulnerable-lib",
                "license": "GPL-3.0",
                "issue_type": "copyleft_conflict",
                "description": "GPL-3.0 license conflicts with proprietary code"
            }
        ],
        policy_violations=[
            {
                "policy_id": "security_001",
                "package": "vulnerable-lib",
                "severity": "HIGH",
                "message": "Critical vulnerability detected",
                "action": "REQUIRE_APPROVAL"
            }
        ],
        risk_assessment={
            "overall_score": 8.5,
            "security_risk": 9.0,
            "license_risk": 7.0,
            "operational_risk": 3.0,
            "risk_level": "HIGH"
        },
        recommendations=[
            {
                "type": "security",
                "priority": "critical",
                "package": "vulnerable-lib",
                "description": "Update to version 1.0.1 to fix critical vulnerability",
                "action": "update_package"
            },
            {
                "type": "license", 
                "priority": "medium",
                "package": "vulnerable-lib",
                "description": "Consider replacing GPL-3.0 licensed package",
                "action": "replace_package"
            }
        ],
        approval_required=True,
        current_step="assess_risk",
        workflow_status="completed",
        error_message=None,
        metadata={
            "scan_duration": 45.2,
            "packages_scanned": 3,
            "vulnerabilities_found": 1,
            "policies_evaluated": 5
        }
    )


@pytest.fixture
def sample_approval_workflow_state() -> ApprovalWorkflowState:
    """Create comprehensive approval workflow state."""
    return ApprovalWorkflowState(
        request_id=f"approval_{uuid4()}",
        organization_id=uuid4(),
        workflow_type="dependency_approval",
        analysis_results={
            "packages": 3,
            "critical_vulnerabilities": 1,
            "high_vulnerabilities": 2,
            "license_issues": 1,
            "policy_violations": 2,
            "overall_risk_score": 8.5
        },
        required_approvals=["security", "legal", "manager"],
        received_approvals=[
            {
                "approver": "security_team",
                "role": "security",
                "decision": "approved",
                "timestamp": datetime.utcnow() - timedelta(hours=2),
                "comments": "Security review completed. Acceptable risk with mitigation."
            }
        ],
        current_approver="legal",
        approval_deadline=datetime.utcnow() + timedelta(hours=22),
        escalation_level=0,
        auto_approval_eligible=False,
        current_step="wait_for_response",
        workflow_status="waiting_for_approval",
        error_message=None,
        metadata={
            "priority": "high",
            "requester": "dev_team",
            "business_justification": "Critical bug fix for production issue"
        }
    )


# ============================================================================
# Mock Service Fixtures
# ============================================================================

@pytest.fixture
def mock_policy_engine():
    """Create comprehensive mock policy engine."""
    with patch('udp.core.policy_engine.policy_engine') as mock_engine:
        # Create detailed mock policies
        mock_policies = {}
        
        # Security policy
        security_policy = Mock()
        security_policy.policy_id = "security_001"
        security_policy.name = "Critical Security Policy"
        security_policy.description = "Policy for critical security vulnerabilities"
        security_policy.policy_type = Mock(value="security")
        security_policy.version = "1.2.0"
        security_policy.enabled = True
        security_policy.priority = 100
        security_policy.applicable_ecosystems = [Mock(value="npm"), Mock(value="pypi")]
        security_policy.action = Mock(value="block")
        security_policy.exceptions = []
        security_policy.compliance_frameworks = ["SOX", "NIST"]
        security_policy.created_at = datetime.utcnow()
        security_policy.updated_at = None
        security_policy.rules = [
            Mock(
                rule_id="sec_rule_001",
                description="Block critical vulnerabilities",
                field="cvss_score",
                operator=Mock(value="greater_than_equal"),
                value=9.0,
                severity="critical",
                message="Critical vulnerability detected"
            )
        ]
        
        # License policy
        license_policy = Mock()
        license_policy.policy_id = "license_001"
        license_policy.name = "License Compliance Policy"
        license_policy.description = "Policy for license compliance"
        license_policy.policy_type = Mock(value="license")
        license_policy.version = "1.0.0"
        license_policy.enabled = True
        license_policy.priority = 80
        license_policy.applicable_ecosystems = [Mock(value="npm"), Mock(value="pypi"), Mock(value="maven")]
        license_policy.action = Mock(value="require_approval")
        license_policy.exceptions = ["internal-tool"]
        license_policy.compliance_frameworks = ["SOX"]
        license_policy.created_at = datetime.utcnow()
        license_policy.rules = [
            Mock(
                rule_id="lic_rule_001",
                description="Require approval for copyleft licenses",
                field="license_type",
                operator=Mock(value="contains"),
                value="GPL",
                severity="medium",
                message="Copyleft license requires legal review"
            )
        ]
        
        mock_policies["security_001"] = security_policy
        mock_policies["license_001"] = license_policy
        
        mock_engine.policies = mock_policies
        mock_engine.evaluate_policies.return_value = {
            "package:react:18.2.0": [
                Mock(
                    policy_id="security_001",
                    policy_name="Critical Security Policy",
                    overall_result=Mock(value="pass"),
                    action=Mock(value="allow"),
                    execution_time_ms=15.2,
                    rule_results=[]
                )
            ],
            "package:vulnerable-lib:1.0.0": [
                Mock(
                    policy_id="security_001",
                    policy_name="Critical Security Policy",
                    overall_result=Mock(value="fail"),
                    action=Mock(value="block"),
                    execution_time_ms=12.8,
                    rule_results=[
                        Mock(
                            rule_id="sec_rule_001",
                            result=Mock(value="fail"),
                            message="Critical vulnerability detected (CVSS: 9.8)",
                            details={"cvss_score": 9.8, "cve_id": "CVE-2023-TEST"}
                        )
                    ]
                )
            ]
        }
        
        yield mock_engine


@pytest.fixture
def mock_analytics_engine():
    """Create comprehensive mock analytics engine."""
    with patch('udp.analytics.engine.analytics_engine') as mock_engine:
        mock_engine.get_security_metrics = AsyncMock()
        mock_engine.get_license_compliance_metrics = AsyncMock()
        mock_engine.get_workflow_performance_metrics = AsyncMock()
        mock_engine.get_ecosystem_insights = AsyncMock()
        mock_engine.generate_executive_dashboard = AsyncMock()
        mock_engine._calculate_risk_score = AsyncMock(return_value=6.8)
        
        yield mock_engine


@pytest.fixture
def mock_report_generator():
    """Create comprehensive mock report generator."""
    with patch('udp.reporting.generators.report_generator') as mock_generator:
        mock_generator.generate_compliance_report = AsyncMock()
        mock_generator.generate_security_report = AsyncMock()
        mock_generator.generate_executive_summary = AsyncMock()
        
        # Configure default return values
        mock_generator.generate_compliance_report.return_value = {
            "report_data": {"report_type": "compliance", "status": "completed"},
            "metadata": {"report_id": "comp_001", "generated_at": datetime.utcnow().isoformat()},
            "generation_summary": {"metrics_analyzed": 10, "recommendations_count": 3}
        }
        
        yield mock_generator


@pytest.fixture
def mock_report_scheduler():
    """Create comprehensive mock report scheduler."""
    with patch('udp.reporting.scheduler.report_scheduler') as mock_scheduler:
        mock_scheduler.schedules = {}
        mock_scheduler.active_jobs = {}
        
        mock_scheduler.create_schedule = AsyncMock()
        mock_scheduler.update_schedule = AsyncMock()
        mock_scheduler.delete_schedule = AsyncMock()
        mock_scheduler.generate_report_now = AsyncMock()
        mock_scheduler.get_schedule_status = AsyncMock()
        mock_scheduler.get_job_status = AsyncMock()
        mock_scheduler.list_schedules = AsyncMock()
        mock_scheduler.run_scheduled_reports = AsyncMock()
        
        # Configure default return values
        mock_scheduler.create_schedule.return_value = f"schedule_{uuid4()}"
        mock_scheduler.generate_report_now.return_value = f"job_{uuid4()}"
        mock_scheduler.update_schedule.return_value = True
        mock_scheduler.delete_schedule.return_value = True
        
        yield mock_scheduler


# ============================================================================
# HTTP Client Fixtures
# ============================================================================

@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Create async HTTP client with dependency overrides."""
    
    async def mock_get_async_session():
        mock_session = AsyncMock(spec=AsyncSession)
        yield mock_session
    
    app.dependency_overrides[get_async_session] = mock_get_async_session
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        try:
            yield client
        finally:
            app.dependency_overrides.clear()


# ============================================================================
# Test Data Generation Fixtures
# ============================================================================

@pytest.fixture
def large_package_dataset():
    """Generate large dataset for performance testing."""
    packages = []
    ecosystems = [EcosystemType.NPM, EcosystemType.PYPI, EcosystemType.MAVEN]
    licenses = [LicenseType.MIT, LicenseType.APACHE_2_0, LicenseType.BSD_3_CLAUSE, LicenseType.GPL_3_0]
    
    for i in range(1000):
        package = Package(
            name=f"test-package-{i}",
            version=f"1.{i % 10}.{i % 5}",
            ecosystem=ecosystems[i % len(ecosystems)],
            license=licenses[i % len(licenses)],
            description=f"Test package {i} for performance testing"
        )
        packages.append(package)
    
    return packages


@pytest.fixture
def vulnerability_dataset():
    """Generate comprehensive vulnerability dataset."""
    vulnerabilities = []
    severities = [SecurityLevel.CRITICAL, SecurityLevel.HIGH, SecurityLevel.MEDIUM, SecurityLevel.LOW]
    
    for i in range(100):
        vuln = {
            "cve_id": f"CVE-2023-{1000 + i}",
            "advisory_id": f"GHSA-test-{i:03d}",
            "title": f"Test Vulnerability {i}",
            "description": f"Test vulnerability {i} for comprehensive testing",
            "severity": severities[i % len(severities)],
            "cvss_score": 4.0 + (i % 6),  # Range 4.0 to 9.0
            "affected_versions": [f"1.{i % 5}.0"],
            "fixed_versions": [f"1.{i % 5 + 1}.0"],
            "source": "Test Source",
            "published_at": datetime.utcnow() - timedelta(days=i % 30),
            "exploit_available": i % 3 == 0,
            "patch_available": i % 2 == 0
        }
        vulnerabilities.append(vuln)
    
    return vulnerabilities


# ============================================================================
# Performance and Load Testing Fixtures
# ============================================================================

@pytest.fixture
def performance_timer():
    """Utility for measuring test execution time."""
    import time
    
    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None
            self.checkpoints = []
        
        def start(self):
            self.start_time = time.perf_counter()
            return self
        
        def checkpoint(self, name: str = None):
            if self.start_time:
                checkpoint_time = time.perf_counter()
                self.checkpoints.append({
                    "name": name or f"checkpoint_{len(self.checkpoints)}",
                    "time": checkpoint_time,
                    "duration": checkpoint_time - self.start_time
                })
        
        def stop(self):
            self.end_time = time.perf_counter()
            return self
        
        @property
        def duration(self):
            if self.start_time and self.end_time:
                return self.end_time - self.start_time
            return None
        
        def summary(self):
            return {
                "total_duration": self.duration,
                "checkpoints": self.checkpoints
            }
    
    return Timer()


@pytest.fixture
def memory_monitor():
    """Utility for monitoring memory usage during tests."""
    import psutil
    import os
    
    class MemoryMonitor:
        def __init__(self):
            self.process = psutil.Process(os.getpid())
            self.initial_memory = None
            self.peak_memory = None
            self.measurements = []
        
        def start(self):
            self.initial_memory = self.process.memory_info().rss / 1024 / 1024  # MB
            self.peak_memory = self.initial_memory
            return self
        
        def measure(self, label: str = None):
            current_memory = self.process.memory_info().rss / 1024 / 1024  # MB
            self.peak_memory = max(self.peak_memory, current_memory)
            self.measurements.append({
                "label": label or f"measurement_{len(self.measurements)}",
                "memory_mb": current_memory,
                "delta_mb": current_memory - self.initial_memory if self.initial_memory else 0
            })
        
        def summary(self):
            return {
                "initial_memory_mb": self.initial_memory,
                "peak_memory_mb": self.peak_memory,
                "memory_increase_mb": self.peak_memory - self.initial_memory if self.initial_memory else 0,
                "measurements": self.measurements
            }
    
    return MemoryMonitor()


# ============================================================================
# Utility Fixtures
# ============================================================================

@pytest.fixture
def temp_yaml_file(tmp_path):
    """Create temporary YAML file for policy testing."""
    yaml_content = """
policies:
  - policy_id: test_policy_001
    name: Test Security Policy
    description: Test policy for comprehensive testing
    policy_type: security
    version: 1.0.0
    enabled: true
    priority: 100
    applicable_ecosystems: [npm, pypi]
    action: warn
    rules:
      - rule_id: test_rule_001
        description: Test vulnerability rule
        field: cvss_score
        operator: greater_than_equal
        value: 7.0
        severity: high
        message: High severity vulnerability detected
    exceptions: []
    compliance_frameworks: [SOX, NIST]
"""
    
    yaml_file = tmp_path / "test_policies.yaml"
    yaml_file.write_text(yaml_content.strip())
    return str(yaml_file)


@pytest.fixture
def sample_report_templates(tmp_path):
    """Create sample report templates for testing."""
    template_dir = tmp_path / "templates"
    template_dir.mkdir()
    
    # Executive summary template
    exec_template = template_dir / "executive_summary.html"
    exec_template.write_text("""
<html>
<head><title>Executive Summary</title></head>
<body>
    <h1>Executive Summary for {{ organization_name }}</h1>
    <p>Generated: {{ generated_at }}</p>
    <p>Risk Score: {{ overall_risk_score }}</p>
</body>
</html>
""".strip())
    
    # Compliance report template  
    compliance_template = template_dir / "compliance_report.html"
    compliance_template.write_text("""
<html>
<head><title>Compliance Report</title></head>
<body>
    <h1>Compliance Report</h1>
    <p>Framework: {{ compliance_framework }}</p>
    <p>Score: {{ compliance_score }}</p>
</body>
</html>
""".strip())
    
    return str(template_dir)


# ============================================================================
# Cleanup and Environment Management
# ============================================================================

@pytest.fixture(autouse=True)
def cleanup_test_environment():
    """Automatically clean up test environment after each test."""
    yield
    
    # Clear caches and global state
    try:
        from udp.analytics.engine import analytics_engine
        if hasattr(analytics_engine, 'metric_cache'):
            analytics_engine.metric_cache.clear()
    except ImportError:
        pass
    
    try:
        from udp.reporting.scheduler import report_scheduler
        if hasattr(report_scheduler, 'schedules'):
            report_scheduler.schedules.clear()
        if hasattr(report_scheduler, 'active_jobs'):
            report_scheduler.active_jobs.clear()
    except ImportError:
        pass
    
    # Clear FastAPI dependency overrides
    app.dependency_overrides.clear()


# ============================================================================
# Pytest Configuration
# ============================================================================

def pytest_configure(config):
    """Configure custom pytest markers."""
    markers = [
        "unit: mark test as unit test",
        "integration: mark test as integration test", 
        "functional: mark test as functional test",
        "performance: mark test as performance test",
        "slow: mark test as slow running",
        "database: mark test as requiring database",
        "network: mark test as requiring network access",
        "security: mark test as security-related",
        "compliance: mark test as compliance-related"
    ]
    
    for marker in markers:
        config.addinivalue_line("markers", marker)


def pytest_collection_modifyitems(config, items):
    """Automatically mark tests based on location and naming."""
    for item in items:
        # Auto-mark by directory
        if "unit" in str(item.fspath):
            item.add_marker(pytest.mark.unit)
        elif "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        elif "functional" in str(item.fspath):
            item.add_marker(pytest.mark.functional)
        
        # Auto-mark by test name patterns
        test_name_lower = item.name.lower()
        
        if any(pattern in test_name_lower for pattern in ["db", "database", "sql"]):
            item.add_marker(pytest.mark.database)
        
        if any(pattern in test_name_lower for pattern in ["slow", "performance", "load", "stress"]):
            item.add_marker(pytest.mark.slow)
        
        if any(pattern in test_name_lower for pattern in ["security", "vulnerability", "exploit"]):
            item.add_marker(pytest.mark.security)
        
        if any(pattern in test_name_lower for pattern in ["compliance", "policy", "audit"]):
            item.add_marker(pytest.mark.compliance)
        
        if any(pattern in test_name_lower for pattern in ["network", "http", "api", "request"]):
            item.add_marker(pytest.mark.network)
