"""
NetworkX Dependency Graph Analysis.

Provides comprehensive dependency graph analysis using NetworkX for
visualization, metrics calculation, and graph-based insights.
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Optional, Union

import networkx as nx

logger = logging.getLogger(__name__)


class GraphMetricType(str, Enum):
    """Types of graph metrics."""
    CENTRALITY = "centrality"
    CONNECTIVITY = "connectivity"
    STRUCTURE = "structure"
    VULNERABILITY = "vulnerability"
    PERFORMANCE = "performance"


class CentralityType(str, Enum):
    """Types of centrality measures."""
    DEGREE = "degree"
    BETWEENNESS = "betweenness"
    CLOSENESS = "closeness"
    EIGENVECTOR = "eigenvector"
    PAGERANK = "pagerank"
    HARMONIC = "harmonic"


@dataclass
class GraphNode:
    """Graph node representation."""
    id: str
    name: str
    version: str
    ecosystem: str
    node_type: str
    attributes: dict[str, Any]


@dataclass
class GraphEdge:
    """Graph edge representation."""
    source: str
    target: str
    edge_type: str
    weight: float
    attributes: dict[str, Any]


@dataclass
class GraphMetrics:
    """Graph metrics container."""
    node_count: int
    edge_count: int
    density: float
    diameter: int
    radius: int
    average_clustering: float
    transitivity: float
    assortativity: float
    modularity: float
    connected_components: int
    largest_component_size: int


@dataclass
class CentralityMetrics:
    """Centrality metrics container."""
    degree_centrality: dict[str, float]
    betweenness_centrality: dict[str, float]
    closeness_centrality: dict[str, float]
    eigenvector_centrality: dict[str, float]
    pagerank: dict[str, float]
    harmonic_centrality: dict[str, float]


@dataclass
class VulnerabilityAnalysis:
    """Vulnerability analysis results."""
    critical_nodes: list[str]
    single_points_of_failure: list[str]
    attack_surface: float
    resilience_score: float
    vulnerability_paths: list[list[str]]


@dataclass
class GraphAnalysisResult:
    """Complete graph analysis result."""
    graph_metrics: GraphMetrics
    centrality_metrics: CentralityMetrics
    vulnerability_analysis: VulnerabilityAnalysis
    recommendations: list[str]
    analysis_timestamp: datetime
    analysis_duration: float


class DependencyGraphAnalyzer:
    """NetworkX-based dependency graph analyzer."""

    def __init__(self):
        self.graph: Optional[nx.DiGraph] = None
        self.node_attributes: dict[str, dict[str, Any]] = {}
        self.edge_attributes: dict[tuple[str, str], dict[str, Any]] = {}
        self.analysis_cache: dict[str, Any] = {}

    def build_graph(
        self,
        nodes: list[GraphNode],
        edges: list[GraphEdge]
    ) -> nx.DiGraph:
        """
        Build NetworkX graph from nodes and edges.

        Args:
            nodes: List of graph nodes
            edges: List of graph edges

        Returns:
            NetworkX directed graph
        """
        try:
            logger.info(f"Building dependency graph with {len(nodes)} nodes and {len(edges)} edges")

            # Create directed graph
            self.graph = nx.DiGraph()

            # Add nodes
            for node in nodes:
                self.graph.add_node(
                    node.id,
                    name=node.name,
                    version=node.version,
                    ecosystem=node.ecosystem,
                    node_type=node.node_type,
                    **node.attributes
                )
                self.node_attributes[node.id] = node.attributes

            # Add edges
            for edge in edges:
                self.graph.add_edge(
                    edge.source,
                    edge.target,
                    edge_type=edge.edge_type,
                    weight=edge.weight,
                    **edge.attributes
                )
                self.edge_attributes[(edge.source, edge.target)] = edge.attributes

            logger.info(f"Graph built successfully: {self.graph.number_of_nodes()} nodes, {self.graph.number_of_edges()} edges")
            return self.graph

        except Exception as e:
            logger.error(f"Failed to build graph: {e}", exc_info=True)
            raise

    def analyze_graph(self) -> GraphAnalysisResult:
        """
        Perform comprehensive graph analysis.

        Returns:
            Complete graph analysis result
        """
        try:
            if not self.graph:
                raise ValueError("Graph not built. Call build_graph() first.")

            logger.info("Starting comprehensive graph analysis")
            start_time = datetime.utcnow()

            # Calculate basic graph metrics
            graph_metrics = self._calculate_graph_metrics()

            # Calculate centrality metrics
            centrality_metrics = self._calculate_centrality_metrics()

            # Perform vulnerability analysis
            vulnerability_analysis = self._analyze_vulnerabilities()

            # Generate recommendations
            recommendations = self._generate_recommendations(graph_metrics, centrality_metrics, vulnerability_analysis)

            analysis_duration = (datetime.utcnow() - start_time).total_seconds()

            result = GraphAnalysisResult(
                graph_metrics=graph_metrics,
                centrality_metrics=centrality_metrics,
                vulnerability_analysis=vulnerability_analysis,
                recommendations=recommendations,
                analysis_timestamp=start_time,
                analysis_duration=analysis_duration
            )

            logger.info(f"Graph analysis completed in {analysis_duration:.2f}s")
            return result

        except Exception as e:
            logger.error(f"Failed to analyze graph: {e}", exc_info=True)
            raise

    def _calculate_graph_metrics(self) -> GraphMetrics:
        """Calculate basic graph metrics."""
        try:
            # Basic metrics
            node_count = self.graph.number_of_nodes()
            edge_count = self.graph.number_of_edges()
            density = nx.density(self.graph)

            # Connectivity metrics
            connected_components = nx.number_weakly_connected_components(self.graph)
            largest_component = max(nx.weakly_connected_components(self.graph), key=len)
            largest_component_size = len(largest_component)

            # Structural metrics
            try:
                diameter = nx.diameter(self.graph.to_undirected())
                radius = nx.radius(self.graph.to_undirected())
            except nx.NetworkXError:
                # Graph is not connected
                diameter = 0
                radius = 0

            # Clustering metrics
            try:
                average_clustering = nx.average_clustering(self.graph.to_undirected())
                transitivity = nx.transitivity(self.graph.to_undirected())
            except:
                average_clustering = 0.0
                transitivity = 0.0

            # Assortativity
            try:
                assortativity = nx.degree_assortativity_coefficient(self.graph)
            except:
                assortativity = 0.0

            # Modularity (community detection)
            try:
                communities = nx.community.greedy_modularity_communities(self.graph.to_undirected())
                modularity = nx.community.modularity(self.graph.to_undirected(), communities)
            except:
                modularity = 0.0

            return GraphMetrics(
                node_count=node_count,
                edge_count=edge_count,
                density=density,
                diameter=diameter,
                radius=radius,
                average_clustering=average_clustering,
                transitivity=transitivity,
                assortativity=assortativity,
                modularity=modularity,
                connected_components=connected_components,
                largest_component_size=largest_component_size
            )

        except Exception as e:
            logger.error(f"Failed to calculate graph metrics: {e}")
            raise

    def _calculate_centrality_metrics(self) -> CentralityMetrics:
        """Calculate centrality metrics."""
        try:
            # Degree centrality
            degree_centrality = nx.degree_centrality(self.graph)

            # Betweenness centrality
            betweenness_centrality = nx.betweenness_centrality(self.graph)

            # Closeness centrality
            closeness_centrality = nx.closeness_centrality(self.graph)

            # Eigenvector centrality
            try:
                eigenvector_centrality = nx.eigenvector_centrality(self.graph)
            except nx.PowerIterationFailedConvergence:
                eigenvector_centrality = {node: 0.0 for node in self.graph.nodes()}

            # PageRank
            pagerank = nx.pagerank(self.graph)

            # Harmonic centrality
            harmonic_centrality = nx.harmonic_centrality(self.graph)

            return CentralityMetrics(
                degree_centrality=degree_centrality,
                betweenness_centrality=betweenness_centrality,
                closeness_centrality=closeness_centrality,
                eigenvector_centrality=eigenvector_centrality,
                pagerank=pagerank,
                harmonic_centrality=harmonic_centrality
            )

        except Exception as e:
            logger.error(f"Failed to calculate centrality metrics: {e}")
            raise

    def _analyze_vulnerabilities(self) -> VulnerabilityAnalysis:
        """Analyze graph for vulnerabilities and single points of failure."""
        try:
            # Find critical nodes (high centrality)
            centrality_metrics = self._calculate_centrality_metrics()

            # Nodes with high betweenness centrality are critical
            critical_threshold = 0.1
            critical_nodes = [
                node for node, centrality in centrality_metrics.betweenness_centrality.items()
                if centrality > critical_threshold
            ]

            # Find single points of failure (nodes whose removal disconnects the graph)
            single_points_of_failure = []
            for node in self.graph.nodes():
                temp_graph = self.graph.copy()
                temp_graph.remove_node(node)
                if nx.number_weakly_connected_components(temp_graph) > nx.number_weakly_connected_components(self.graph):
                    single_points_of_failure.append(node)

            # Calculate attack surface (nodes with high degree)
            high_degree_nodes = [
                node for node, degree in self.graph.degree()
                if degree > self.graph.number_of_nodes() * 0.1  # 10% of nodes
            ]
            attack_surface = len(high_degree_nodes) / self.graph.number_of_nodes()

            # Calculate resilience score (inverse of vulnerability)
            resilience_score = 1.0 - min(1.0, attack_surface + len(single_points_of_failure) / self.graph.number_of_nodes())

            # Find vulnerability paths (shortest paths through critical nodes)
            vulnerability_paths = []
            for critical_node in critical_nodes[:5]:  # Limit to top 5 critical nodes
                try:
                    paths = list(nx.all_simple_paths(self.graph, critical_node, target=None, cutoff=3))
                    vulnerability_paths.extend(paths[:10])  # Limit paths per node
                except:
                    continue

            return VulnerabilityAnalysis(
                critical_nodes=critical_nodes,
                single_points_of_failure=single_points_of_failure,
                attack_surface=attack_surface,
                resilience_score=resilience_score,
                vulnerability_paths=vulnerability_paths
            )

        except Exception as e:
            logger.error(f"Failed to analyze vulnerabilities: {e}")
            raise

    def _generate_recommendations(
        self,
        graph_metrics: GraphMetrics,
        centrality_metrics: CentralityMetrics,
        vulnerability_analysis: VulnerabilityAnalysis
    ) -> list[str]:
        """Generate recommendations based on analysis."""
        recommendations = []

        # Density recommendations
        if graph_metrics.density > 0.5:
            recommendations.append("High graph density detected. Consider reducing dependencies to improve maintainability.")
        elif graph_metrics.density < 0.1:
            recommendations.append("Low graph density detected. Consider adding more dependencies for better integration.")

        # Connectivity recommendations
        if graph_metrics.connected_components > 1:
            recommendations.append(f"Graph has {graph_metrics.connected_components} disconnected components. Consider connecting them.")

        # Critical nodes recommendations
        if len(vulnerability_analysis.critical_nodes) > 0:
            recommendations.append(f"Found {len(vulnerability_analysis.critical_nodes)} critical nodes. Consider adding redundancy.")

        # Single points of failure recommendations
        if len(vulnerability_analysis.single_points_of_failure) > 0:
            recommendations.append(f"Found {len(vulnerability_analysis.single_points_of_failure)} single points of failure. Add backup dependencies.")

        # Resilience recommendations
        if vulnerability_analysis.resilience_score < 0.5:
            recommendations.append("Low resilience score detected. Improve fault tolerance and add redundancy.")

        # Modularity recommendations
        if graph_metrics.modularity < 0.3:
            recommendations.append("Low modularity detected. Consider better separation of concerns.")

        return recommendations

    def get_node_metrics(self, node_id: str) -> dict[str, Any]:
        """Get detailed metrics for a specific node."""
        try:
            if not self.graph or node_id not in self.graph:
                return {}

            centrality_metrics = self._calculate_centrality_metrics()

            return {
                "node_id": node_id,
                "degree": self.graph.degree(node_id),
                "in_degree": self.graph.in_degree(node_id),
                "out_degree": self.graph.out_degree(node_id),
                "degree_centrality": centrality_metrics.degree_centrality.get(node_id, 0.0),
                "betweenness_centrality": centrality_metrics.betweenness_centrality.get(node_id, 0.0),
                "closeness_centrality": centrality_metrics.closeness_centrality.get(node_id, 0.0),
                "eigenvector_centrality": centrality_metrics.eigenvector_centrality.get(node_id, 0.0),
                "pagerank": centrality_metrics.pagerank.get(node_id, 0.0),
                "harmonic_centrality": centrality_metrics.harmonic_centrality.get(node_id, 0.0),
                "neighbors": list(self.graph.neighbors(node_id)),
                "predecessors": list(self.graph.predecessors(node_id)),
                "successors": list(self.graph.successors(node_id))
            }

        except Exception as e:
            logger.error(f"Failed to get node metrics for {node_id}: {e}")
            return {}

    def find_shortest_path(self, source: str, target: str) -> list[str]:
        """Find shortest path between two nodes."""
        try:
            if not self.graph:
                return []

            return nx.shortest_path(self.graph, source, target)

        except nx.NetworkXNoPath:
            return []
        except Exception as e:
            logger.error(f"Failed to find shortest path: {e}")
            return []

    def find_cycles(self) -> list[list[str]]:
        """Find cycles in the dependency graph."""
        try:
            if not self.graph:
                return []

            return list(nx.simple_cycles(self.graph))

        except Exception as e:
            logger.error(f"Failed to find cycles: {e}")
            return []

    def get_subgraph(self, nodes: list[str]) -> nx.DiGraph:
        """Get subgraph containing specified nodes."""
        try:
            if not self.graph:
                return nx.DiGraph()

            return self.graph.subgraph(nodes)

        except Exception as e:
            logger.error(f"Failed to get subgraph: {e}")
            return nx.DiGraph()

    def export_graph(self, format: str = "json") -> Union[str, dict[str, Any]]:
        """Export graph in specified format."""
        try:
            if not self.graph:
                return {} if format == "json" else ""

            if format == "json":
                return nx.node_link_data(self.graph)
            elif format == "edgelist":
                return "\n".join(f"{u} {v}" for u, v in self.graph.edges())
            elif format == "adjlist":
                return "\n".join(f"{node} {' '.join(self.graph.neighbors(node))}" for node in self.graph.nodes())
            else:
                raise ValueError(f"Unsupported format: {format}")

        except Exception as e:
            logger.error(f"Failed to export graph: {e}")
            return {} if format == "json" else ""

    def visualize_graph(self, layout: str = "spring") -> dict[str, Any]:
        """Generate graph visualization data."""
        try:
            if not self.graph:
                return {}

            # Calculate layout
            if layout == "spring":
                pos = nx.spring_layout(self.graph)
            elif layout == "circular":
                pos = nx.circular_layout(self.graph)
            elif layout == "hierarchical":
                pos = nx.nx_agraph.graphviz_layout(self.graph, prog="dot")
            else:
                pos = nx.spring_layout(self.graph)

            # Prepare visualization data
            nodes = []
            for node in self.graph.nodes():
                nodes.append({
                    "id": node,
                    "x": pos[node][0],
                    "y": pos[node][1],
                    "name": self.graph.nodes[node].get("name", node),
                    "version": self.graph.nodes[node].get("version", ""),
                    "ecosystem": self.graph.nodes[node].get("ecosystem", ""),
                    "degree": self.graph.degree(node)
                })

            edges = []
            for edge in self.graph.edges():
                edges.append({
                    "source": edge[0],
                    "target": edge[1],
                    "weight": self.graph.edges[edge].get("weight", 1.0)
                })

            return {
                "nodes": nodes,
                "edges": edges,
                "layout": layout,
                "node_count": len(nodes),
                "edge_count": len(edges)
            }

        except Exception as e:
            logger.error(f"Failed to visualize graph: {e}")
            return {}

    def get_top_central_nodes(self, centrality_type: CentralityType, limit: int = 10) -> list[dict[str, Any]]:
        """Get top central nodes by specified centrality measure."""
        try:
            if not self.graph:
                return []

            centrality_metrics = self._calculate_centrality_metrics()

            if centrality_type == CentralityType.DEGREE:
                centrality_dict = centrality_metrics.degree_centrality
            elif centrality_type == CentralityType.BETWEENNESS:
                centrality_dict = centrality_metrics.betweenness_centrality
            elif centrality_type == CentralityType.CLOSENESS:
                centrality_dict = centrality_metrics.closeness_centrality
            elif centrality_type == CentralityType.EIGENVECTOR:
                centrality_dict = centrality_metrics.eigenvector_centrality
            elif centrality_type == CentralityType.PAGERANK:
                centrality_dict = centrality_metrics.pagerank
            elif centrality_type == CentralityType.HARMONIC:
                centrality_dict = centrality_metrics.harmonic_centrality
            else:
                return []

            # Sort by centrality value
            sorted_nodes = sorted(centrality_dict.items(), key=lambda x: x[1], reverse=True)

            # Return top nodes with metadata
            top_nodes = []
            for node_id, centrality_value in sorted_nodes[:limit]:
                node_data = self.graph.nodes[node_id]
                top_nodes.append({
                    "node_id": node_id,
                    "name": node_data.get("name", node_id),
                    "version": node_data.get("version", ""),
                    "ecosystem": node_data.get("ecosystem", ""),
                    "centrality_value": centrality_value,
                    "centrality_type": centrality_type.value,
                    "degree": self.graph.degree(node_id)
                })

            return top_nodes

        except Exception as e:
            logger.error(f"Failed to get top central nodes: {e}")
            return []

    def clear_cache(self):
        """Clear analysis cache."""
        self.analysis_cache.clear()

    def get_analysis_statistics(self) -> dict[str, Any]:
        """Get analysis statistics."""
        if not self.graph:
            return {}

        return {
            "graph_size": self.graph.number_of_nodes(),
            "graph_edges": self.graph.number_of_edges(),
            "cached_analyses": len(self.analysis_cache),
            "analysis_timestamp": datetime.utcnow().isoformat()
        }
