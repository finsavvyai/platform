"""
Analytics engine for dependency visualization.

Provides advanced analytics capabilities for dependency graphs,
vulnerability analysis, trend analysis, and risk assessment.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum
from dataclasses import dataclass, asdict
import numpy as np
import networkx as nx
from pydantic import BaseModel, Field

# Mock models for visualization
try:
    from udp.core.models import Dependency, Vulnerability, Project
except ImportError:
    # Mock models for testing
    from pydantic import BaseModel as PydanticBaseModel
    from datetime import datetime
    
    class Project(PydanticBaseModel):
        id: str
        name: str
        description: str
        ecosystem: str
        package_manager: str
        created_at: Optional[datetime] = None
        updated_at: Optional[datetime] = None
    
    class Dependency(PydanticBaseModel):
        id: str
        name: str
        version: str
        ecosystem: str
        is_direct: bool
        license: Optional[str] = None
        dependencies: Optional[List['Dependency']] = None
        vulnerabilities: Optional[List['Vulnerability']] = None
    
    class Vulnerability(PydanticBaseModel):
        id: str
        title: str
        description: str
        severity: str
        cvss_score: Optional[float] = None
        affected_dependencies: Optional[List[Dependency]] = None
from udp.ml.models import ModelManager
from .graph_visualizer import DependencyGraphVisualizer, GraphNode, GraphEdge


class AnalyticsType(str, Enum):
    """Types of analytics."""
    DEPENDENCY_ANALYSIS = "dependency_analysis"
    VULNERABILITY_ANALYSIS = "vulnerability_analysis"
    TREND_ANALYSIS = "trend_analysis"
    RISK_ANALYSIS = "risk_analysis"
    IMPACT_ANALYSIS = "impact_analysis"
    CORRELATION_ANALYSIS = "correlation_analysis"
    CLUSTERING_ANALYSIS = "clustering_analysis"
    CENTRALITY_ANALYSIS = "centrality_analysis"


@dataclass
class AnalyticsResult:
    """Result of an analytics operation."""
    analytics_type: AnalyticsType
    data: Dict[str, Any]
    insights: List[str]
    recommendations: List[str]
    confidence: float
    timestamp: datetime
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class DependencyAnalytics:
    """Analytics for dependency relationships."""
    
    def __init__(self, graph_visualizer: DependencyGraphVisualizer):
        """Initialize dependency analytics."""
        self.graph_visualizer = graph_visualizer
        self.model_manager = ModelManager()
    
    async def analyze_dependency_tree(self, root_node_id: str, max_depth: int = 5) -> AnalyticsResult:
        """Analyze dependency tree structure."""
        try:
            # Get dependency tree
            tree_data = await self._get_dependency_tree(root_node_id, max_depth)
            
            # Calculate metrics
            metrics = self._calculate_tree_metrics(tree_data)
            
            # Generate insights
            insights = self._generate_tree_insights(metrics)
            
            # Generate recommendations
            recommendations = self._generate_tree_recommendations(metrics)
            
            return AnalyticsResult(
                analytics_type=AnalyticsType.DEPENDENCY_ANALYSIS,
                data={
                    "tree_data": tree_data,
                    "metrics": metrics,
                    "root_node": root_node_id,
                    "max_depth": max_depth
                },
                insights=insights,
                recommendations=recommendations,
                confidence=0.85,
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            raise Exception(f"Failed to analyze dependency tree: {e}")
    
    async def _get_dependency_tree(self, root_node_id: str, max_depth: int) -> Dict[str, Any]:
        """Get dependency tree data."""
        tree = {
            "root": root_node_id,
            "nodes": {},
            "edges": [],
            "depth": 0
        }
        
        visited = set()
        queue = [(root_node_id, 0)]
        
        while queue:
            node_id, depth = queue.pop(0)
            
            if depth > max_depth or node_id in visited:
                continue
            
            visited.add(node_id)
            
            if node_id in self.graph_visualizer.nodes:
                node = self.graph_visualizer.nodes[node_id]
                tree["nodes"][node_id] = {
                    "id": node.id,
                    "label": node.label,
                    "type": node.node_type.value,
                    "data": node.data,
                    "depth": depth
                }
                
                # Add children
                if node_id in self.graph_visualizer.graph:
                    for neighbor in self.graph_visualizer.graph.neighbors(node_id):
                        if neighbor not in visited:
                            queue.append((neighbor, depth + 1))
                            
                            # Add edge
                            edge_id = f"{node_id}_{neighbor}"
                            if edge_id in self.graph_visualizer.edges:
                                edge = self.graph_visualizer.edges[edge_id]
                                tree["edges"].append({
                                    "source": node_id,
                                    "target": neighbor,
                                    "type": edge.edge_type.value,
                                    "weight": edge.weight
                                })
        
        tree["depth"] = max([node["depth"] for node in tree["nodes"].values()]) if tree["nodes"] else 0
        return tree
    
    def _calculate_tree_metrics(self, tree_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate tree structure metrics."""
        nodes = tree_data["nodes"]
        edges = tree_data["edges"]
        
        # Basic metrics
        total_nodes = len(nodes)
        total_edges = len(edges)
        max_depth = tree_data["depth"]
        
        # Node type distribution
        node_types = {}
        for node in nodes.values():
            node_type = node["type"]
            node_types[node_type] = node_types.get(node_type, 0) + 1
        
        # Depth distribution
        depth_distribution = {}
        for node in nodes.values():
            depth = node["depth"]
            depth_distribution[depth] = depth_distribution.get(depth, 0) + 1
        
        # Calculate branching factor
        branching_factors = []
        for depth in range(max_depth):
            nodes_at_depth = depth_distribution.get(depth, 0)
            nodes_at_next_depth = depth_distribution.get(depth + 1, 0)
            if nodes_at_depth > 0:
                branching_factors.append(nodes_at_next_depth / nodes_at_depth)
        
        avg_branching_factor = sum(branching_factors) / len(branching_factors) if branching_factors else 0
        
        # Calculate tree balance
        balance_score = self._calculate_tree_balance(depth_distribution)
        
        return {
            "total_nodes": total_nodes,
            "total_edges": total_edges,
            "max_depth": max_depth,
            "node_types": node_types,
            "depth_distribution": depth_distribution,
            "avg_branching_factor": avg_branching_factor,
            "balance_score": balance_score,
            "tree_density": total_edges / total_nodes if total_nodes > 0 else 0
        }
    
    def _calculate_tree_balance(self, depth_distribution: Dict[int, int]) -> float:
        """Calculate tree balance score."""
        if not depth_distribution:
            return 0.0
        
        depths = list(depth_distribution.keys())
        if len(depths) <= 1:
            return 1.0
        
        # Calculate variance in depth distribution
        total_nodes = sum(depth_distribution.values())
        mean_depth = sum(depth * count for depth, count in depth_distribution.items()) / total_nodes
        
        variance = sum(count * (depth - mean_depth) ** 2 for depth, count in depth_distribution.items()) / total_nodes
        
        # Normalize to 0-1 scale (lower variance = more balanced)
        max_variance = len(depths) ** 2 / 4  # Theoretical maximum variance
        balance_score = max(0, 1 - (variance / max_variance))
        
        return balance_score
    
    def _generate_tree_insights(self, metrics: Dict[str, Any]) -> List[str]:
        """Generate insights from tree metrics."""
        insights = []
        
        # Depth insights
        if metrics["max_depth"] > 10:
            insights.append(f"Deep dependency tree with {metrics['max_depth']} levels - consider flattening")
        elif metrics["max_depth"] < 3:
            insights.append("Shallow dependency tree - good for maintainability")
        
        # Branching factor insights
        if metrics["avg_branching_factor"] > 5:
            insights.append("High branching factor - many dependencies per package")
        elif metrics["avg_branching_factor"] < 2:
            insights.append("Low branching factor - minimal dependencies")
        
        # Balance insights
        if metrics["balance_score"] < 0.3:
            insights.append("Unbalanced dependency tree - some paths much deeper than others")
        elif metrics["balance_score"] > 0.8:
            insights.append("Well-balanced dependency tree structure")
        
        # Node type insights
        package_count = metrics["node_types"].get("package", 0)
        vuln_count = metrics["node_types"].get("vulnerability", 0)
        
        if vuln_count > 0:
            vuln_ratio = vuln_count / package_count if package_count > 0 else 0
            if vuln_ratio > 0.2:
                insights.append(f"High vulnerability ratio ({vuln_ratio:.1%}) - security review needed")
            elif vuln_ratio < 0.05:
                insights.append("Low vulnerability ratio - good security posture")
        
        return insights
    
    def _generate_tree_recommendations(self, metrics: Dict[str, Any]) -> List[str]:
        """Generate recommendations from tree metrics."""
        recommendations = []
        
        # Depth recommendations
        if metrics["max_depth"] > 10:
            recommendations.append("Consider breaking down deep dependency chains")
            recommendations.append("Review if all transitive dependencies are necessary")
        
        # Branching factor recommendations
        if metrics["avg_branching_factor"] > 5:
            recommendations.append("Audit dependencies to remove unused packages")
            recommendations.append("Consider using dependency bundling")
        
        # Balance recommendations
        if metrics["balance_score"] < 0.3:
            recommendations.append("Restructure dependencies to improve balance")
            recommendations.append("Consider using dependency injection patterns")
        
        # Security recommendations
        vuln_count = metrics["node_types"].get("vulnerability", 0)
        if vuln_count > 0:
            recommendations.append("Update vulnerable dependencies to latest versions")
            recommendations.append("Implement automated vulnerability scanning")
            recommendations.append("Consider using dependency pinning")
        
        return recommendations
    
    async def analyze_dependency_cycles(self) -> AnalyticsResult:
        """Analyze dependency cycles in the graph."""
        try:
            # Find cycles
            cycles = list(nx.simple_cycles(self.graph_visualizer.graph))
            
            # Analyze cycle characteristics
            cycle_analysis = self._analyze_cycles(cycles)
            
            # Generate insights
            insights = self._generate_cycle_insights(cycle_analysis)
            
            # Generate recommendations
            recommendations = self._generate_cycle_recommendations(cycle_analysis)
            
            return AnalyticsResult(
                analytics_type=AnalyticsType.DEPENDENCY_ANALYSIS,
                data={
                    "cycles": cycles,
                    "cycle_analysis": cycle_analysis,
                    "total_cycles": len(cycles)
                },
                insights=insights,
                recommendations=recommendations,
                confidence=0.9,
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            raise Exception(f"Failed to analyze dependency cycles: {e}")
    
    def _analyze_cycles(self, cycles: List[List[str]]) -> Dict[str, Any]:
        """Analyze cycle characteristics."""
        if not cycles:
            return {
                "total_cycles": 0,
                "cycle_lengths": [],
                "involved_nodes": set(),
                "cycle_types": {},
                "severity_scores": []
            }
        
        cycle_lengths = [len(cycle) for cycle in cycles]
        involved_nodes = set()
        for cycle in cycles:
            involved_nodes.update(cycle)
        
        # Analyze cycle types
        cycle_types = {}
        severity_scores = []
        
        for cycle in cycles:
            # Determine cycle type based on node types
            node_types = []
            for node_id in cycle:
                if node_id in self.graph_visualizer.nodes:
                    node_types.append(self.graph_visualizer.nodes[node_id].node_type.value)
            
            cycle_type = "_".join(sorted(set(node_types)))
            cycle_types[cycle_type] = cycle_types.get(cycle_type, 0) + 1
            
            # Calculate severity score
            severity_score = self._calculate_cycle_severity(cycle)
            severity_scores.append(severity_score)
        
        return {
            "total_cycles": len(cycles),
            "cycle_lengths": cycle_lengths,
            "involved_nodes": list(involved_nodes),
            "cycle_types": cycle_types,
            "severity_scores": severity_scores,
            "avg_cycle_length": sum(cycle_lengths) / len(cycle_lengths),
            "max_cycle_length": max(cycle_lengths),
            "min_cycle_length": min(cycle_lengths)
        }
    
    def _calculate_cycle_severity(self, cycle: List[str]) -> float:
        """Calculate severity score for a cycle."""
        severity = 0.0
        
        for node_id in cycle:
            if node_id in self.graph_visualizer.nodes:
                node = self.graph_visualizer.nodes[node_id]
                
                # Base severity by node type
                if node.node_type.value == "vulnerability":
                    severity += 0.5
                elif node.node_type.value == "package":
                    severity += 0.3
                else:
                    severity += 0.1
                
                # Add severity based on vulnerabilities
                if "vulnerability_id" in node.data:
                    severity += 0.2
        
        return min(severity, 1.0)
    
    def _generate_cycle_insights(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate insights from cycle analysis."""
        insights = []
        
        if analysis["total_cycles"] == 0:
            insights.append("No dependency cycles detected - good architecture")
            return insights
        
        insights.append(f"Found {analysis['total_cycles']} dependency cycles")
        
        # Cycle length insights
        if analysis["avg_cycle_length"] > 5:
            insights.append("Long dependency cycles detected - potential architectural issues")
        elif analysis["avg_cycle_length"] < 3:
            insights.append("Short dependency cycles - may be acceptable")
        
        # Severity insights
        high_severity_cycles = sum(1 for score in analysis["severity_scores"] if score > 0.7)
        if high_severity_cycles > 0:
            insights.append(f"{high_severity_cycles} high-severity cycles detected")
        
        # Node involvement insights
        involved_ratio = len(analysis["involved_nodes"]) / len(self.graph_visualizer.nodes)
        if involved_ratio > 0.3:
            insights.append("Many nodes involved in cycles - widespread architectural issues")
        
        return insights
    
    def _generate_cycle_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate recommendations from cycle analysis."""
        recommendations = []
        
        if analysis["total_cycles"] == 0:
            return recommendations
        
        recommendations.append("Break dependency cycles to improve architecture")
        recommendations.append("Consider using dependency injection")
        recommendations.append("Review module boundaries and responsibilities")
        
        # Specific recommendations based on cycle types
        for cycle_type, count in analysis["cycle_types"].items():
            if "vulnerability" in cycle_type:
                recommendations.append("Address vulnerability-related cycles immediately")
            elif "package" in cycle_type:
                recommendations.append("Refactor package dependencies to eliminate cycles")
        
        return recommendations


class VulnerabilityAnalytics:
    """Analytics for vulnerability analysis."""
    
    def __init__(self, graph_visualizer: DependencyGraphVisualizer):
        """Initialize vulnerability analytics."""
        self.graph_visualizer = graph_visualizer
    
    async def analyze_vulnerability_impact(self) -> AnalyticsResult:
        """Analyze the impact of vulnerabilities on the dependency graph."""
        try:
            # Get vulnerability data
            vulnerability_data = self._get_vulnerability_data()
            
            # Calculate impact metrics
            impact_metrics = self._calculate_impact_metrics(vulnerability_data)
            
            # Generate insights
            insights = self._generate_vulnerability_insights(impact_metrics)
            
            # Generate recommendations
            recommendations = self._generate_vulnerability_recommendations(impact_metrics)
            
            return AnalyticsResult(
                analytics_type=AnalyticsType.VULNERABILITY_ANALYSIS,
                data={
                    "vulnerability_data": vulnerability_data,
                    "impact_metrics": impact_metrics
                },
                insights=insights,
                recommendations=recommendations,
                confidence=0.9,
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            raise Exception(f"Failed to analyze vulnerability impact: {e}")
    
    def _get_vulnerability_data(self) -> Dict[str, Any]:
        """Get vulnerability data from the graph."""
        vulnerabilities = []
        affected_packages = set()
        
        for node in self.graph_visualizer.nodes.values():
            if node.node_type.value == "vulnerability":
                vuln_data = {
                    "id": node.id,
                    "title": node.data.get("title", ""),
                    "severity": node.data.get("severity", "UNKNOWN"),
                    "cvss_score": node.data.get("cvss_score", 0.0),
                    "affected_packages": []
                }
                
                # Find affected packages
                for edge in self.graph_visualizer.edges.values():
                    if edge.target == node.id and edge.edge_type.value == "vulnerable_to":
                        package_id = edge.source
                        if package_id in self.graph_visualizer.nodes:
                            package_node = self.graph_visualizer.nodes[package_id]
                            vuln_data["affected_packages"].append({
                                "id": package_id,
                                "name": package_node.data.get("name", ""),
                                "version": package_node.data.get("version", "")
                            })
                            affected_packages.add(package_id)
                
                vulnerabilities.append(vuln_data)
        
        return {
            "vulnerabilities": vulnerabilities,
            "affected_packages": list(affected_packages),
            "total_vulnerabilities": len(vulnerabilities),
            "total_affected_packages": len(affected_packages)
        }
    
    def _calculate_impact_metrics(self, vulnerability_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate vulnerability impact metrics."""
        vulnerabilities = vulnerability_data["vulnerabilities"]
        
        # Severity distribution
        severity_distribution = {}
        cvss_scores = []
        
        for vuln in vulnerabilities:
            severity = vuln["severity"]
            severity_distribution[severity] = severity_distribution.get(severity, 0) + 1
            
            if vuln["cvss_score"] > 0:
                cvss_scores.append(vuln["cvss_score"])
        
        # Impact metrics
        total_vulns = len(vulnerabilities)
        critical_vulns = severity_distribution.get("CRITICAL", 0)
        high_vulns = severity_distribution.get("HIGH", 0)
        medium_vulns = severity_distribution.get("MEDIUM", 0)
        low_vulns = severity_distribution.get("LOW", 0)
        
        # Calculate risk scores
        risk_score = 0.0
        if total_vulns > 0:
            risk_score = (critical_vulns * 4 + high_vulns * 3 + medium_vulns * 2 + low_vulns * 1) / total_vulns
        
        # CVSS statistics
        avg_cvss = sum(cvss_scores) / len(cvss_scores) if cvss_scores else 0
        max_cvss = max(cvss_scores) if cvss_scores else 0
        min_cvss = min(cvss_scores) if cvss_scores else 0
        
        # Package impact
        packages_per_vuln = []
        for vuln in vulnerabilities:
            packages_per_vuln.append(len(vuln["affected_packages"]))
        
        avg_packages_per_vuln = sum(packages_per_vuln) / len(packages_per_vuln) if packages_per_vuln else 0
        
        return {
            "total_vulnerabilities": total_vulns,
            "severity_distribution": severity_distribution,
            "critical_vulnerabilities": critical_vulns,
            "high_vulnerabilities": high_vulns,
            "medium_vulnerabilities": medium_vulns,
            "low_vulnerabilities": low_vulns,
            "risk_score": risk_score,
            "cvss_scores": {
                "average": avg_cvss,
                "maximum": max_cvss,
                "minimum": min_cvss,
                "count": len(cvss_scores)
            },
            "package_impact": {
                "total_affected": vulnerability_data["total_affected_packages"],
                "average_per_vulnerability": avg_packages_per_vuln
            }
        }
    
    def _generate_vulnerability_insights(self, metrics: Dict[str, Any]) -> List[str]:
        """Generate insights from vulnerability metrics."""
        insights = []
        
        # Risk level insights
        if metrics["risk_score"] > 3.0:
            insights.append("High overall risk score - immediate attention required")
        elif metrics["risk_score"] > 2.0:
            insights.append("Moderate risk score - plan remediation")
        elif metrics["risk_score"] > 1.0:
            insights.append("Low risk score - monitor and plan updates")
        else:
            insights.append("Very low risk score - good security posture")
        
        # Critical vulnerabilities
        if metrics["critical_vulnerabilities"] > 0:
            insights.append(f"{metrics['critical_vulnerabilities']} critical vulnerabilities require immediate patching")
        
        # High vulnerabilities
        if metrics["high_vulnerabilities"] > 5:
            insights.append(f"{metrics['high_vulnerabilities']} high-severity vulnerabilities need attention")
        
        # CVSS insights
        if metrics["cvss_scores"]["average"] > 7.0:
            insights.append("High average CVSS score indicates significant security risk")
        elif metrics["cvss_scores"]["average"] < 3.0:
            insights.append("Low average CVSS score - good security baseline")
        
        # Package impact insights
        if metrics["package_impact"]["average_per_vulnerability"] > 5:
            insights.append("Vulnerabilities affect many packages - widespread impact")
        
        return insights
    
    def _generate_vulnerability_recommendations(self, metrics: Dict[str, Any]) -> List[str]:
        """Generate recommendations from vulnerability metrics."""
        recommendations = []
        
        # Priority recommendations
        if metrics["critical_vulnerabilities"] > 0:
            recommendations.append("Immediately patch critical vulnerabilities")
            recommendations.append("Implement emergency security procedures")
        
        if metrics["high_vulnerabilities"] > 0:
            recommendations.append("Schedule high-priority vulnerability patches")
            recommendations.append("Review affected packages for alternatives")
        
        # General recommendations
        recommendations.append("Implement automated vulnerability scanning")
        recommendations.append("Set up security alerts and notifications")
        recommendations.append("Create vulnerability remediation workflow")
        recommendations.append("Regular security audits and dependency updates")
        
        # CVSS-based recommendations
        if metrics["cvss_scores"]["average"] > 7.0:
            recommendations.append("Conduct comprehensive security review")
            recommendations.append("Consider using security-focused dependency management")
        
        return recommendations


class TrendAnalytics:
    """Analytics for trend analysis."""
    
    def __init__(self, graph_visualizer: DependencyGraphVisualizer):
        """Initialize trend analytics."""
        self.graph_visualizer = graph_visualizer
        self.model_manager = ModelManager()
    
    async def analyze_dependency_trends(self, time_range: Tuple[datetime, datetime]) -> AnalyticsResult:
        """Analyze dependency trends over time."""
        try:
            # Get trend data
            trend_data = await self._get_trend_data(time_range)
            
            # Calculate trend metrics
            trend_metrics = self._calculate_trend_metrics(trend_data)
            
            # Generate insights
            insights = self._generate_trend_insights(trend_metrics)
            
            # Generate recommendations
            recommendations = self._generate_trend_recommendations(trend_metrics)
            
            return AnalyticsResult(
                analytics_type=AnalyticsType.TREND_ANALYSIS,
                data={
                    "trend_data": trend_data,
                    "trend_metrics": trend_metrics,
                    "time_range": {
                        "start": time_range[0].isoformat(),
                        "end": time_range[1].isoformat()
                    }
                },
                insights=insights,
                recommendations=recommendations,
                confidence=0.8,
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            raise Exception(f"Failed to analyze dependency trends: {e}")
    
    async def _get_trend_data(self, time_range: Tuple[datetime, datetime]) -> Dict[str, Any]:
        """Get trend data for the specified time range."""
        # This would typically come from historical data
        # For now, we'll simulate trend data based on current graph state
        
        trend_data = {
            "dependency_growth": [],
            "vulnerability_trends": [],
            "ecosystem_changes": [],
            "license_changes": [],
            "version_updates": []
        }
        
        # Simulate dependency growth
        current_deps = len([n for n in self.graph_visualizer.nodes.values() if n.node_type.value == "package"])
        for i in range(30):  # 30 days of data
            date = time_range[0] + timedelta(days=i)
            growth = current_deps * (1 + np.random.normal(0.01, 0.05))  # 1% growth with noise
            trend_data["dependency_growth"].append({
                "date": date.isoformat(),
                "count": max(0, int(growth))
            })
        
        # Simulate vulnerability trends
        current_vulns = len([n for n in self.graph_visualizer.nodes.values() if n.node_type.value == "vulnerability"])
        for i in range(30):
            date = time_range[0] + timedelta(days=i)
            vuln_count = current_vulns * (1 + np.random.normal(0.02, 0.1))  # 2% growth with noise
            trend_data["vulnerability_trends"].append({
                "date": date.isoformat(),
                "count": max(0, int(vuln_count))
            })
        
        return trend_data
    
    def _calculate_trend_metrics(self, trend_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate trend metrics."""
        metrics = {}
        
        # Dependency growth metrics
        dep_growth = trend_data["dependency_growth"]
        if dep_growth:
            dep_counts = [d["count"] for d in dep_growth]
            metrics["dependency_growth"] = {
                "start_count": dep_counts[0],
                "end_count": dep_counts[-1],
                "total_growth": dep_counts[-1] - dep_counts[0],
                "growth_rate": (dep_counts[-1] - dep_counts[0]) / dep_counts[0] if dep_counts[0] > 0 else 0,
                "average_daily_growth": np.mean(np.diff(dep_counts)),
                "volatility": np.std(dep_counts)
            }
        
        # Vulnerability trend metrics
        vuln_trends = trend_data["vulnerability_trends"]
        if vuln_trends:
            vuln_counts = [v["count"] for v in vuln_trends]
            metrics["vulnerability_trends"] = {
                "start_count": vuln_counts[0],
                "end_count": vuln_counts[-1],
                "total_change": vuln_counts[-1] - vuln_counts[0],
                "change_rate": (vuln_counts[-1] - vuln_counts[0]) / vuln_counts[0] if vuln_counts[0] > 0 else 0,
                "average_daily_change": np.mean(np.diff(vuln_counts)),
                "volatility": np.std(vuln_counts)
            }
        
        return metrics
    
    def _generate_trend_insights(self, metrics: Dict[str, Any]) -> List[str]:
        """Generate insights from trend metrics."""
        insights = []
        
        # Dependency growth insights
        if "dependency_growth" in metrics:
            growth_rate = metrics["dependency_growth"]["growth_rate"]
            if growth_rate > 0.1:
                insights.append(f"Rapid dependency growth ({growth_rate:.1%}) - monitor for bloat")
            elif growth_rate < -0.05:
                insights.append("Dependency count decreasing - good cleanup effort")
            else:
                insights.append("Stable dependency growth - healthy maintenance")
        
        # Vulnerability trend insights
        if "vulnerability_trends" in metrics:
            vuln_change = metrics["vulnerability_trends"]["change_rate"]
            if vuln_change > 0.2:
                insights.append("Increasing vulnerability count - security review needed")
            elif vuln_change < -0.1:
                insights.append("Decreasing vulnerability count - good security practices")
            else:
                insights.append("Stable vulnerability count - maintain current practices")
        
        return insights
    
    def _generate_trend_recommendations(self, metrics: Dict[str, Any]) -> List[str]:
        """Generate recommendations from trend metrics."""
        recommendations = []
        
        # Dependency growth recommendations
        if "dependency_growth" in metrics:
            growth_rate = metrics["dependency_growth"]["growth_rate"]
            if growth_rate > 0.1:
                recommendations.append("Implement dependency auditing process")
                recommendations.append("Set up automated dependency cleanup")
            elif growth_rate < -0.05:
                recommendations.append("Continue dependency cleanup efforts")
        
        # Vulnerability trend recommendations
        if "vulnerability_trends" in metrics:
            vuln_change = metrics["vulnerability_trends"]["change_rate"]
            if vuln_change > 0.2:
                recommendations.append("Accelerate vulnerability remediation")
                recommendations.append("Implement proactive security scanning")
            elif vuln_change < -0.1:
                recommendations.append("Maintain current security practices")
        
        return recommendations


class RiskAnalytics:
    """Analytics for risk assessment."""
    
    def __init__(self, graph_visualizer: DependencyGraphVisualizer):
        """Initialize risk analytics."""
        self.graph_visualizer = graph_visualizer
        self.model_manager = ModelManager()
    
    async def analyze_risk_distribution(self) -> AnalyticsResult:
        """Analyze risk distribution across the dependency graph."""
        try:
            # Calculate risk scores for all nodes
            risk_scores = await self._calculate_node_risk_scores()
            
            # Analyze risk distribution
            risk_distribution = self._analyze_risk_distribution(risk_scores)
            
            # Generate insights
            insights = self._generate_risk_insights(risk_distribution)
            
            # Generate recommendations
            recommendations = self._generate_risk_recommendations(risk_distribution)
            
            return AnalyticsResult(
                analytics_type=AnalyticsType.RISK_ANALYSIS,
                data={
                    "risk_scores": risk_scores,
                    "risk_distribution": risk_distribution
                },
                insights=insights,
                recommendations=recommendations,
                confidence=0.85,
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            raise Exception(f"Failed to analyze risk distribution: {e}")
    
    async def _calculate_node_risk_scores(self) -> Dict[str, float]:
        """Calculate risk scores for all nodes."""
        risk_scores = {}
        
        for node_id, node in self.graph_visualizer.nodes.items():
            risk_score = 0.0
            
            # Base risk by node type
            if node.node_type.value == "vulnerability":
                risk_score += 0.8
            elif node.node_type.value == "package":
                risk_score += 0.3
            else:
                risk_score += 0.1
            
            # Add risk based on vulnerabilities
            if "vulnerability_id" in node.data:
                risk_score += 0.2
            
            # Add risk based on CVSS score
            if "cvss_score" in node.data:
                cvss_score = node.data["cvss_score"]
                risk_score += cvss_score / 10.0
            
            # Add risk based on centrality (if node is central, it's riskier)
            if node_id in self.graph_visualizer.graph:
                degree = self.graph_visualizer.graph.degree(node_id)
                max_degree = max([self.graph_visualizer.graph.degree(n) for n in self.graph_visualizer.graph.nodes()])
                if max_degree > 0:
                    centrality_risk = degree / max_degree * 0.3
                    risk_score += centrality_risk
            
            risk_scores[node_id] = min(risk_score, 1.0)
        
        return risk_scores
    
    def _analyze_risk_distribution(self, risk_scores: Dict[str, float]) -> Dict[str, Any]:
        """Analyze risk distribution across nodes."""
        scores = list(risk_scores.values())
        
        if not scores:
            return {
                "total_nodes": 0,
                "risk_levels": {},
                "statistics": {},
                "high_risk_nodes": [],
                "risk_clusters": {}
            }
        
        # Risk level distribution
        risk_levels = {
            "LOW": 0,
            "MEDIUM": 0,
            "HIGH": 0,
            "CRITICAL": 0
        }
        
        for score in scores:
            if score >= 0.8:
                risk_levels["CRITICAL"] += 1
            elif score >= 0.6:
                risk_levels["HIGH"] += 1
            elif score >= 0.4:
                risk_levels["MEDIUM"] += 1
            else:
                risk_levels["LOW"] += 1
        
        # Statistics
        statistics = {
            "mean": np.mean(scores),
            "median": np.median(scores),
            "std": np.std(scores),
            "min": np.min(scores),
            "max": np.max(scores),
            "percentile_25": np.percentile(scores, 25),
            "percentile_75": np.percentile(scores, 75),
            "percentile_90": np.percentile(scores, 90),
            "percentile_95": np.percentile(scores, 95)
        }
        
        # High risk nodes
        high_risk_nodes = [
            {"node_id": node_id, "risk_score": score}
            for node_id, score in risk_scores.items()
            if score >= 0.7
        ]
        high_risk_nodes.sort(key=lambda x: x["risk_score"], reverse=True)
        
        # Risk clusters (group nodes by similar risk levels)
        risk_clusters = {
            "critical": [node_id for node_id, score in risk_scores.items() if score >= 0.8],
            "high": [node_id for node_id, score in risk_scores.items() if 0.6 <= score < 0.8],
            "medium": [node_id for node_id, score in risk_scores.items() if 0.4 <= score < 0.6],
            "low": [node_id for node_id, score in risk_scores.items() if score < 0.4]
        }
        
        return {
            "total_nodes": len(scores),
            "risk_levels": risk_levels,
            "statistics": statistics,
            "high_risk_nodes": high_risk_nodes,
            "risk_clusters": risk_clusters
        }
    
    def _generate_risk_insights(self, distribution: Dict[str, Any]) -> List[str]:
        """Generate insights from risk distribution."""
        insights = []
        
        # Overall risk insights
        total_nodes = distribution["total_nodes"]
        critical_count = distribution["risk_levels"]["CRITICAL"]
        high_count = distribution["risk_levels"]["HIGH"]
        
        if critical_count > 0:
            critical_ratio = critical_count / total_nodes
            insights.append(f"{critical_count} critical risk nodes ({critical_ratio:.1%}) - immediate attention required")
        
        if high_count > 0:
            high_ratio = high_count / total_nodes
            insights.append(f"{high_count} high risk nodes ({high_ratio:.1%}) - plan remediation")
        
        # Risk distribution insights
        mean_risk = distribution["statistics"]["mean"]
        if mean_risk > 0.6:
            insights.append("High average risk score - comprehensive review needed")
        elif mean_risk < 0.3:
            insights.append("Low average risk score - good risk management")
        
        # Risk concentration insights
        high_risk_nodes = distribution["high_risk_nodes"]
        if len(high_risk_nodes) > total_nodes * 0.2:
            insights.append("High concentration of risk nodes - systemic issues")
        
        return insights
    
    def _generate_risk_recommendations(self, distribution: Dict[str, Any]) -> List[str]:
        """Generate recommendations from risk distribution."""
        recommendations = []
        
        # Priority recommendations
        critical_count = distribution["risk_levels"]["CRITICAL"]
        high_count = distribution["risk_levels"]["HIGH"]
        
        if critical_count > 0:
            recommendations.append("Immediately address critical risk nodes")
            recommendations.append("Implement emergency risk mitigation procedures")
        
        if high_count > 0:
            recommendations.append("Create high-priority risk remediation plan")
            recommendations.append("Assign dedicated resources for high-risk items")
        
        # General recommendations
        recommendations.append("Implement continuous risk monitoring")
        recommendations.append("Create risk-based prioritization framework")
        recommendations.append("Establish risk tolerance thresholds")
        recommendations.append("Regular risk assessment and review cycles")
        
        # Risk management recommendations
        mean_risk = distribution["statistics"]["mean"]
        if mean_risk > 0.6:
            recommendations.append("Conduct comprehensive risk assessment")
            recommendations.append("Implement risk reduction strategies")
        
        return recommendations


class AnalyticsEngine:
    """Main analytics engine that coordinates all analytics types."""
    
    def __init__(self, graph_visualizer: DependencyGraphVisualizer):
        """Initialize the analytics engine."""
        self.graph_visualizer = graph_visualizer
        self.dependency_analytics = DependencyAnalytics(graph_visualizer)
        self.vulnerability_analytics = VulnerabilityAnalytics(graph_visualizer)
        self.trend_analytics = TrendAnalytics(graph_visualizer)
        self.risk_analytics = RiskAnalytics(graph_visualizer)
        
        self.analytics_results: Dict[str, AnalyticsResult] = {}
        self.analytics_callbacks: List[callable] = []
    
    async def run_analytics(self, analytics_types: List[AnalyticsType], **kwargs) -> Dict[str, AnalyticsResult]:
        """Run multiple analytics types."""
        results = {}
        
        for analytics_type in analytics_types:
            try:
                result = await self._run_single_analytics(analytics_type, **kwargs)
                results[analytics_type.value] = result
                self.analytics_results[analytics_type.value] = result
                
                # Notify callbacks
                await self._notify_analytics_callbacks(analytics_type, result)
                
            except Exception as e:
                print(f"Error running {analytics_type.value}: {e}")
        
        return results
    
    async def _run_single_analytics(self, analytics_type: AnalyticsType, **kwargs) -> AnalyticsResult:
        """Run a single analytics type."""
        if analytics_type == AnalyticsType.DEPENDENCY_ANALYSIS:
            if "root_node_id" in kwargs:
                return await self.dependency_analytics.analyze_dependency_tree(
                    kwargs["root_node_id"], kwargs.get("max_depth", 5)
                )
            else:
                return await self.dependency_analytics.analyze_dependency_cycles()
        
        elif analytics_type == AnalyticsType.VULNERABILITY_ANALYSIS:
            return await self.vulnerability_analytics.analyze_vulnerability_impact()
        
        elif analytics_type == AnalyticsType.TREND_ANALYSIS:
            time_range = kwargs.get("time_range", (datetime.utcnow() - timedelta(days=30), datetime.utcnow()))
            return await self.trend_analytics.analyze_dependency_trends(time_range)
        
        elif analytics_type == AnalyticsType.RISK_ANALYSIS:
            return await self.risk_analytics.analyze_risk_distribution()
        
        else:
            raise ValueError(f"Unknown analytics type: {analytics_type}")
    
    async def get_analytics_summary(self) -> Dict[str, Any]:
        """Get a summary of all analytics results."""
        summary = {
            "total_analytics": len(self.analytics_results),
            "analytics_types": list(self.analytics_results.keys()),
            "last_updated": max([result.timestamp for result in self.analytics_results.values()]).isoformat() if self.analytics_results else None,
            "results": {}
        }
        
        for analytics_type, result in self.analytics_results.items():
            summary["results"][analytics_type] = {
                "insights": result.insights,
                "recommendations": result.recommendations,
                "confidence": result.confidence,
                "timestamp": result.timestamp.isoformat()
            }
        
        return summary
    
    def add_analytics_callback(self, callback: callable):
        """Add a callback for analytics updates."""
        self.analytics_callbacks.append(callback)
    
    async def _notify_analytics_callbacks(self, analytics_type: AnalyticsType, result: AnalyticsResult):
        """Notify analytics callbacks."""
        for callback in self.analytics_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(analytics_type, result)
                else:
                    callback(analytics_type, result)
            except Exception as e:
                print(f"Error in analytics callback: {e}")
