"""
Comprehensive unit tests for the report generator.
"""

import pytest
import json
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import Mock, AsyncMock, patch, mock_open
from pathlib import Path

from udp.reporting.generators import (
    ReportGenerator, ReportFormat, ComplianceFramework,
    report_generator
)
from udp.analytics.engine import AnalyticsMetric, MetricType, TimeInterval
from udp.domain.models import SecurityLevel, LicenseType, EcosystemType
from udp.infrastructure.models import OrganizationModel


class TestReportFormat:
    """Test report format enumeration."""
    
    def test_report_format_values(self):
        """Test all report formats have correct values."""
        assert ReportFormat.JSON == "json"
        assert ReportFormat.HTML == "html"
        assert ReportFormat.PDF == "pdf"
        assert ReportFormat.XLSX == "xlsx"
        assert ReportFormat.CSV == "csv"


class TestComplianceFramework:
    """Test compliance framework enumeration."""
    
    def test_compliance_framework_values(self):
        """Test all compliance frameworks have correct values."""
        assert ComplianceFramework.SOX == "sox"
        assert ComplianceFramework.ISO27001 == "iso27001"
        assert ComplianceFramework.NIST == "nist"
        assert ComplianceFramework.PCI_DSS == "pci_dss"
        assert ComplianceFramework.HIPAA == "hipaa"
        assert ComplianceFramework.GDPR == "gdpr"


