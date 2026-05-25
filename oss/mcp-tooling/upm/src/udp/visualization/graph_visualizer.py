"""
Interactive dependency graph visualization.

Provides advanced graph visualization capabilities with interactive features,
multiple layout algorithms, and real-time updates.
"""

import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Set, Tuple
from enum import Enum
from dataclasses import dataclass, asdict
import networkx as nx
import numpy as np
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
from udp.ml.models import RiskPredictionModel, ModelManager


class NodeType(str, Enum):
    """Types of nodes in the dependency graph."""
    PACKAGE = "package"
    VULNERABILITY = "vulnerability"
    PROJECT = "project"
    ORGANIZATION = "organization"
    ECOSYSTEM = "ecosystem"
    LICENSE = "license"
    MAINTAINER = "maintainer"


class EdgeType(str, Enum):
    """Types of edges in the dependency graph."""
    DEPENDS_ON = "depends_on"
    VULNERABLE_TO = "vulnerable_to"
    CONTAINS = "contains"
    BELONGS_TO = "belongs_to"
    USES = "uses"
    MAINTAINS = "maintains"
    LICENSED_UNDER = "licensed_under"


class GraphLayout(str, Enum):
    """Graph layout algorithms."""
    HIERARCHICAL = "hierarchical"
    FORCE_DIRECTED = "force_directed"
    CIRCULAR = "circular"
    GRID = "grid"
    TREE = "tree"
    CLUSTER = "cluster"
    SPRING = "spring"
    KAMADA_KAWAI = "kamada_kawai"


@dataclass
class GraphNode:
    """Represents a node in the dependency graph."""
    id: str
    label: str
    node_type: NodeType
    data: Dict[str, Any]
    position: Optional[Tuple[float, float]] = None
    size: float = 1.0
    color: str = "#3498db"
    opacity: float = 1.0
    selected: bool = False
    highlighted: bool = False
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class GraphEdge:
    """Represents an edge in the dependency graph."""
    id: str
    source: str
    target: str
    edge_type: EdgeType
    data: Dict[str, Any]
    weight: float = 1.0
    color: str = "#95a5a6"
    opacity: float = 1.0
    selected: bool = False
    highlighted: bool = False
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class GraphMetrics:
    """Metrics for the dependency graph."""
    total_nodes: int
    total_edges: int
    node_types: Dict[str, int]
    edge_types: Dict[str, int]
    average_degree: float
    max_degree: int
    min_degree: int
    clustering_coefficient: float
    diameter: int
    density: float
    connected_components: int
    isolated_nodes: int
    vulnerability_count: int
    risk_score: float


class VisualizationConfig(BaseModel):
    """Configuration for graph visualization."""
    layout: GraphLayout = GraphLayout.FORCE_DIRECTED
    node_size_range: Tuple[float, float] = (10.0, 50.0)
    edge_width_range: Tuple[float, float] = (1.0, 5.0)
    color_scheme: str = "default"
    animation_enabled: bool = True
    interaction_enabled: bool = True
    clustering_enabled: bool = True
    filtering_enabled: bool = True
    search_enabled: bool = True
    export_enabled: bool = True
    real_time_updates: bool = True
    max_nodes: int = 1000
    max_edges: int = 5000
    update_interval: float = 1.0
    zoom_range: Tuple[float, float] = (0.1, 10.0)
    pan_enabled: bool = True
    selection_enabled: bool = True
    tooltip_enabled: bool = True
    legend_enabled: bool = True


