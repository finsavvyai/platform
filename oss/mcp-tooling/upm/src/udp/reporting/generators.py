"""
Universal Dependency Platform - Report Generators

Enterprise-grade report generation with multiple formats,
scheduled reporting, and compliance template support.
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
from pathlib import Path
from uuid import UUID
import structlog

from jinja2 import Environment, FileSystemLoader, Template
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from udp.analytics.engine import analytics_engine, TimeInterval
from udp.infrastructure.models import OrganizationModel, PolicyModel
from udp.core.database import get_async_session

logger = structlog.get_logger()


class ReportFormat:
    """Supported report formats."""
    JSON = "json"
    HTML = "html"
    PDF = "pdf"
    XLSX = "xlsx"
    CSV = "csv"


class ComplianceFramework:
    """Supported compliance frameworks."""
    SOX = "sox"
    ISO27001 = "iso27001"
    NIST = "nist"
    PCI_DSS = "pci_dss"
    HIPAA = "hipaa"
    GDPR = "gdpr"


class ReportGenerator:
    """
    Enterprise report generator with multiple format support.
    
    Generates comprehensive compliance, security, and operational
    reports with customizable templates and automated scheduling.
    """
    
    def __init__(self, template_dir: str = "templates/reports"):
        self.template_dir = Path(template_dir)
        self.template_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize Jinja2 environment
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(self.template_dir)),
            autoescape=True
        )
        
        # Register custom filters
        self.jinja_env.filters['datetime'] = self._format_datetime
        self.jinja_env.filters['percentage'] = self._format_percentage
        self.jinja_env.filters['number'] = self._format_number
    
    async def generate_compliance_report(
        self,
        db: AsyncSession,
        organization_id: UUID,
        framework: Optional[str] = None,
        time_range: TimeInterval = TimeInterval.MONTH,
        format: str = ReportFormat.JSON,
        include_details: bool = True
    ) -> Dict[str, Any]:
        """
        Generate comprehensive compliance report.
        
        Args:
            db: Database session
            organization_id: Organization ID
            framework: Compliance framework filter
            time_range: Time range for analysis
            format: Output format
            include_details: Include detailed analysis
            
        Returns:
            Generated report data and metadata
        """
        try:
            logger.info(
                "Generating compliance report",
                organization_id=str(organization_id),
                framework=framework,
                format=format
            )
            
            # Gather analytics data
            security_metrics = await analytics_engine.get_security_metrics(
                db, organization_id, time_range
            )
            
            license_metrics = await analytics_engine.get_license_compliance_metrics(
                db, organization_id, time_range
            )
            
            workflow_metrics = await analytics_engine.get_workflow_performance_metrics(
                db, organization_id, time_range
            )
            
            # Get organization details
            org_query = await db.get(OrganizationModel, organization_id)
            organization = org_query
            
            if not organization:
                raise ValueError(f"Organization {organization_id} not found")
            
            # Build report data
            report_data = {
                "report_metadata": {
                    "report_id": f"compliance_{organization_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
                    "report_type": "compliance",
                    "generated_at": datetime.utcnow(),
                    "organization_id": str(organization_id),
                    "organization_name": organization.name,
                    "time_range": time_range.value,
                    "compliance_framework": framework,
                    "report_format": format,
                    "include_details": include_details
                },
                "executive_summary": await self._build_executive_summary(
                    organization, security_metrics, license_metrics, workflow_metrics
                ),
                "compliance_assessment": await self._build_compliance_assessment(
                    db, organization, framework, security_metrics, license_metrics
                ),
                "security_analysis": await self._build_security_analysis(
                    security_metrics, include_details
                ),
                "license_analysis": await self._build_license_analysis(
                    license_metrics, organization, include_details
                ),
                "operational_metrics": await self._build_operational_metrics(
                    workflow_metrics, include_details
                ),
                "recommendations": await self._build_recommendations(
                    security_metrics, license_metrics, workflow_metrics, framework
                ),
                "appendices": await self._build_appendices(
                    db, organization_id, include_details
                ) if include_details else {}
            }
            
            # Generate report in requested format
            report_output = await self._format_report(report_data, format)
            
            logger.info(
                "Compliance report generated successfully",
                organization_id=str(organization_id),
                framework=framework,
                format=format,
                size_bytes=len(str(report_output))
            )
            
            return {
                "report_data": report_output,
                "metadata": report_data["report_metadata"],
                "generation_summary": {
                    "metrics_analyzed": len(security_metrics) + len(license_metrics) + len(workflow_metrics),
                    "recommendations_count": len(report_data["recommendations"]),
                    "compliance_score": report_data["compliance_assessment"]["overall_score"]
                }
            }
            
        except Exception as e:
            logger.error(
                "Failed to generate compliance report",
                organization_id=str(organization_id),
                error=str(e),
                exc_info=True
            )
            raise
    
    async def generate_security_report(
        self,
        db: AsyncSession,
        organization_id: UUID,
        time_range: TimeInterval = TimeInterval.MONTH,
        format: str = ReportFormat.JSON,
        include_remediation_plan: bool = True
    ) -> Dict[str, Any]:
        """
        Generate detailed security analysis report.
        
        Args:
            db: Database session
            organization_id: Organization ID
            time_range: Time range for analysis
            format: Output format
            include_remediation_plan: Include remediation recommendations
            
        Returns:
            Security report data and metadata
        """
        try:
            logger.info(
                "Generating security report",
                organization_id=str(organization_id),
                time_range=time_range.value,
                format=format
            )
            
            # Get comprehensive security metrics
            security_metrics = await analytics_engine.get_security_metrics(
                db, organization_id, time_range
            )
            
            ecosystem_metrics = await analytics_engine.get_ecosystem_insights(
                db, organization_id, time_range
            )
            
            # Build detailed security report
            report_data = {
                "report_metadata": {
                    "report_id": f"security_{organization_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
                    "report_type": "security_analysis",
                    "generated_at": datetime.utcnow(),
                    "organization_id": str(organization_id),
                    "time_range": time_range.value,
                    "format": format
                },
                "threat_landscape": {
                    "critical_vulnerabilities": security_metrics["critical_vulnerabilities"].value,
                    "high_vulnerabilities": security_metrics["high_vulnerabilities"].value,
                    "average_cvss_score": security_metrics["average_cvss_score"].value,
                    "exploitable_packages": security_metrics["exploitable_packages"].value,
                    "severity_distribution": security_metrics["critical_vulnerabilities"].metadata.get("severity_distribution", {})
                },
                "risk_assessment": {
                    "overall_risk_level": self._calculate_risk_level(security_metrics),
                    "critical_risk_factors": self._identify_critical_risk_factors(security_metrics),
                    "risk_trends": await self._calculate_risk_trends(db, organization_id, time_range)
                },
                "ecosystem_analysis": {
                    "ecosystem_distribution": ecosystem_metrics["ecosystem_distribution"].metadata,
                    "high_risk_ecosystems": self._identify_high_risk_ecosystems(ecosystem_metrics, security_metrics)
                },
                "vulnerability_details": await self._get_vulnerability_details(
                    db, organization_id, time_range
                ),
                "remediation_plan": await self._build_remediation_plan(
                    security_metrics, db, organization_id
                ) if include_remediation_plan else {},
                "security_recommendations": await self._build_security_recommendations(
                    security_metrics, ecosystem_metrics
                )
            }
            
            # Format report
            report_output = await self._format_report(report_data, format)
            
            logger.info(
                "Security report generated successfully",
                organization_id=str(organization_id),
                critical_vulns=report_data["threat_landscape"]["critical_vulnerabilities"],
                risk_level=report_data["risk_assessment"]["overall_risk_level"]
            )
            
            return {
                "report_data": report_output,
                "metadata": report_data["report_metadata"],
                "security_summary": report_data["threat_landscape"]
            }
            
        except Exception as e:
            logger.error(
                "Failed to generate security report",
                organization_id=str(organization_id),
                error=str(e)
            )
            raise
    
    async def generate_executive_summary(
        self,
        db: AsyncSession,
        organization_id: UUID,
        time_range: TimeInterval = TimeInterval.QUARTER,
        format: str = ReportFormat.PDF
    ) -> Dict[str, Any]:
        """
        Generate executive summary report for leadership.
        
        Args:
            db: Database session
            organization_id: Organization ID  
            time_range: Time range for analysis
            format: Output format (PDF recommended for executives)
            
        Returns:
            Executive summary report
        """
        try:
            logger.info(
                "Generating executive summary",
                organization_id=str(organization_id),
                time_range=time_range.value
            )
            
            # Get executive dashboard data
            dashboard_data = await analytics_engine.generate_executive_dashboard(
                db, organization_id, time_range
            )
            
            # Build executive-focused report
            report_data = {
                "report_metadata": {
                    "report_id": f"executive_{organization_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
                    "report_type": "executive_summary",
                    "generated_at": datetime.utcnow(),
                    "organization_id": str(organization_id),
                    "time_range": time_range.value,
                    "format": format,
                    "confidentiality": "CONFIDENTIAL"
                },
                "key_metrics": {
                    "overall_risk_score": dashboard_data["overall_risk_score"],
                    "security_posture": self._assess_security_posture(dashboard_data["security_summary"]),
                    "compliance_status": self._assess_compliance_status(dashboard_data["compliance_summary"]),
                    "operational_efficiency": self._assess_operational_efficiency(dashboard_data["operational_summary"])
                },
                "strategic_insights": {
                    "risk_exposure": self._calculate_risk_exposure(dashboard_data),
                    "compliance_gaps": self._identify_compliance_gaps(dashboard_data),
                    "efficiency_opportunities": self._identify_efficiency_opportunities(dashboard_data)
                },
                "business_impact": {
                    "potential_cost_savings": await self._estimate_cost_savings(db, organization_id),
                    "risk_mitigation_value": await self._estimate_risk_mitigation_value(db, organization_id),
                    "compliance_benefits": self._calculate_compliance_benefits(dashboard_data)
                },
                "strategic_recommendations": await self._build_strategic_recommendations(
                    dashboard_data, db, organization_id
                ),
                "next_quarter_roadmap": await self._build_roadmap(
                    dashboard_data, time_range
                )
            }
            
            # Format for executives
            report_output = await self._format_report(report_data, format, template="executive_summary")
            
            logger.info(
                "Executive summary generated successfully",
                organization_id=str(organization_id),
                risk_score=report_data["key_metrics"]["overall_risk_score"]
            )
            
            return {
                "report_data": report_output,
                "metadata": report_data["report_metadata"],
                "key_insights": report_data["strategic_insights"]
            }
            
        except Exception as e:
            logger.error(
                "Failed to generate executive summary",
                organization_id=str(organization_id),
                error=str(e)
            )
            raise
    
    async def _build_executive_summary(
        self, 
        organization: OrganizationModel,
        security_metrics: Dict,
        license_metrics: Dict,
        workflow_metrics: Dict
    ) -> Dict[str, Any]:
        """Build executive summary section."""
        return {
            "organization_overview": {
                "name": organization.name,
                "domain": organization.domain,
                "industry": organization.industry,
                "compliance_frameworks": organization.compliance_frameworks
            },
            "key_findings": {
                "critical_vulnerabilities": security_metrics["critical_vulnerabilities"].value,
                "license_compliance_rate": 100 - license_metrics["copyleft_percentage"].value,
                "workflow_efficiency": workflow_metrics["workflow_completion_rate"].value,
                "overall_risk_assessment": self._calculate_overall_risk(security_metrics, license_metrics)
            },
            "business_impact": {
                "security_risk_level": "HIGH" if security_metrics["critical_vulnerabilities"].value > 0 else "MEDIUM",
                "compliance_risk_level": "HIGH" if license_metrics["copyleft_percentage"].value > 30 else "LOW",
                "operational_risk_level": "MEDIUM" if workflow_metrics["workflow_completion_rate"].value < 80 else "LOW"
            }
        }
    
    async def _build_compliance_assessment(
        self,
        db: AsyncSession,
        organization: OrganizationModel,
        framework: Optional[str],
        security_metrics: Dict,
        license_metrics: Dict
    ) -> Dict[str, Any]:
        """Build compliance assessment section."""
        
        # Calculate compliance scores for different areas
        security_score = min(100, 100 - (security_metrics["critical_vulnerabilities"].value * 10))
        license_score = license_metrics["enterprise_friendly_percentage"].value
        policy_score = await self._calculate_policy_compliance_score(db, organization.id)
        
        overall_score = (security_score + license_score + policy_score) / 3
        
        return {
            "overall_score": round(overall_score, 1),
            "compliance_grade": self._get_compliance_grade(overall_score),
            "framework_assessment": {
                "target_framework": framework or "General",
                "security_compliance": {
                    "score": security_score,
                    "status": "COMPLIANT" if security_score >= 80 else "NON_COMPLIANT",
                    "critical_issues": int(security_metrics["critical_vulnerabilities"].value)
                },
                "license_compliance": {
                    "score": license_score,
                    "status": "COMPLIANT" if license_score >= 70 else "NEEDS_REVIEW",
                    "enterprise_friendly_percentage": license_score
                },
                "policy_compliance": {
                    "score": policy_score,
                    "status": "COMPLIANT" if policy_score >= 85 else "NEEDS_IMPROVEMENT"
                }
            },
            "compliance_gaps": self._identify_specific_compliance_gaps(
                security_score, license_score, policy_score, framework
            )
        }
    
    async def _build_security_analysis(self, security_metrics: Dict, include_details: bool) -> Dict[str, Any]:
        """Build security analysis section."""
        return {
            "vulnerability_summary": {
                "critical_count": security_metrics["critical_vulnerabilities"].value,
                "high_count": security_metrics["high_vulnerabilities"].value,
                "average_cvss": security_metrics["average_cvss_score"].value,
                "exploitable_packages": security_metrics["exploitable_packages"].value
            },
            "risk_assessment": {
                "overall_risk": self._calculate_risk_level(security_metrics),
                "immediate_threats": security_metrics["exploitable_packages"].value,
                "risk_factors": self._identify_risk_factors(security_metrics)
            },
            "detailed_findings": security_metrics if include_details else {}
        }
    
    async def _build_license_analysis(
        self, 
        license_metrics: Dict, 
        organization: OrganizationModel, 
        include_details: bool
    ) -> Dict[str, Any]:
        """Build license analysis section."""
        return {
            "distribution_summary": license_metrics["license_distribution"].metadata,
            "compliance_metrics": {
                "copyleft_percentage": license_metrics["copyleft_percentage"].value,
                "enterprise_friendly_percentage": license_metrics["enterprise_friendly_percentage"].value
            },
            "risk_assessment": {
                "license_risk_level": "HIGH" if license_metrics["copyleft_percentage"].value > 30 else "LOW",
                "commercial_compatibility": license_metrics["enterprise_friendly_percentage"].value >= 70
            },
            "policy_alignment": {
                "allowed_licenses": organization.allowed_licenses,
                "blocked_licenses": organization.blocked_licenses
            },
            "detailed_breakdown": license_metrics if include_details else {}
        }
    
    async def _build_operational_metrics(self, workflow_metrics: Dict, include_details: bool) -> Dict[str, Any]:
        """Build operational metrics section."""
        return {
            "efficiency_metrics": {
                "completion_rate": workflow_metrics["workflow_completion_rate"].value,
                "average_processing_time": workflow_metrics["average_processing_time"].value,
                "pending_approvals": workflow_metrics["pending_approvals"].value
            },
            "performance_assessment": {
                "efficiency_grade": self._get_efficiency_grade(workflow_metrics["workflow_completion_rate"].value),
                "bottlenecks": self._identify_workflow_bottlenecks(workflow_metrics),
                "improvement_opportunities": self._identify_workflow_improvements(workflow_metrics)
            },
            "detailed_metrics": workflow_metrics if include_details else {}
        }
    
    async def _build_recommendations(
        self,
        security_metrics: Dict,
        license_metrics: Dict, 
        workflow_metrics: Dict,
        framework: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Build actionable recommendations."""
        recommendations = []
        
        # Security recommendations
        if security_metrics["critical_vulnerabilities"].value > 0:
            recommendations.append({
                "category": "Security",
                "priority": "Critical",
                "title": "Address Critical Vulnerabilities",
                "description": f"Immediate attention required for {int(security_metrics['critical_vulnerabilities'].value)} critical vulnerabilities",
                "impact": "High",
                "effort": "Medium",
                "timeline": "1-2 weeks",
                "action_items": [
                    "Identify and prioritize critical vulnerabilities",
                    "Implement patches or workarounds",
                    "Verify fixes through testing",
                    "Update security policies"
                ]
            })
        
        # License recommendations
        if license_metrics["copyleft_percentage"].value > 25:
            recommendations.append({
                "category": "License Compliance",
                "priority": "High",
                "title": "Review Copyleft License Usage",
                "description": f"High copyleft usage ({license_metrics['copyleft_percentage'].value}%) may impact commercial products",
                "impact": "Medium",
                "effort": "Low",
                "timeline": "2-4 weeks",
                "action_items": [
                    "Audit copyleft packages",
                    "Assess commercial impact",
                    "Define license policy",
                    "Implement approval workflow"
                ]
            })
        
        # Workflow recommendations
        if workflow_metrics["workflow_completion_rate"].value < 80:
            recommendations.append({
                "category": "Operational Efficiency",
                "priority": "Medium",
                "title": "Improve Workflow Completion Rate",
                "description": f"Current completion rate ({workflow_metrics['workflow_completion_rate'].value}%) below target",
                "impact": "Medium",
                "effort": "Medium",
                "timeline": "4-6 weeks",
                "action_items": [
                    "Analyze failed workflows",
                    "Optimize approval processes",
                    "Implement automation",
                    "Train stakeholders"
                ]
            })
        
        return recommendations
    
    async def _format_report(
        self, 
        report_data: Dict[str, Any], 
        format: str,
        template: str = "default"
    ) -> Union[str, bytes, Dict]:
        """Format report in requested format."""
        
        if format == ReportFormat.JSON:
            return self._serialize_report_data(report_data)
        
        elif format == ReportFormat.HTML:
            return await self._generate_html_report(report_data, template)
        
        elif format == ReportFormat.PDF:
            html_content = await self._generate_html_report(report_data, template)
            return await self._convert_html_to_pdf(html_content)
        
        elif format == ReportFormat.XLSX:
            return await self._generate_excel_report(report_data)
        
        elif format == ReportFormat.CSV:
            return await self._generate_csv_report(report_data)
        
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def _serialize_report_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Serialize report data for JSON output."""
        def serialize_value(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            elif hasattr(obj, '__dict__'):
                return vars(obj)
            return obj
        
        return json.loads(json.dumps(data, default=serialize_value))
    
    async def _generate_html_report(self, report_data: Dict[str, Any], template: str = "default-apple-hig") -> str:
        """Generate HTML report using Jinja2 templates.
        
        Defaults to Apple HIG compliant template for better UX.
        """
        try:
            # Use Apple HIG template by default, fallback to requested template
            template_file = f"{template}.html"
            
            # Check if template exists, fallback to Apple HIG if not
            try:
                template_obj = self.jinja_env.get_template(template_file)
            except Exception:
                # Fallback to Apple HIG template
                if template != "default-apple-hig":
                    logger.warning(f"Template {template_file} not found, using default-apple-hig.html")
                    template_file = "default-apple-hig.html"
                    template_obj = self.jinja_env.get_template(template_file)
                else:
                    raise
            
            return template_obj.render(**report_data)
        except Exception as e:
            logger.error(f"Failed to generate HTML report: {e}", exc_info=True)
            # Fallback to basic HTML generation
            return self._generate_basic_html(report_data)
    
    def _generate_basic_html(self, report_data: Dict[str, Any]) -> str:
        """Generate basic HTML report as fallback."""
        html_parts = [
            "<!DOCTYPE html>",
            "<html><head><title>Compliance Report</title></head><body>",
            f"<h1>Compliance Report</h1>",
            f"<p>Generated: {report_data['report_metadata']['generated_at']}</p>",
            "<h2>Executive Summary</h2>",
            f"<p>Organization: {report_data.get('executive_summary', {}).get('organization_overview', {}).get('name', 'N/A')}</p>",
            "</body></html>"
        ]
        return "\n".join(html_parts)
    
    # Utility methods
    def _format_datetime(self, dt: datetime) -> str:
        """Format datetime for templates."""
        return dt.strftime("%Y-%m-%d %H:%M:%S UTC")
    
    def _format_percentage(self, value: float) -> str:
        """Format percentage for templates."""
        return f"{value:.1f}%"
    
    def _format_number(self, value: Union[int, float]) -> str:
        """Format numbers for templates."""
        return f"{value:,.1f}" if isinstance(value, float) else f"{value:,}"
    
    def _calculate_risk_level(self, security_metrics: Dict) -> str:
        """Calculate overall risk level."""
        critical_vulns = security_metrics["critical_vulnerabilities"].value
        avg_cvss = security_metrics["average_cvss_score"].value
        
        if critical_vulns > 0 or avg_cvss >= 8.0:
            return "CRITICAL"
        elif avg_cvss >= 6.0:
            return "HIGH"
        elif avg_cvss >= 4.0:
            return "MEDIUM"
        else:
            return "LOW"
    
    def _get_compliance_grade(self, score: float) -> str:
        """Get compliance grade based on score."""
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B" 
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"
    
    def _get_efficiency_grade(self, completion_rate: float) -> str:
        """Get efficiency grade based on completion rate."""
        if completion_rate >= 95:
            return "Excellent"
        elif completion_rate >= 85:
            return "Good"
        elif completion_rate >= 70:
            return "Fair"
        else:
            return "Needs Improvement"
    
    # Placeholder methods for complex calculations
    async def _calculate_policy_compliance_score(self, db: AsyncSession, org_id: UUID) -> float:
        """Calculate policy compliance score."""
        # Simplified implementation - would analyze policy adherence
        return 85.0
    
    async def _get_vulnerability_details(self, db: AsyncSession, org_id: UUID, time_range: TimeInterval) -> Dict:
        """Get detailed vulnerability information."""
        return {"detailed_vulnerabilities": "Implementation pending"}
    
    async def _calculate_risk_trends(self, db: AsyncSession, org_id: UUID, time_range: TimeInterval) -> Dict:
        """Calculate risk trends over time."""
        return {"trend": "stable"}
    
    def _calculate_overall_risk(self, security_metrics: Dict, license_metrics: Dict) -> str:
        """Calculate overall organizational risk."""
        return "MEDIUM"  # Simplified implementation


# Global report generator instance
report_generator = ReportGenerator()