class TestReportGenerator:
    """Comprehensive tests for the ReportGenerator class."""
    
    @pytest.fixture
    def report_generator_instance(self):
        """Create a fresh report generator instance."""
        return ReportGenerator(template_dir="test_templates")
    
    @pytest.fixture
    def mock_organization(self):
        """Create a mock organization for testing."""
        org = Mock(spec=OrganizationModel)
        org.id = uuid4()
        org.name = "Acme Corporation"
        org.domain = "acme.com"
        org.industry = "Technology"
        org.compliance_frameworks = ["SOX", "ISO27001"]
        org.allowed_licenses = ["MIT", "Apache-2.0", "BSD-3-Clause"]
        org.blocked_licenses = ["GPL-3.0", "AGPL-3.0"]
        return org
    
    @pytest.fixture
    def sample_security_metrics(self):
        """Create sample security metrics for testing."""
        return {
            "critical_vulnerabilities": AnalyticsMetric(
                name="Critical Vulnerabilities",
                value=8.0,
                metric_type=MetricType.COUNT,
                timestamp=datetime.utcnow(),
                metadata={
                    "severity_distribution": {
                        "CRITICAL": 8,
                        "HIGH": 15,
                        "MEDIUM": 32,
                        "LOW": 45
                    }
                }
            ),
            "high_vulnerabilities": AnalyticsMetric(
                name="High Vulnerabilities", 
                value=15.0,
                metric_type=MetricType.COUNT,
                timestamp=datetime.utcnow(),
                metadata={}
            ),
            "average_cvss_score": AnalyticsMetric(
                name="Average CVSS Score",
                value=7.2,
                metric_type=MetricType.SCORE,
                timestamp=datetime.utcnow(),
                metadata={"max_score": 10.0}
            ),
            "exploitable_packages": AnalyticsMetric(
                name="Exploitable Packages",
                value=5.0,
                metric_type=MetricType.COUNT,
                timestamp=datetime.utcnow(),
                metadata={}
            )
        }
    
    @pytest.fixture
    def sample_license_metrics(self):
        """Create sample license metrics for testing."""
        return {
            "license_distribution": AnalyticsMetric(
                name="License Distribution",
                value=150.0,
                metric_type=MetricType.DISTRIBUTION,
                timestamp=datetime.utcnow(),
                metadata={
                    "distribution": {
                        "MIT": 60,
                        "Apache-2.0": 45,
                        "GPL-3.0": 25,
                        "BSD-3-Clause": 20
                    },
                    "percentages": {
                        "MIT": 40.0,
                        "Apache-2.0": 30.0,
                        "GPL-3.0": 16.7,
                        "BSD-3-Clause": 13.3
                    }
                }
            ),
            "copyleft_percentage": AnalyticsMetric(
                name="Copyleft License Percentage",
                value=16.7,
                metric_type=MetricType.PERCENTAGE,
                timestamp=datetime.utcnow(),
                metadata={"copyleft_count": 25, "total_count": 150}
            ),
            "enterprise_friendly_percentage": AnalyticsMetric(
                name="Enterprise-Friendly License Percentage",
                value=83.3,
                metric_type=MetricType.PERCENTAGE,
                timestamp=datetime.utcnow(),
                metadata={"enterprise_count": 125, "total_count": 150}
            )
        }
    
    @pytest.fixture
    def sample_workflow_metrics(self):
        """Create sample workflow metrics for testing."""
        return {
            "workflow_completion_rate": AnalyticsMetric(
                name="Workflow Completion Rate",
                value=87.5,
                metric_type=MetricType.PERCENTAGE,
                timestamp=datetime.utcnow(),
                metadata={"total_workflows": 40, "completed_workflows": 35}
            ),
            "average_processing_time": AnalyticsMetric(
                name="Average Processing Time",
                value=32.5,
                metric_type=MetricType.RATIO,
                timestamp=datetime.utcnow(),
                metadata={"seconds": 1950.0, "time_range": "1M"}
            ),
            "pending_approvals": AnalyticsMetric(
                name="Pending Approvals",
                value=7.0,
                metric_type=MetricType.COUNT,
                timestamp=datetime.utcnow(),
                metadata={}
            )
        }

    def test_report_generator_initialization(self, report_generator_instance):
        """Test report generator initialization."""
        assert report_generator_instance.template_dir == Path("test_templates")
        assert report_generator_instance.jinja_env is not None
        
        # Check custom filters are registered
        filters = report_generator_instance.jinja_env.filters
        assert 'datetime' in filters
        assert 'percentage' in filters
        assert 'number' in filters

    @pytest.mark.asyncio
    async def test_generate_compliance_report_success(
        self, 
        report_generator_instance, 
        mock_organization,
        sample_security_metrics,
        sample_license_metrics, 
        sample_workflow_metrics
    ):
        """Test successful compliance report generation."""
        mock_db = AsyncMock()
        mock_db.get.return_value = mock_organization
        
        # Mock analytics engine calls
        with patch('udp.reporting.generators.analytics_engine') as mock_analytics:
            mock_analytics.get_security_metrics.return_value = sample_security_metrics
            mock_analytics.get_license_compliance_metrics.return_value = sample_license_metrics
            mock_analytics.get_workflow_performance_metrics.return_value = sample_workflow_metrics
            
            report = await report_generator_instance.generate_compliance_report(
                db=mock_db,
                organization_id=mock_organization.id,
                framework="SOX",
                time_range=TimeInterval.MONTH,
                format=ReportFormat.JSON,
                include_details=True
            )
        
        # Verify report structure
        assert "report_data" in report
        assert "metadata" in report
        assert "generation_summary" in report
        
        report_data = report["report_data"]
        
        # Check required sections
        required_sections = [
            "report_metadata", "executive_summary", "compliance_assessment",
            "security_analysis", "license_analysis", "operational_metrics",
            "recommendations", "appendices"
        ]
        
        for section in required_sections:
            assert section in report_data, f"Missing section: {section}"
        
        # Verify metadata
        metadata = report_data["report_metadata"]
        assert metadata["report_type"] == "compliance"
        assert metadata["organization_name"] == mock_organization.name
        assert metadata["compliance_framework"] == "SOX"
        assert metadata["time_range"] == "1M"
        assert metadata["include_details"] == True
        
        # Verify generation summary
        gen_summary = report["generation_summary"]
        assert "metrics_analyzed" in gen_summary
        assert "recommendations_count" in gen_summary
        assert "compliance_score" in gen_summary

    @pytest.mark.asyncio
    async def test_generate_compliance_report_minimal_details(
        self, 
        report_generator_instance, 
        mock_organization,
        sample_security_metrics,
        sample_license_metrics,
        sample_workflow_metrics
    ):
        """Test compliance report generation without details."""
        mock_db = AsyncMock()
        mock_db.get.return_value = mock_organization
        
        with patch('udp.reporting.generators.analytics_engine') as mock_analytics:
            mock_analytics.get_security_metrics.return_value = sample_security_metrics
            mock_analytics.get_license_compliance_metrics.return_value = sample_license_metrics
            mock_analytics.get_workflow_performance_metrics.return_value = sample_workflow_metrics
            
            report = await report_generator_instance.generate_compliance_report(
                db=mock_db,
                organization_id=mock_organization.id,
                format=ReportFormat.JSON,
                include_details=False
            )
        
        report_data = report["report_data"]
        
        # Should not include appendices when include_details=False
        assert report_data["appendices"] == {}
        
        # Security analysis should not have detailed findings
        assert report_data["security_analysis"]["detailed_findings"] == {}

    @pytest.mark.asyncio
    async def test_generate_compliance_report_organization_not_found(self, report_generator_instance):
        """Test compliance report generation when organization not found."""
        mock_db = AsyncMock()
        mock_db.get.return_value = None  # Organization not found
        
        with pytest.raises(ValueError, match="Organization .* not found"):
            await report_generator_instance.generate_compliance_report(
                db=mock_db,
                organization_id=uuid4(),
                format=ReportFormat.JSON
            )

    @pytest.mark.asyncio
    async def test_generate_security_report_success(
        self, 
        report_generator_instance,
        sample_security_metrics
    ):
        """Test successful security report generation."""
        mock_db = AsyncMock()
        
        # Create ecosystem metrics
        ecosystem_metrics = {
            "ecosystem_distribution": AnalyticsMetric(
                name="Ecosystem Distribution",
                value=100.0,
                metric_type=MetricType.DISTRIBUTION,
                timestamp=datetime.utcnow(),
                metadata={
                    "distribution": {"npm": 65, "pypi": 35},
                    "percentages": {"npm": 65.0, "pypi": 35.0}
                }
            )
        }
        
        with patch('udp.reporting.generators.analytics_engine') as mock_analytics:
            mock_analytics.get_security_metrics.return_value = sample_security_metrics
            mock_analytics.get_ecosystem_insights.return_value = ecosystem_metrics
            
            report = await report_generator_instance.generate_security_report(
                db=mock_db,
                organization_id=uuid4(),
                time_range=TimeInterval.QUARTER,
                format=ReportFormat.HTML,
                include_remediation_plan=True
            )
        
        report_data = report["report_data"]
        
        # Check security-specific sections
        required_sections = [
            "report_metadata", "threat_landscape", "risk_assessment",
            "ecosystem_analysis", "vulnerability_details", 
            "remediation_plan", "security_recommendations"
        ]
        
        for section in required_sections:
            assert section in report_data
        
        # Verify threat landscape
        threat_landscape = report_data["threat_landscape"]
        assert threat_landscape["critical_vulnerabilities"] == 8.0
        assert threat_landscape["high_vulnerabilities"] == 15.0
        assert threat_landscape["average_cvss_score"] == 7.2
        assert threat_landscape["exploitable_packages"] == 5.0

    @pytest.mark.asyncio
    async def test_generate_security_report_no_remediation(
        self, 
        report_generator_instance,
        sample_security_metrics
    ):
        """Test security report generation without remediation plan."""
        mock_db = AsyncMock()
        
        ecosystem_metrics = {
            "ecosystem_distribution": AnalyticsMetric(
                name="Ecosystem Distribution",
                value=100.0,
                metric_type=MetricType.DISTRIBUTION,
                timestamp=datetime.utcnow(),
                metadata={"distribution": {"npm": 100}}
            )
        }
        
        with patch('udp.reporting.generators.analytics_engine') as mock_analytics:
            mock_analytics.get_security_metrics.return_value = sample_security_metrics
            mock_analytics.get_ecosystem_insights.return_value = ecosystem_metrics
            
            report = await report_generator_instance.generate_security_report(
                db=mock_db,
                organization_id=uuid4(),
                include_remediation_plan=False
            )
        
        # Should not include remediation plan
        assert report["report_data"]["remediation_plan"] == {}

    @pytest.mark.asyncio
    async def test_generate_executive_summary_success(self, report_generator_instance):
        """Test successful executive summary generation."""
        mock_db = AsyncMock()
        
        # Mock dashboard data
        dashboard_data = {
            "organization_id": str(uuid4()),
            "overall_risk_score": 6.8,
            "security_summary": {
                "critical_vulnerabilities": 5,
                "average_cvss_score": 7.1,
                "exploitable_packages": 3
            },
            "compliance_summary": {
                "copyleft_percentage": 18.5,
                "enterprise_friendly_percentage": 81.5
            },
            "operational_summary": {
                "workflow_completion_rate": 89.2,
                "average_processing_time": 28.7,
                "pending_approvals": 4
            }
        }
        
        with patch('udp.reporting.generators.analytics_engine') as mock_analytics:
            mock_analytics.generate_executive_dashboard.return_value = dashboard_data
            
            report = await report_generator_instance.generate_executive_summary(
                db=mock_db,
                organization_id=uuid4(),
                time_range=TimeInterval.QUARTER,
                format=ReportFormat.PDF
            )
        
        report_data = report["report_data"]
        
        # Check executive-specific sections
        required_sections = [
            "report_metadata", "key_metrics", "strategic_insights",
            "business_impact", "strategic_recommendations", "next_quarter_roadmap"
        ]
        
        for section in required_sections:
            assert section in report_data
        
        # Verify key metrics
        key_metrics = report_data["key_metrics"]
        assert key_metrics["overall_risk_score"] == 6.8
        assert "security_posture" in key_metrics
        assert "compliance_status" in key_metrics
        assert "operational_efficiency" in key_metrics
        
        # Verify metadata
        metadata = report_data["report_metadata"]
        assert metadata["report_type"] == "executive_summary"
        assert metadata["confidentiality"] == "CONFIDENTIAL"

    def test_serialize_report_data_with_datetime(self, report_generator_instance):
        """Test report data serialization with datetime objects."""
        test_data = {
            "timestamp": datetime(2024, 1, 15, 14, 30, 0),
            "string_field": "test_value",
            "number_field": 123.45,
            "nested_object": {
                "created_at": datetime(2024, 1, 16, 10, 0, 0),
                "value": 100
            }
        }
        
        serialized = report_generator_instance._serialize_report_data(test_data)
        
        assert isinstance(serialized, dict)
        assert serialized["timestamp"] == "2024-01-15T14:30:00"
        assert serialized["string_field"] == "test_value"
        assert serialized["number_field"] == 123.45
        assert serialized["nested_object"]["created_at"] == "2024-01-16T10:00:00"

    def test_serialize_report_data_with_custom_objects(self, report_generator_instance):
        """Test serialization with custom objects having __dict__."""
        class CustomObject:
            def __init__(self):
                self.name = "test"
                self.value = 42
        
        test_data = {
            "custom_obj": CustomObject(),
            "regular_field": "normal"
        }
        
        serialized = report_generator_instance._serialize_report_data(test_data)
        
        assert serialized["custom_obj"]["name"] == "test"
        assert serialized["custom_obj"]["value"] == 42
        assert serialized["regular_field"] == "normal"

    @pytest.mark.asyncio
    async def test_format_report_json(self, report_generator_instance):
        """Test JSON report formatting."""
        test_data = {
            "report_type": "test",
            "timestamp": datetime.utcnow(),
            "metrics": {"count": 10}
        }
        
        formatted = await report_generator_instance._format_report(
            test_data, ReportFormat.JSON
        )
        
        assert isinstance(formatted, dict)
        assert formatted["report_type"] == "test"
        assert "timestamp" in formatted

    @pytest.mark.asyncio
    async def test_format_report_html_with_template(self, report_generator_instance):
        """Test HTML report formatting with template."""
        test_data = {
            "report_metadata": {
                "generated_at": datetime.utcnow(),
                "organization_name": "Test Org"
            }
        }
        
        # Mock successful template rendering
        mock_template = Mock()
        mock_template.render.return_value = "<html><body>Test Report</body></html>"
        
        with patch.object(report_generator_instance.jinja_env, 'get_template', return_value=mock_template):
            formatted = await report_generator_instance._format_report(
                test_data, ReportFormat.HTML, template="test_template"
            )
        
        assert isinstance(formatted, str)
        assert "<html>" in formatted
        assert "Test Report" in formatted

    @pytest.mark.asyncio
    async def test_format_report_html_fallback(self, report_generator_instance):
        """Test HTML report formatting with fallback when template fails."""
        test_data = {
            "report_metadata": {
                "generated_at": datetime.utcnow(),
                "organization_name": "Test Org"
            }
        }
        
        # Mock template failure
        with patch.object(report_generator_instance.jinja_env, 'get_template', side_effect=Exception("Template not found")):
            formatted = await report_generator_instance._format_report(
                test_data, ReportFormat.HTML
            )
        
        assert isinstance(formatted, str)
        assert "<!DOCTYPE html>" in formatted
        assert "Compliance Report" in formatted

    @pytest.mark.asyncio
    async def test_format_report_unsupported_format(self, report_generator_instance):
        """Test error handling for unsupported format."""
        test_data = {"test": "data"}
        
        with pytest.raises(ValueError, match="Unsupported format: unsupported"):
            await report_generator_instance._format_report(
                test_data, "unsupported"
            )

    def test_generate_basic_html(self, report_generator_instance):
        """Test basic HTML generation."""
        test_data = {
            "report_metadata": {
                "generated_at": datetime(2024, 1, 15, 14, 30, 0),
                "organization_name": "Test Organization"
            },
            "executive_summary": {
                "organization_overview": {
                    "name": "Test Organization"
                }
            }
        }
        
        html = report_generator_instance._generate_basic_html(test_data)
        
        assert isinstance(html, str)
        assert "<!DOCTYPE html>" in html
        assert "Compliance Report" in html
        assert "2024-01-15 14:30:00 UTC" in html

    def test_format_datetime_filter(self, report_generator_instance):
        """Test datetime formatting filter."""
        test_datetime = datetime(2024, 6, 15, 9, 30, 45)
        
        formatted = report_generator_instance._format_datetime(test_datetime)
        
        assert formatted == "2024-06-15 09:30:45 UTC"

    def test_format_percentage_filter(self, report_generator_instance):
        """Test percentage formatting filter."""
        test_cases = [
            (85.5, "85.5%"),
            (100.0, "100.0%"),
            (0.0, "0.0%"),
            (99.99, "99.9%")
        ]
        
        for value, expected in test_cases:
            formatted = report_generator_instance._format_percentage(value)
            assert formatted == expected

    def test_format_number_filter(self, report_generator_instance):
        """Test number formatting filter."""
        test_cases = [
            (1234.5, "1,234.5"),
            (1000000, "1,000,000"),
            (123, "123"),
            (0.123, "0.1")
        ]
        
        for value, expected in test_cases:
            formatted = report_generator_instance._format_number(value)
            assert formatted == expected

    def test_calculate_risk_level(self, report_generator_instance):
        """Test risk level calculation."""
        test_cases = [
            # (critical_vulns, avg_cvss, expected_level)
            (5, 9.0, "CRITICAL"),
            (0, 8.5, "CRITICAL"),
            (0, 7.0, "HIGH"),
            (0, 5.0, "MEDIUM"),
            (0, 3.0, "LOW"),
            (1, 6.0, "CRITICAL")  # Any critical vulns = CRITICAL
        ]
        
        for critical_vulns, avg_cvss, expected in test_cases:
            mock_metrics = {
                "critical_vulnerabilities": Mock(value=critical_vulns),
                "average_cvss_score": Mock(value=avg_cvss)
            }
            
            risk_level = report_generator_instance._calculate_risk_level(mock_metrics)
            assert risk_level == expected

    def test_get_compliance_grade(self, report_generator_instance):
        """Test compliance grade calculation."""
        test_cases = [
            (95.0, "A"),
            (85.0, "B"),
            (75.0, "C"),
            (65.0, "D"),
            (45.0, "F")
        ]
        
        for score, expected_grade in test_cases:
            grade = report_generator_instance._get_compliance_grade(score)
            assert grade == expected_grade

    def test_get_efficiency_grade(self, report_generator_instance):
        """Test efficiency grade calculation."""
        test_cases = [
            (98.0, "Excellent"),
            (90.0, "Good"),
            (75.0, "Fair"),
            (60.0, "Needs Improvement")
        ]
        
        for completion_rate, expected_grade in test_cases:
            grade = report_generator_instance._get_efficiency_grade(completion_rate)
            assert grade == expected_grade

    @pytest.mark.asyncio
    async def test_build_executive_summary(
        self, 
        report_generator_instance, 
        mock_organization,
        sample_security_metrics,
        sample_license_metrics,
        sample_workflow_metrics
    ):
        """Test executive summary building."""
        summary = await report_generator_instance._build_executive_summary(
            mock_organization,
            sample_security_metrics,
            sample_license_metrics,
            sample_workflow_metrics
        )
        
        # Check structure
        assert "organization_overview" in summary
        assert "key_findings" in summary
        assert "business_impact" in summary
        
        # Verify organization overview
        org_overview = summary["organization_overview"]
        assert org_overview["name"] == mock_organization.name
        assert org_overview["domain"] == mock_organization.domain
        assert org_overview["industry"] == mock_organization.industry
        
        # Verify key findings
        key_findings = summary["key_findings"]
        assert key_findings["critical_vulnerabilities"] == 8.0
        assert key_findings["license_compliance_rate"] == 83.3  # 100 - 16.7
        assert key_findings["workflow_efficiency"] == 87.5

    @pytest.mark.asyncio
    async def test_build_compliance_assessment(
        self, 
        report_generator_instance,
        mock_organization,
        sample_security_metrics,
        sample_license_metrics
    ):
        """Test compliance assessment building."""
        mock_db = AsyncMock()
        
        with patch.object(report_generator_instance, '_calculate_policy_compliance_score', return_value=90.0):
            assessment = await report_generator_instance._build_compliance_assessment(
                mock_db,
                mock_organization,
                "SOX",
                sample_security_metrics,
                sample_license_metrics
            )
        
        # Check structure
        assert "overall_score" in assessment
        assert "compliance_grade" in assessment
        assert "framework_assessment" in assessment
        assert "compliance_gaps" in assessment
        
        # Verify calculations
        assert isinstance(assessment["overall_score"], float)
        assert assessment["compliance_grade"] in ["A", "B", "C", "D", "F"]
        
        # Verify framework assessment
        framework = assessment["framework_assessment"]
        assert framework["target_framework"] == "SOX"
        assert "security_compliance" in framework
        assert "license_compliance" in framework
        assert "policy_compliance" in framework

    @pytest.mark.asyncio
    async def test_build_security_analysis(self, report_generator_instance, sample_security_metrics):
        """Test security analysis building."""
        analysis = await report_generator_instance._build_security_analysis(
            sample_security_metrics, include_details=True
        )
        
        # Check structure
        assert "vulnerability_summary" in analysis
        assert "risk_assessment" in analysis
        assert "detailed_findings" in analysis
        
        # Verify vulnerability summary
        vuln_summary = analysis["vulnerability_summary"]
        assert vuln_summary["critical_count"] == 8.0
        assert vuln_summary["high_count"] == 15.0
        assert vuln_summary["average_cvss"] == 7.2
        assert vuln_summary["exploitable_packages"] == 5.0
        
        # Verify risk assessment
        risk_assessment = analysis["risk_assessment"]
        assert "overall_risk" in risk_assessment
        assert "immediate_threats" in risk_assessment
        assert "risk_factors" in risk_assessment

    @pytest.mark.asyncio
    async def test_build_license_analysis(
        self, 
        report_generator_instance, 
        sample_license_metrics, 
        mock_organization
    ):
        """Test license analysis building."""
        analysis = await report_generator_instance._build_license_analysis(
            sample_license_metrics, mock_organization, include_details=True
        )
        
        # Check structure
        assert "distribution_summary" in analysis
        assert "compliance_metrics" in analysis
        assert "risk_assessment" in analysis
        assert "policy_alignment" in analysis
        assert "detailed_breakdown" in analysis
        
        # Verify compliance metrics
        compliance_metrics = analysis["compliance_metrics"]
        assert compliance_metrics["copyleft_percentage"] == 16.7
        assert compliance_metrics["enterprise_friendly_percentage"] == 83.3
        
        # Verify policy alignment
        policy_alignment = analysis["policy_alignment"]
        assert policy_alignment["allowed_licenses"] == mock_organization.allowed_licenses
        assert policy_alignment["blocked_licenses"] == mock_organization.blocked_licenses

    @pytest.mark.asyncio
    async def test_build_operational_metrics(self, report_generator_instance, sample_workflow_metrics):
        """Test operational metrics building."""
        metrics = await report_generator_instance._build_operational_metrics(
            sample_workflow_metrics, include_details=True
        )
        
        # Check structure
        assert "efficiency_metrics" in metrics
        assert "performance_assessment" in metrics
        assert "detailed_metrics" in metrics
        
        # Verify efficiency metrics
        efficiency = metrics["efficiency_metrics"]
        assert efficiency["completion_rate"] == 87.5
        assert efficiency["average_processing_time"] == 32.5
        assert efficiency["pending_approvals"] == 7.0
        
        # Verify performance assessment
        performance = metrics["performance_assessment"]
        assert "efficiency_grade" in performance
        assert "bottlenecks" in performance
        assert "improvement_opportunities" in performance

    @pytest.mark.asyncio
    async def test_build_recommendations_comprehensive(
        self,
        report_generator_instance,
        sample_security_metrics,
        sample_license_metrics,
        sample_workflow_metrics
    ):
        """Test comprehensive recommendations building."""
        recommendations = await report_generator_instance._build_recommendations(
            sample_security_metrics,
            sample_license_metrics,
            sample_workflow_metrics,
            "SOX"
        )
        
        assert isinstance(recommendations, list)
        assert len(recommendations) >= 2  # Should have security and license recommendations
        
        # Check recommendation structure
        for rec in recommendations:
            assert "category" in rec
            assert "priority" in rec
            assert "title" in rec
            assert "description" in rec
            assert "impact" in rec
            assert "effort" in rec
            assert "timeline" in rec
            assert "action_items" in rec
        
        # Should have security recommendation due to critical vulnerabilities
        security_recs = [r for r in recommendations if r["category"] == "Security"]
        assert len(security_recs) >= 1
        assert security_recs[0]["priority"] == "Critical"

    @pytest.mark.asyncio
    async def test_build_recommendations_no_issues(self, report_generator_instance):
        """Test recommendations when there are no major issues."""
        # Create metrics with no critical issues
        safe_security_metrics = {
            "critical_vulnerabilities": AnalyticsMetric("Critical", 0.0, MetricType.COUNT, datetime.utcnow(), {})
        }
        safe_license_metrics = {
            "copyleft_percentage": AnalyticsMetric("Copyleft", 10.0, MetricType.PERCENTAGE, datetime.utcnow(), {})
        }
        safe_workflow_metrics = {
            "workflow_completion_rate": AnalyticsMetric("Completion", 95.0, MetricType.PERCENTAGE, datetime.utcnow(), {})
        }
        
        recommendations = await report_generator_instance._build_recommendations(
            safe_security_metrics,
            safe_license_metrics,
            safe_workflow_metrics,
            None
        )
        
        # Should have minimal or no recommendations
        assert isinstance(recommendations, list)
        # No critical security issues should result in no security recommendations
        security_recs = [r for r in recommendations if r["category"] == "Security"]
        assert len(security_recs) == 0

    @pytest.mark.asyncio
    async def test_error_handling_in_report_generation(self, report_generator_instance):
        """Test error handling during report generation."""
        mock_db = AsyncMock()
        
        # Mock analytics engine to raise an exception
        with patch('udp.reporting.generators.analytics_engine') as mock_analytics:
            mock_analytics.get_security_metrics.side_effect = Exception("Analytics error")
            
            with pytest.raises(Exception) as exc_info:
                await report_generator_instance.generate_compliance_report(
                    db=mock_db,
                    organization_id=uuid4(),
                    format=ReportFormat.JSON
                )
            
            assert "Analytics error" in str(exc_info.value)

    def test_placeholder_methods(self, report_generator_instance):
        """Test placeholder methods return expected defaults."""
        # These are simplified implementations that should return reasonable defaults
        mock_db = AsyncMock()
        org_id = uuid4()
        
        # Test async methods that return simple defaults
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Test policy compliance score
            score = loop.run_until_complete(
                report_generator_instance._calculate_policy_compliance_score(mock_db, org_id)
            )
            assert score == 85.0
            
            # Test vulnerability details
            details = loop.run_until_complete(
                report_generator_instance._get_vulnerability_details(mock_db, org_id, TimeInterval.MONTH)
            )
            assert isinstance(details, dict)
            
            # Test risk trends
            trends = loop.run_until_complete(
                report_generator_instance._calculate_risk_trends(mock_db, org_id, TimeInterval.MONTH)
            )
            assert isinstance(trends, dict)
            
            # Test overall risk calculation
            mock_security = {"test": Mock()}
            mock_license = {"test": Mock()}
            overall_risk = report_generator_instance._calculate_overall_risk(mock_security, mock_license)
            assert overall_risk == "MEDIUM"
            
        finally:
            loop.close()

    def test_global_report_generator_instance(self):
        """Test the global report_generator instance."""
        assert report_generator is not None
        assert isinstance(report_generator, ReportGenerator)
        assert report_generator.template_dir == Path("templates/reports")


if __name__ == "__main__":
    pytest.main([__file__])