class DependencyGraphVisualizer:
    """Interactive dependency graph visualizer."""
    
    def __init__(self, config: Optional[VisualizationConfig] = None):
        """Initialize the graph visualizer."""
        self.config = config or VisualizationConfig()
        self.graph = nx.DiGraph()
        self.nodes: Dict[str, GraphNode] = {}
        self.edges: Dict[str, GraphEdge] = {}
        self.layout_positions: Dict[str, Tuple[float, float]] = {}
        self.metrics: Optional[GraphMetrics] = None
        self.is_initialized = False
        self.update_callbacks: List[callable] = []
        self.selection_callbacks: List[callable] = []
        self.filter_callbacks: List[callable] = []
        
        # ML models for risk prediction
        self.model_manager = ModelManager()
        self.risk_model = None
        
        # Visualization state
        self.selected_nodes: Set[str] = set()
        self.highlighted_nodes: Set[str] = set()
        self.filtered_nodes: Set[str] = set()
        self.filtered_edges: Set[str] = set()
        self.current_layout = self.config.layout
        
    async def initialize(self):
        """Initialize the visualizer."""
        try:
            # Initialize ML models
            await self._initialize_ml_models()
            
            # Initialize graph layout
            await self._initialize_layout()
            
            self.is_initialized = True
            await self._notify_update_callbacks("initialized")
            
        except Exception as e:
            raise Exception(f"Failed to initialize graph visualizer: {e}")
    
    async def _initialize_ml_models(self):
        """Initialize ML models for risk prediction."""
        try:
            # Load or train risk prediction model
            self.risk_model = self.model_manager.get_model("risk_prediction")
            if not self.risk_model or not self.risk_model.is_trained:
                # Create sample training data
                X = np.random.random((1000, 25))
                y = np.random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"], 1000)
                self.model_manager.train_model("risk_prediction", X, y)
                self.risk_model = self.model_manager.get_model("risk_prediction")
                
        except Exception as e:
            print(f"Warning: Could not initialize ML models: {e}")
            self.risk_model = None
    
    async def _initialize_layout(self):
        """Initialize graph layout positions."""
        if self.graph.number_of_nodes() > 0:
            await self._calculate_layout()
    
    async def add_project(self, project: Project, dependencies: List[Dependency], vulnerabilities: List[Vulnerability]):
        """Add a project and its dependencies to the graph."""
        try:
            # Add project node
            project_node = GraphNode(
                id=f"project_{project.id}",
                label=project.name,
                node_type=NodeType.PROJECT,
                data={
                    "project_id": project.id,
                    "name": project.name,
                    "description": project.description,
                    "ecosystem": project.ecosystem,
                    "package_manager": project.package_manager,
                    "created_at": project.created_at.isoformat() if project.created_at else None,
                    "updated_at": project.updated_at.isoformat() if project.updated_at else None
                },
                color="#e74c3c",
                size=2.0
            )
            self._add_node(project_node)
            
            # Add dependency nodes
            for dependency in dependencies:
                await self._add_dependency(dependency, project.id)
            
            # Add vulnerability nodes
            for vulnerability in vulnerabilities:
                await self._add_vulnerability(vulnerability)
            
            # Update graph structure
            await self._update_graph_structure()
            
            # Recalculate layout if needed
            if self.config.real_time_updates:
                await self._calculate_layout()
                await self._calculate_metrics()
                await self._notify_update_callbacks("project_added")
                
        except Exception as e:
            raise Exception(f"Failed to add project to graph: {e}")
    
    async def _add_dependency(self, dependency: Dependency, project_id: str):
        """Add a dependency to the graph."""
        # Create dependency node
        dep_node = GraphNode(
            id=f"dep_{dependency.id}",
            label=dependency.name,
            node_type=NodeType.PACKAGE,
            data={
                "dependency_id": dependency.id,
                "name": dependency.name,
                "version": dependency.version,
                "ecosystem": dependency.ecosystem,
                "is_direct": dependency.is_direct,
                "license": dependency.license,
                "description": dependency.description,
                "homepage": dependency.homepage,
                "repository": dependency.repository,
                "created_at": dependency.created_at.isoformat() if dependency.created_at else None,
                "updated_at": dependency.updated_at.isoformat() if dependency.updated_at else None
            },
            color=self._get_dependency_color(dependency),
            size=self._get_dependency_size(dependency)
        )
        self._add_node(dep_node)
        
        # Add edge from project to dependency
        edge = GraphEdge(
            id=f"edge_{project_id}_{dependency.id}",
            source=f"project_{project_id}",
            target=f"dep_{dependency.id}",
            edge_type=EdgeType.CONTAINS,
            data={
                "dependency_id": dependency.id,
                "is_direct": dependency.is_direct,
                "version_constraint": dependency.version_constraint
            },
            weight=2.0 if dependency.is_direct else 1.0,
            color="#3498db" if dependency.is_direct else "#95a5a6"
        )
        self._add_edge(edge)
        
        # Add dependency relationships
        if dependency.dependencies:
            for dep_dep in dependency.dependencies:
                dep_dep_node = GraphNode(
                    id=f"dep_{dep_dep.id}",
                    label=dep_dep.name,
                    node_type=NodeType.PACKAGE,
                    data={
                        "dependency_id": dep_dep.id,
                        "name": dep_dep.name,
                        "version": dep_dep.version,
                        "ecosystem": dep_dep.ecosystem,
                        "is_direct": False,
                        "license": dep_dep.license
                    },
                    color=self._get_dependency_color(dep_dep),
                    size=self._get_dependency_size(dep_dep)
                )
                self._add_node(dep_dep_node)
                
                # Add edge between dependencies
                dep_edge = GraphEdge(
                    id=f"edge_{dependency.id}_{dep_dep.id}",
                    source=f"dep_{dependency.id}",
                    target=f"dep_{dep_dep.id}",
                    edge_type=EdgeType.DEPENDS_ON,
                    data={
                        "source_dependency_id": dependency.id,
                        "target_dependency_id": dep_dep.id,
                        "version_constraint": dep_dep.version_constraint
                    },
                    weight=1.0,
                    color="#e67e22"
                )
                self._add_edge(dep_edge)
    
    async def _add_vulnerability(self, vulnerability: Vulnerability):
        """Add a vulnerability to the graph."""
        # Create vulnerability node
        vuln_node = GraphNode(
            id=f"vuln_{vulnerability.id}",
            label=vulnerability.title,
            node_type=NodeType.VULNERABILITY,
            data={
                "vulnerability_id": vulnerability.id,
                "title": vulnerability.title,
                "description": vulnerability.description,
                "severity": vulnerability.severity,
                "cvss_score": vulnerability.cvss_score,
                "cvss_vector": vulnerability.cvss_vector,
                "cwe_id": vulnerability.cwe_id,
                "references": vulnerability.references,
                "created_at": vulnerability.created_at.isoformat() if vulnerability.created_at else None,
                "updated_at": vulnerability.updated_at.isoformat() if vulnerability.updated_at else None
            },
            color=self._get_vulnerability_color(vulnerability),
            size=self._get_vulnerability_size(vulnerability)
        )
        self._add_node(vuln_node)
        
        # Add edges to affected dependencies
        for affected_dep in vulnerability.affected_dependencies:
            vuln_edge = GraphEdge(
                id=f"vuln_edge_{vulnerability.id}_{affected_dep.id}",
                source=f"dep_{affected_dep.id}",
                target=f"vuln_{vulnerability.id}",
                edge_type=EdgeType.VULNERABLE_TO,
                data={
                    "vulnerability_id": vulnerability.id,
                    "dependency_id": affected_dep.id,
                    "severity": vulnerability.severity,
                    "cvss_score": vulnerability.cvss_score
                },
                weight=3.0,
                color=self._get_vulnerability_color(vulnerability)
            )
            self._add_edge(vuln_edge)
    
    def _add_node(self, node: GraphNode):
        """Add a node to the graph."""
        self.nodes[node.id] = node
        self.graph.add_node(node.id, **node.data)
    
    def _add_edge(self, edge: GraphEdge):
        """Add an edge to the graph."""
        self.edges[edge.id] = edge
        self.graph.add_edge(edge.source, edge.target, **edge.data)
    
    def _get_dependency_color(self, dependency: Dependency) -> str:
        """Get color for dependency based on risk level."""
        if self.risk_model:
            try:
                # Create feature vector for dependency
                features = self._extract_dependency_features(dependency)
                prediction = self.risk_model.predict(features.reshape(1, -1))
                
                risk_level = prediction.prediction
                if risk_level == "CRITICAL":
                    return "#e74c3c"  # Red
                elif risk_level == "HIGH":
                    return "#f39c12"  # Orange
                elif risk_level == "MEDIUM":
                    return "#f1c40f"  # Yellow
                else:
                    return "#27ae60"  # Green
            except Exception:
                pass
        
        # Default colors based on vulnerability count
        vuln_count = len(dependency.vulnerabilities) if hasattr(dependency, 'vulnerabilities') else 0
        if vuln_count > 5:
            return "#e74c3c"  # Red
        elif vuln_count > 2:
            return "#f39c12"  # Orange
        elif vuln_count > 0:
            return "#f1c40f"  # Yellow
        else:
            return "#27ae60"  # Green
    
    def _get_dependency_size(self, dependency: Dependency) -> float:
        """Get size for dependency based on importance."""
        base_size = 1.0
        
        # Increase size for direct dependencies
        if dependency.is_direct:
            base_size *= 1.5
        
        # Increase size based on vulnerability count
        vuln_count = len(dependency.vulnerabilities) if hasattr(dependency, 'vulnerabilities') else 0
        base_size += vuln_count * 0.2
        
        return min(base_size, 3.0)  # Cap at 3.0
    
    def _get_vulnerability_color(self, vulnerability: Vulnerability) -> str:
        """Get color for vulnerability based on severity."""
        severity_colors = {
            "CRITICAL": "#8e44ad",  # Purple
            "HIGH": "#e74c3c",      # Red
            "MEDIUM": "#f39c12",    # Orange
            "LOW": "#f1c40f"        # Yellow
        }
        return severity_colors.get(vulnerability.severity, "#95a5a6")
    
    def _get_vulnerability_size(self, vulnerability: Vulnerability) -> float:
        """Get size for vulnerability based on CVSS score."""
        if vulnerability.cvss_score:
            return min(1.0 + (vulnerability.cvss_score / 10.0), 2.5)
        return 1.0
    
    def _extract_dependency_features(self, dependency: Dependency) -> np.ndarray:
        """Extract features for ML model prediction."""
        # Create feature vector (25 features as expected by the model)
        features = np.zeros(25)
        
        # Basic features
        features[0] = len(dependency.dependencies) if dependency.dependencies else 0
        features[1] = len(dependency.vulnerabilities) if hasattr(dependency, 'vulnerabilities') else 0
        features[2] = 1.0 if dependency.is_direct else 0.0
        features[3] = hash(dependency.ecosystem) % 1000 / 1000.0  # Normalized ecosystem hash
        features[4] = hash(dependency.license) % 1000 / 1000.0 if dependency.license else 0.0
        
        # Version features
        if dependency.version:
            try:
                version_parts = dependency.version.split('.')
                features[5] = float(version_parts[0]) if len(version_parts) > 0 else 0.0
                features[6] = float(version_parts[1]) if len(version_parts) > 1 else 0.0
                features[7] = float(version_parts[2]) if len(version_parts) > 2 else 0.0
            except (ValueError, IndexError):
                pass
        
        # Vulnerability features
        if hasattr(dependency, 'vulnerabilities') and dependency.vulnerabilities:
            cvss_scores = [v.cvss_score for v in dependency.vulnerabilities if v.cvss_score]
            if cvss_scores:
                features[8] = max(cvss_scores)
                features[9] = sum(cvss_scores) / len(cvss_scores)
                features[10] = len(cvss_scores)
        
        # Fill remaining features with random values (in real implementation, these would be meaningful)
        features[11:] = np.random.random(14)
        
        return features
    
    async def _update_graph_structure(self):
        """Update the NetworkX graph structure."""
        self.graph.clear()
        
        # Add nodes
        for node in self.nodes.values():
            self.graph.add_node(node.id, **node.data)
        
        # Add edges
        for edge in self.edges.values():
            self.graph.add_edge(edge.source, edge.target, **edge.data)
    
    async def _calculate_layout(self):
        """Calculate graph layout positions."""
        if self.graph.number_of_nodes() == 0:
            return
        
        try:
            if self.current_layout == GraphLayout.FORCE_DIRECTED:
                positions = nx.spring_layout(self.graph, k=1, iterations=50)
            elif self.current_layout == GraphLayout.HIERARCHICAL:
                positions = nx.nx_agraph.graphviz_layout(self.graph, prog='dot')
            elif self.current_layout == GraphLayout.CIRCULAR:
                positions = nx.circular_layout(self.graph)
            elif self.current_layout == GraphLayout.GRID:
                positions = nx.grid_2d_layout(self.graph)
            elif self.current_layout == GraphLayout.TREE:
                positions = nx.nx_agraph.graphviz_layout(self.graph, prog='dot')
            elif self.current_layout == GraphLayout.CLUSTER:
                positions = nx.spring_layout(self.graph, k=2, iterations=100)
            elif self.current_layout == GraphLayout.KAMADA_KAWAI:
                positions = nx.kamada_kawai_layout(self.graph)
            else:
                positions = nx.spring_layout(self.graph)
            
            # Update node positions
            for node_id, pos in positions.items():
                if node_id in self.nodes:
                    self.nodes[node_id].position = pos
                    self.layout_positions[node_id] = pos
                    
        except Exception as e:
            print(f"Warning: Could not calculate layout: {e}")
            # Fallback to random layout
            positions = nx.random_layout(self.graph)
            for node_id, pos in positions.items():
                if node_id in self.nodes:
                    self.nodes[node_id].position = pos
                    self.layout_positions[node_id] = pos
    
    async def _calculate_metrics(self):
        """Calculate graph metrics."""
        if self.graph.number_of_nodes() == 0:
            self.metrics = GraphMetrics(
                total_nodes=0, total_edges=0, node_types={}, edge_types={},
                average_degree=0.0, max_degree=0, min_degree=0,
                clustering_coefficient=0.0, diameter=0, density=0.0,
                connected_components=0, isolated_nodes=0,
                vulnerability_count=0, risk_score=0.0
            )
            return
        
        # Calculate basic metrics
        total_nodes = self.graph.number_of_nodes()
        total_edges = self.graph.number_of_edges()
        
        # Node type distribution
        node_types = {}
        for node in self.nodes.values():
            node_types[node.node_type.value] = node_types.get(node.node_type.value, 0) + 1
        
        # Edge type distribution
        edge_types = {}
        for edge in self.edges.values():
            edge_types[edge.edge_type.value] = edge_types.get(edge.edge_type.value, 0) + 1
        
        # Degree statistics
        degrees = [self.graph.degree(node) for node in self.graph.nodes()]
        average_degree = sum(degrees) / len(degrees) if degrees else 0.0
        max_degree = max(degrees) if degrees else 0
        min_degree = min(degrees) if degrees else 0
        
        # Graph structure metrics
        try:
            clustering_coefficient = nx.average_clustering(self.graph.to_undirected())
        except:
            clustering_coefficient = 0.0
        
        try:
            diameter = nx.diameter(self.graph.to_undirected())
        except:
            diameter = 0
        
        density = nx.density(self.graph)
        
        # Connected components
        connected_components = nx.number_connected_components(self.graph.to_undirected())
        
        # Isolated nodes
        isolated_nodes = len(list(nx.isolates(self.graph)))
        
        # Vulnerability count
        vulnerability_count = sum(1 for node in self.nodes.values() if node.node_type == NodeType.VULNERABILITY)
        
        # Risk score (average of all dependency risk scores)
        risk_score = 0.0
        if self.risk_model:
            try:
                risk_scores = []
                for node in self.nodes.values():
                    if node.node_type == NodeType.PACKAGE and 'dependency_id' in node.data:
                        # This would need actual dependency object to extract features
                        # For now, use a placeholder
                        risk_scores.append(0.5)  # Placeholder
                
                if risk_scores:
                    risk_score = sum(risk_scores) / len(risk_scores)
            except Exception:
                pass
        
        self.metrics = GraphMetrics(
            total_nodes=total_nodes,
            total_edges=total_edges,
            node_types=node_types,
            edge_types=edge_types,
            average_degree=average_degree,
            max_degree=max_degree,
            min_degree=min_degree,
            clustering_coefficient=clustering_coefficient,
            diameter=diameter,
            density=density,
            connected_components=connected_components,
            isolated_nodes=isolated_nodes,
            vulnerability_count=vulnerability_count,
            risk_score=risk_score
        )
    
    async def set_layout(self, layout: GraphLayout):
        """Change the graph layout."""
        self.current_layout = layout
        await self._calculate_layout()
        await self._notify_update_callbacks("layout_changed")
    
    async def select_nodes(self, node_ids: List[str]):
        """Select nodes in the graph."""
        # Clear previous selection
        for node_id in self.selected_nodes:
            if node_id in self.nodes:
                self.nodes[node_id].selected = False
        
        # Set new selection
        self.selected_nodes = set(node_ids)
        for node_id in self.selected_nodes:
            if node_id in self.nodes:
                self.nodes[node_id].selected = True
        
        await self._notify_selection_callbacks()
    
    async def highlight_nodes(self, node_ids: List[str]):
        """Highlight nodes in the graph."""
        # Clear previous highlights
        for node_id in self.highlighted_nodes:
            if node_id in self.nodes:
                self.nodes[node_id].highlighted = False
        
        # Set new highlights
        self.highlighted_nodes = set(node_ids)
        for node_id in self.highlighted_nodes:
            if node_id in self.nodes:
                self.nodes[node_id].highlighted = True
        
        await self._notify_update_callbacks("highlight_changed")
    
    async def filter_graph(self, filters: Dict[str, Any]):
        """Filter the graph based on criteria."""
        self.filtered_nodes = set()
        self.filtered_edges = set()
        
        # Apply filters
        for node_id, node in self.nodes.items():
            if self._node_matches_filters(node, filters):
                self.filtered_nodes.add(node_id)
        
        for edge_id, edge in self.edges.items():
            if self._edge_matches_filters(edge, filters):
                self.filtered_edges.add(edge_id)
        
        await self._notify_filter_callbacks()
    
    def _node_matches_filters(self, node: GraphNode, filters: Dict[str, Any]) -> bool:
        """Check if a node matches the given filters."""
        # Node type filter
        if 'node_type' in filters and node.node_type != filters['node_type']:
            return False
        
        # Risk level filter
        if 'risk_level' in filters:
            node_risk = self._get_node_risk_level(node)
            if node_risk not in filters['risk_level']:
                return False
        
        # Vulnerability filter
        if 'has_vulnerabilities' in filters:
            has_vulns = node.node_type == NodeType.VULNERABILITY or 'vulnerability_id' in node.data
            if filters['has_vulnerabilities'] != has_vulns:
                return False
        
        # Ecosystem filter
        if 'ecosystem' in filters and node.data.get('ecosystem') != filters['ecosystem']:
            return False
        
        return True
    
    def _edge_matches_filters(self, edge: GraphEdge, filters: Dict[str, Any]) -> bool:
        """Check if an edge matches the given filters."""
        # Edge type filter
        if 'edge_type' in filters and edge.edge_type != filters['edge_type']:
            return False
        
        # Weight filter
        if 'min_weight' in filters and edge.weight < filters['min_weight']:
            return False
        
        return True
    
    def _get_node_risk_level(self, node: GraphNode) -> str:
        """Get risk level for a node."""
        if node.node_type == NodeType.VULNERABILITY:
            return node.data.get('severity', 'LOW')
        elif node.node_type == NodeType.PACKAGE:
            # Use color to determine risk level
            if node.color == "#e74c3c":
                return "CRITICAL"
            elif node.color == "#f39c12":
                return "HIGH"
            elif node.color == "#f1c40f":
                return "MEDIUM"
            else:
                return "LOW"
        return "LOW"
    
    async def search_nodes(self, query: str) -> List[GraphNode]:
        """Search for nodes matching the query."""
        results = []
        query_lower = query.lower()
        
        for node in self.nodes.values():
            if (query_lower in node.label.lower() or 
                query_lower in node.data.get('name', '').lower() or
                query_lower in node.data.get('description', '').lower()):
                results.append(node)
        
        return results
    
    async def get_node_neighbors(self, node_id: str, depth: int = 1) -> List[GraphNode]:
        """Get neighbors of a node up to specified depth."""
        if node_id not in self.graph:
            return []
        
        neighbors = set()
        current_level = {node_id}
        
        for _ in range(depth):
            next_level = set()
            for node in current_level:
                if node in self.graph:
                    next_level.update(self.graph.neighbors(node))
            neighbors.update(next_level)
            current_level = next_level
        
        return [self.nodes[node_id] for node_id in neighbors if node_id in self.nodes]
    
    async def export_graph(self, format: str = "json") -> Dict[str, Any]:
        """Export the graph data."""
        return {
            "nodes": [asdict(node) for node in self.nodes.values()],
            "edges": [asdict(edge) for edge in self.edges.values()],
            "metrics": asdict(self.metrics) if self.metrics else None,
            "config": self.config.dict(),
            "layout": self.current_layout.value,
            "positions": self.layout_positions,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    async def clear_graph(self):
        """Clear the graph."""
        self.graph.clear()
        self.nodes.clear()
        self.edges.clear()
        self.layout_positions.clear()
        self.selected_nodes.clear()
        self.highlighted_nodes.clear()
        self.filtered_nodes.clear()
        self.filtered_edges.clear()
        self.metrics = None
        
        await self._notify_update_callbacks("graph_cleared")
    
    def add_update_callback(self, callback: callable):
        """Add a callback for graph updates."""
        self.update_callbacks.append(callback)
    
    def add_selection_callback(self, callback: callable):
        """Add a callback for node selection."""
        self.selection_callbacks.append(callback)
    
    def add_filter_callback(self, callback: callable):
        """Add a callback for graph filtering."""
        self.filter_callbacks.append(callback)
    
    async def _notify_update_callbacks(self, event_type: str):
        """Notify update callbacks."""
        for callback in self.update_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event_type, self)
                else:
                    callback(event_type, self)
            except Exception as e:
                print(f"Error in update callback: {e}")
    
    async def _notify_selection_callbacks(self):
        """Notify selection callbacks."""
        for callback in self.selection_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(self.selected_nodes, self)
                else:
                    callback(self.selected_nodes, self)
            except Exception as e:
                print(f"Error in selection callback: {e}")
    
    async def _notify_filter_callbacks(self):
        """Notify filter callbacks."""
        for callback in self.filter_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(self.filtered_nodes, self.filtered_edges, self)
                else:
                    callback(self.filtered_nodes, self.filtered_edges, self)
            except Exception as e:
                print(f"Error in filter callback: {e}")
    
    async def get_graph_summary(self) -> Dict[str, Any]:
        """Get a summary of the current graph state."""
        return {
            "is_initialized": self.is_initialized,
            "total_nodes": len(self.nodes),
            "total_edges": len(self.edges),
            "selected_nodes": len(self.selected_nodes),
            "highlighted_nodes": len(self.highlighted_nodes),
            "filtered_nodes": len(self.filtered_nodes),
            "filtered_edges": len(self.filtered_edges),
            "current_layout": self.current_layout.value,
            "metrics": asdict(self.metrics) if self.metrics else None,
            "config": self.config.dict()
        }
