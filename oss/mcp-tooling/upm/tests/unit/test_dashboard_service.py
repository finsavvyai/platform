"""Unit tests for dashboard service."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from src.udp.services.dashboard_service import DashboardService
from src.udp.core.schemas.dashboard import (
    SecurityDashboardResponse,
    DashboardFilters,
    TimeRange,
    VulnerabilityTrend,
    ComplianceOverview,
    RiskMetrics,
    SecurityKPI,
)
from src.udp.core.models import (
    Project,
    ProjectVulnerability,
    Vulnerability,
    PolicyEvaluation,
    ComplianceReport,
)


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = AsyncMock(spec=AsyncSession)
    return session


@pytest.fixture
def dashboard_service(mock_db_session):
    """Create dashboard service instance."""
    return DashboardService(mock_db_session)


@pytest.fixture
def sample_vulnerability_data():
    """Sample vulnerability data for testing."""
    return [
        MagicMock(date=datetime(2024, 1, 1).date(), severity="critical", count=5),
        MagicMock(date=datetime(2024, 1, 1).date(), severity="high", count=10),
        MagicMock(date=datetime(2024, 1, 2).date(), severity="critical", count=3),
    ]


@pytest.fixture
def sample_project_vulnerabilities():
    """Sample project vulnerabilities for testing."""
    return [
        MagicMock(
            id="vuln-1",
            risk_score=8.5,
            status="open",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 2),
        ),
        MagicMock(
            id="vuln-2",
            risk_score=6.2,
            status="remediated",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 3),
        ),
    ]


class TestDashboardService:
    """Test cases for DashboardService."""

    @pytest.mark.asyncio
    async def test_get_security_dashboard_success(
        self, dashboard_service, mock_db_session
    ):
        """Test successful security dashboard generation."""

        # Mock the sub-methods
        dashboard_service._get_vulnerability_trends = AsyncMock(
            return_value=[
                VulnerabilityTrend(
                    date="2024-01-01", critical=5, high=10, medium=20, low=15, total=50
                )
            ]
        )

        dashboard_service._get_compliance_overview = AsyncMock(
            return_value=ComplianceOverview(
                total_projects=10,
                compliant_projects=7,
                non_compliant_projects=3,
                overall_compliance_score=0.85,
                framework_scores={"SOX": 0.9, "HIPAA": 0.8},
            )
        )

        dashboard_service._get_risk_metrics = AsyncMock(
            return_value=RiskMetrics(
                average_risk_score=5.5,
                max_risk_score=9.2,
                critical_risk_count=5,
                high_risk_count=12,
                critical_risk_percentage=10.0,
                high_risk_percentage=24.0,
                risk_trend_percentage=-5.2,
                total_vulnerabilities=50,
            )
        )

        dashboard_service._get_security_kpis = AsyncMock(
            return_value=SecurityKPI(
                mean_time_to_remediate_hours=24.5,
                vulnerability_detection_rate=95.0,
                security_coverage_percentage=88.0,
                false_positive_rate=5.0,
                automated_remediation_rate=15.5,
                security_score=78.5,
            )
        )

        dashboard_service._get_critical_vulnerabilities = AsyncMock(return_value=[])
        dashboard_service._get_policy_violations_summary = AsyncMock(return_value={})
        dashboard_service._get_project_security_scores = AsyncMock(return_value=[])
        dashboard_service._get_vulnerability_severity_distribution = AsyncMock(
            return_value={}
        )
        dashboard_service._get_remediation_progress = AsyncMock(return_value={})

        # Call the method
        result = await dashboard_service.get_security_dashboard(
            organization_id="org-1", time_range=TimeRange.LAST_30_DAYS
        )

        # Assertions
        assert isinstance(result, SecurityDashboardResponse)
        assert result.time_range == TimeRange.LAST_30_DAYS
        assert len(result.vulnerability_trends) == 1
        assert result.vulnerability_trends[0].total == 50
        assert result.compliance_overview.total_projects == 10
        assert result.compliance_overview.overall_compliance_score == 0.85
        assert result.risk_metrics.average_risk_score == 5.5
        assert result.security_kpis.security_score == 78.5

    @pytest.mark.asyncio
    async def test_get_vulnerability_trends(
        self, dashboard_service, sample_vulnerability_data
    ):
        """Test vulnerability trend calculation."""

        # Mock database query result
        mock_result = MagicMock()
        mock_result.all.return_value = sample_vulnerability_data

        mock_execute = AsyncMock()
        mock_execute.return_value = mock_result
        dashboard_service.db_session.execute = mock_execute

        # Call the method
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 2)
        result = await dashboard_service._get_vulnerability_trends(
            organization_id="org-1",
            project_ids=["proj-1"],
            start_date=start_date,
            end_date=end_date,
            filters=DashboardFilters(),
        )

        # Assertions
        assert len(result) == 2  # One for each date
        assert result[0].date == "2024-01-01"
        assert result[0].critical == 5
        assert result[0].high == 10
        assert result[1].date == "2024-01-02"
        assert result[1].critical == 3

    @pytest.mark.asyncio
    async def test_get_compliance_overview(self, dashboard_service):
        """Test compliance overview calculation."""

        # Mock compliance reports
        mock_reports = [
            MagicMock(framework="SOX", overall_score=0.9),
            MagicMock(framework="HIPAA", overall_score=0.8),
            MagicMock(framework="SOX", overall_score=0.85),
        ]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_reports

        mock_execute = AsyncMock()
        mock_execute.return_value = mock_result
        dashboard_service.db_session.execute = mock_execute

        # Call the method
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 31)
        result = await dashboard_service._get_compliance_overview(
            organization_id="org-1",
            project_ids=["proj-1"],
            start_date=start_date,
            end_date=end_date,
            filters=DashboardFilters(),
        )

        # Assertions
        assert isinstance(result, ComplianceOverview)
        assert result.total_projects == 3
        assert result.overall_compliance_score == 0.85  # (0.9 + 0.8 + 0.85) / 3
        assert "SOX" in result.framework_scores
        assert "HIPAA" in result.framework_scores

    @pytest.mark.asyncio
    async def test_get_risk_metrics(self, dashboard_service):
        """Test risk metrics calculation."""

        # Mock database query result
        mock_row = MagicMock()
        mock_row.avg_risk_score = 5.5
        mock_row.max_risk_score = 9.2
        mock_row.critical_risk_count = 5
        mock_row.high_risk_count = 12
        mock_row.total_vulnerabilities = 50

        mock_result = MagicMock()
        mock_result.first.return_value = mock_row

        mock_execute = AsyncMock()
        mock_execute.return_value = mock_result
        dashboard_service.db_session.execute = mock_execute

        # Mock previous period query
        mock_previous_row = MagicMock()
        mock_previous_row.avg_risk_score = 5.8
        mock_previous_result = MagicMock()
        mock_previous_result.first.return_value = mock_previous_row

        # Second execute call for previous period
        dashboard_service.db_session.execute.return_value = mock_previous_result

        # Call the method
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 31)
        result = await dashboard_service._get_risk_metrics(
            organization_id="org-1",
            project_ids=["proj-1"],
            start_date=start_date,
            end_date=end_date,
            filters=DashboardFilters(),
        )

        # Assertions
        assert isinstance(result, RiskMetrics)
        assert result.average_risk_score == 5.5
        assert result.max_risk_score == 9.2
        assert result.critical_risk_count == 5
        assert result.high_risk_count == 12
        assert result.critical_risk_percentage == 10.0  # (5 / 50) * 100
        assert result.high_risk_percentage == 24.0  # (12 / 50) * 100

    @pytest.mark.asyncio
    async def test_get_security_kpis(self, dashboard_service):
        """Test security KPIs calculation."""

        # Mock sub-methods
        dashboard_service._get_mean_time_to_remediate = AsyncMock(return_value=24.5)
        dashboard_service._get_vulnerability_detection_rate = AsyncMock(
            return_value=95.0
        )
        dashboard_service._get_security_coverage_percentage = AsyncMock(
            return_value=88.0
        )
        dashboard_service._get_false_positive_rate = AsyncMock(return_value=5.0)
        dashboard_service._get_automated_remediation_rate = AsyncMock(return_value=15.5)

        # Call the method
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 31)
        result = await dashboard_service._get_security_kpis(
            organization_id="org-1",
            project_ids=["proj-1"],
            start_date=start_date,
            end_date=end_date,
            filters=DashboardFilters(),
        )

        # Assertions
        assert isinstance(result, SecurityKPI)
        assert result.mean_time_to_remediate_hours == 24.5
        assert result.vulnerability_detection_rate == 95.0
        assert result.security_coverage_percentage == 88.0
        assert result.false_positive_rate == 5.0
        assert result.automated_remediation_rate == 15.5
        assert result.security_score > 0

    @pytest.mark.asyncio
    async def test_get_mean_time_to_remediate(self, dashboard_service):
        """Test mean time to remediate calculation."""

        # Mock database query result
        mock_row = MagicMock()
        mock_row.avg_hours = 24.5

        mock_result = MagicMock()
        mock_result.first.return_value = mock_row

        mock_execute = AsyncMock()
        mock_execute.return_value = mock_result
        dashboard_service.db_session.execute = mock_execute

        # Call the method
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 31)
        result = await dashboard_service._get_mean_time_to_remediate(
            organization_id="org-1",
            project_ids=["proj-1"],
            start_date=start_date,
            end_date=end_date,
        )

        # Assertions
        assert result == 24.5

    @pytest.mark.asyncio
    async def test_get_vulnerability_detection_rate(self, dashboard_service):
        """Test vulnerability detection rate calculation."""

        # Mock scanned projects query
        mock_scanned_row = MagicMock()
        mock_scanned_row.scanned_projects = 8

        mock_scanned_result = MagicMock()
        mock_scanned_result.first.return_value = mock_scanned_row

        # Mock total projects query
        mock_total_row = MagicMock()
        mock_total_row.count = 10

        mock_total_result = MagicMock()
        mock_total_result.first.return_value = mock_total_row

        # Setup execute to return different results based on call
        execute_results = [mock_scanned_result, mock_total_result]
        mock_execute = AsyncMock()
        mock_execute.side_effect = execute_results
        dashboard_service.db_session.execute = mock_execute

        # Call the method
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 31)
        result = await dashboard_service._get_vulnerability_detection_rate(
            organization_id="org-1",
            project_ids=["proj-1"],
            start_date=start_date,
            end_date=end_date,
        )

        # Assertions
        assert result == 80.0  # (8 / 10) * 100

    @pytest.mark.asyncio
    async def test_get_critical_vulnerabilities(self, dashboard_service):
        """Test critical vulnerabilities retrieval."""

        # Mock database query result
        mock_rows = [
            MagicMock(
                ProjectVulnerability=MagicMock(
                    id="vuln-1",
                    risk_score=9.0,
                    status="open",
                    package_version="1.0.0",
                    created_at=datetime(2024, 1, 1),
                ),
                Vulnerability=MagicMock(
                    cve_id="CVE-2024-1234",
                    title="Critical vulnerability in package X",
                    severity="critical",
                    description="A critical vulnerability...",
                ),
                Project=MagicMock(id="proj-1", name="Project X"),
            )
        ]

        mock_result = MagicMock()
        mock_result.all.return_value = mock_rows

        mock_execute = AsyncMock()
        mock_execute.return_value = mock_result
        dashboard_service.db_session.execute = mock_execute

        # Call the method
        result = await dashboard_service._get_critical_vulnerabilities(
            organization_id="org-1", project_ids=["proj-1"], filters=DashboardFilters()
        )

        # Assertions
        assert len(result) == 1
        assert result[0]["id"] == "vuln-1"
        assert result[0]["vulnerability_id"] == "CVE-2024-1234"
        assert result[0]["severity"] == "critical"
        assert result[0]["risk_score"] == 9.0
        assert result[0]["project_name"] == "Project X"

    def test_get_start_date(self, dashboard_service):
        """Test start date calculation based on time range."""

        end_date = datetime(2024, 1, 31, 23, 59, 59)

        # Test different time ranges
        last_7_days = dashboard_service._get_start_date(TimeRange.LAST_7_DAYS, end_date)
        assert last_7_days == datetime(2024, 1, 24, 23, 59, 59)

        last_30_days = dashboard_service._get_start_date(
            TimeRange.LAST_30_DAYS, end_date
        )
        assert last_30_days == datetime(2024, 1, 1, 23, 59, 59)

        last_90_days = dashboard_service._get_start_date(
            TimeRange.LAST_90_DAYS, end_date
        )
        assert last_90_days == datetime(2023, 11, 2, 23, 59, 59)

    def test_calculate_overall_security_score(self, dashboard_service):
        """Test overall security score calculation."""

        # Test with sample KPI values
        # MTTR: 24.5h, Detection: 95%, Coverage: 88%, FP: 5%, Auto: 15.5%
        kpi_values = [24.5, 95.0, 88.0, 5.0, 15.5]

        result = dashboard_service._calculate_overall_security_score(kpi_values)

        # Result should be between 0 and 100
        assert 0 <= result <= 100
        assert isinstance(result, float)

    @pytest.mark.asyncio
    async def test_get_remediation_progress(self, dashboard_service):
        """Test remediation progress calculation."""

        # Mock database query results
        mock_created_row = MagicMock()
        mock_created_row.scalar.return_value = 20

        mock_remediated_row = MagicMock()
        mock_remediated_row.scalar.return_value = 15

        mock_open_row = MagicMock()
        mock_open_row.scalar.return_value = 50

        # Setup execute to return different results
        execute_results = [mock_created_row, mock_remediated_row, mock_open_row]
        mock_execute = AsyncMock()
        mock_execute.side_effect = execute_results
        dashboard_service.db_session.execute = mock_execute

        # Call the method
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 31)
        result = await dashboard_service._get_remediation_progress(
            organization_id="org-1",
            project_ids=["proj-1"],
            start_date=start_date,
            end_date=end_date,
            filters=DashboardFilters(),
        )

        # Assertions
        assert result["vulnerabilities_created"] == 20
        assert result["vulnerabilities_remediated"] == 15
        assert result["open_vulnerabilities"] == 50
        assert result["remediation_rate_percent"] == 75.0  # (15 / 20) * 100
        assert result["remediation_velocity_per_week"] > 0


@pytest.mark.asyncio
async def test_dashboard_service_integration():
    """Integration test for dashboard service with real-like data flow."""

    # This would test the full dashboard generation with mocked database
    # but with real service logic

    # Create mock session
    mock_session = AsyncMock(spec=AsyncSession)
    service = DashboardService(mock_session)

    # Mock all the required database calls
    with (
        patch.object(service, "_get_vulnerability_trends") as mock_trends,
        patch.object(service, "_get_compliance_overview") as mock_compliance,
        patch.object(service, "_get_risk_metrics") as mock_risk,
        patch.object(service, "_get_security_kpis") as mock_kpis,
    ):
        # Setup mock return values
        mock_trends.return_value = [
            VulnerabilityTrend(
                date="2024-01-01", critical=5, high=10, medium=20, low=15, total=50
            )
        ]
        mock_compliance.return_value = ComplianceOverview(
            total_projects=10,
            compliant_projects=8,
            non_compliant_projects=2,
            overall_compliance_score=0.85,
            framework_scores={"SOX": 0.9},
        )
        mock_risk.return_value = RiskMetrics(
            average_risk_score=5.0,
            max_risk_score=9.0,
            critical_risk_count=5,
            high_risk_count=10,
            critical_risk_percentage=10.0,
            high_risk_percentage=20.0,
            risk_trend_percentage=-5.0,
            total_vulnerabilities=50,
        )
        mock_kpis.return_value = SecurityKPI(
            mean_time_to_remediate_hours=24.0,
            vulnerability_detection_rate=95.0,
            security_coverage_percentage=90.0,
            false_positive_rate=5.0,
            automated_remediation_rate=20.0,
            security_score=80.0,
        )

        # Mock other required methods
        service._get_critical_vulnerabilities = AsyncMock(return_value=[])
        service._get_policy_violations_summary = AsyncMock(return_value={})
        service._get_project_security_scores = AsyncMock(return_value=[])
        service._get_vulnerability_severity_distribution = AsyncMock(return_value={})
        service._get_remediation_progress = AsyncMock(return_value={})

        # Call the service
        result = await service.get_security_dashboard(
            organization_id="test-org", time_range=TimeRange.LAST_30_DAYS
        )

        # Verify the result
        assert isinstance(result, SecurityDashboardResponse)
        assert result.time_range == TimeRange.LAST_30_DAYS
        assert len(result.vulnerability_trends) == 1
        assert result.compliance_overview.total_projects == 10
        assert result.risk_metrics.total_vulnerabilities == 50
        assert result.security_kpis.security_score == 80.0

        # Verify all methods were called
        mock_trends.assert_called_once()
        mock_compliance.assert_called_once()
        mock_risk.assert_called_once()
        mock_kpis.assert_called_once()
