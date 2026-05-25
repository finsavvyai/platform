"""
Helper functions for Advanced Analytics: recommendations, CSV/PDF report generation.
"""

import csv
import io
from typing import Any, Dict, List

from app.models.advanced_analytics import IntelligenceReport


async def generate_anomaly_recommendations(anomalies: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Generate recommendations based on detected anomalies."""
    recommendations: List[Dict[str, Any]] = []
    severity_counts: Dict[str, int] = {}
    for anomaly in anomalies:
        severity = anomaly.get("severity")
        severity_counts[severity] = severity_counts.get(severity, 0) + 1

    if severity_counts.get("critical", 0) > 0:
        recommendations.append({
            "type": "urgent_action",
            "priority": "critical",
            "title": "Critical anomalies detected",
            "description": f"{severity_counts['critical']} critical anomalies require immediate attention",
            "actions": [
                "Review and resolve critical anomalies immediately",
                "Implement emergency response procedures",
                "Notify relevant stakeholders",
            ],
            "estimated_impact": "Prevent potential system failures or data breaches",
        })

    if severity_counts.get("high", 0) > 3:
        recommendations.append({
            "type": "investigation",
            "priority": "high",
            "title": "High severity anomalies require attention",
            "description": f"{severity_counts['high']} high severity anomalies detected",
            "actions": [
                "Investigate root causes of high severity anomalies",
                "Review system performance metrics",
                "Consider temporary mitigations",
            ],
            "estimated_impact": "Improve system stability and performance",
        })

    cost_anomalies = [a for a in anomalies if a.get("metric_type") == "cost"]
    if cost_anomalies:
        recommendations.append({
            "type": "cost_optimization",
            "priority": "medium",
            "title": "Cost optimization opportunities identified",
            "description": f"{len(cost_anomalies)} cost-related anomalies detected",
            "actions": [
                "Review resource utilization and rightsizing",
                "Implement cost anomaly alerting",
                "Consider reserved instances for stable workloads",
            ],
            "estimated_impact": "Reduce monthly costs by 10-20%",
        })

    return recommendations


def generate_csv_report(report: IntelligenceReport) -> str:
    """Generate CSV content for a report."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Report Name", "Type", "Generated At",
        "Key Insights Count", "Recommendations Count",
    ])
    writer.writerow([
        report.report_name,
        report.report_type,
        report.generated_at.isoformat() if report.generated_at else "",
        len(report.key_insights or []),
        len(report.recommendations or []),
    ])
    writer.writerow([])
    writer.writerow(["Key Insights"])
    writer.writerow(["#", "Type", "Title", "Description"])
    for i, insight in enumerate(report.key_insights or [], 1):
        writer.writerow([
            i,
            insight.get("type", "N/A"),
            insight.get("title", "N/A"),
            insight.get("description", "N/A"),
        ])
    writer.writerow([])
    writer.writerow(["Recommendations"])
    writer.writerow(["#", "Category", "Priority", "Title", "Description"])
    for i, rec in enumerate(report.recommendations or [], 1):
        writer.writerow([
            i,
            rec.get("category", "N/A"),
            rec.get("priority", "N/A"),
            rec.get("title", "N/A"),
            rec.get("description", "N/A"),
        ])
    return output.getvalue()


def generate_pdf_report(report: IntelligenceReport) -> bytes:
    """Generate PDF content for a report (placeholder)."""
    content = f"""
    Intelligence Report: {report.report_name}

    Type: {report.report_type}
    Time Range: {report.time_range}
    Generated At: {report.generated_at}

    Executive Summary:
    {report.executive_summary}

    Key Insights: {len(report.key_insights or [])}
    Recommendations: {len(report.recommendations or [])}
    """
    return content.encode("utf-8")
