"""
API routes for dependency graph analysis.

Provides endpoints for NetworkX-based dependency graph analysis,
visualization, and metrics calculation.
"""

import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from udp.analysis.graph_analyzer import (
    CentralityType,
    DependencyGraphAnalyzer,
    GraphAnalysisResult,
    GraphEdge,
    GraphNode,
)
from udp.api.routes.dependencies import get_current_organization, get_current_user
from udp.domain.models import Organization, User

logger = logging.getLogger(__name__)
router = APIRouter()


# Request/Response Models
class GraphNodeRequest(BaseModel):
    """Request model for graph node."""
    id: str = Field(..., description="Node ID")
    name: str = Field(..., description="Node name")
    version: str = Field(..., description="Node version")
    ecosystem: str = Field(..., description="Node ecosystem")
    node_type: str = Field("package", description="Node type")
    attributes: dict[str, Any] = Field(default_factory=dict, description="Node attributes")


class GraphEdgeRequest(BaseModel):
    """Request model for graph edge."""
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    edge_type: str = Field("depends_on", description="Edge type")
    weight: float = Field(1.0, description="Edge weight")
    attributes: dict[str, Any] = Field(default_factory=dict, description="Edge attributes")


class GraphAnalysisRequest(BaseModel):
    """Request model for graph analysis."""
    nodes: list[GraphNodeRequest] = Field(..., description="List of graph nodes")
    edges: list[GraphEdgeRequest] = Field(..., description="List of graph edges")


class GraphMetricsResponse(BaseModel):
    """Response model for graph metrics."""
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


class CentralityMetricsResponse(BaseModel):
    """Response model for centrality metrics."""
    degree_centrality: dict[str, float]
    betweenness_centrality: dict[str, float]
    closeness_centrality: dict[str, float]
    eigenvector_centrality: dict[str, float]
    pagerank: dict[str, float]
    harmonic_centrality: dict[str, float]


class VulnerabilityAnalysisResponse(BaseModel):
    """Response model for vulnerability analysis."""
    critical_nodes: list[str]
    single_points_of_failure: list[str]
    attack_surface: float
    resilience_score: float
    vulnerability_paths: list[list[str]]


class GraphAnalysisResponse(BaseModel):
    """Response model for complete graph analysis."""
    graph_metrics: GraphMetricsResponse
    centrality_metrics: CentralityMetricsResponse
    vulnerability_analysis: VulnerabilityAnalysisResponse
    recommendations: list[str]
    analysis_timestamp: str
    analysis_duration: float


class NodeMetricsResponse(BaseModel):
    """Response model for node-specific metrics."""
    node_id: str
    degree: int
    in_degree: int
    out_degree: int
    degree_centrality: float
    betweenness_centrality: float
    closeness_centrality: float
    eigenvector_centrality: float
    pagerank: float
    harmonic_centrality: float
    neighbors: list[str]
    predecessors: list[str]
    successors: list[str]


class GraphVisualizationResponse(BaseModel):
    """Response model for graph visualization."""
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    layout: str
    node_count: int
    edge_count: int


# API Endpoints
@router.post("/analyze", response_model=GraphAnalysisResponse)
async def analyze_dependency_graph(
    request: GraphAnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Perform comprehensive analysis of a dependency graph."""
    try:
        logger.info(f"Analyzing dependency graph with {len(request.nodes)} nodes and {len(request.edges)} edges")

        # Create graph analyzer
        analyzer = DependencyGraphAnalyzer()

        # Convert request models to graph objects
        nodes = [
            GraphNode(
                id=node.id,
                name=node.name,
                version=node.version,
                ecosystem=node.ecosystem,
                node_type=node.node_type,
                attributes=node.attributes
            )
            for node in request.nodes
        ]

        edges = [
            GraphEdge(
                source=edge.source,
                target=edge.target,
                edge_type=edge.edge_type,
                weight=edge.weight,
                attributes=edge.attributes
            )
            for edge in request.edges
        ]

        # Build and analyze graph
        analyzer.build_graph(nodes, edges)
        result = analyzer.analyze_graph()

        # Log audit event
        background_tasks.add_task(
            _log_graph_analysis_event,
            current_user.id, current_org.id, request, result
        )

        return GraphAnalysisResponse(
            graph_metrics=GraphMetricsResponse(
                node_count=result.graph_metrics.node_count,
                edge_count=result.graph_metrics.edge_count,
                density=result.graph_metrics.density,
                diameter=result.graph_metrics.diameter,
                radius=result.graph_metrics.radius,
                average_clustering=result.graph_metrics.average_clustering,
                transitivity=result.graph_metrics.transitivity,
                assortativity=result.graph_metrics.assortativity,
                modularity=result.graph_metrics.modularity,
                connected_components=result.graph_metrics.connected_components,
                largest_component_size=result.graph_metrics.largest_component_size
            ),
            centrality_metrics=CentralityMetricsResponse(
                degree_centrality=result.centrality_metrics.degree_centrality,
                betweenness_centrality=result.centrality_metrics.betweenness_centrality,
                closeness_centrality=result.centrality_metrics.closeness_centrality,
                eigenvector_centrality=result.centrality_metrics.eigenvector_centrality,
                pagerank=result.centrality_metrics.pagerank,
                harmonic_centrality=result.centrality_metrics.harmonic_centrality
            ),
            vulnerability_analysis=VulnerabilityAnalysisResponse(
                critical_nodes=result.vulnerability_analysis.critical_nodes,
                single_points_of_failure=result.vulnerability_analysis.single_points_of_failure,
                attack_surface=result.vulnerability_analysis.attack_surface,
                resilience_score=result.vulnerability_analysis.resilience_score,
                vulnerability_paths=result.vulnerability_analysis.vulnerability_paths
            ),
            recommendations=result.recommendations,
            analysis_timestamp=result.analysis_timestamp.isoformat(),
            analysis_duration=result.analysis_duration
        )

    except Exception as e:
        logger.error(f"Failed to analyze dependency graph: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze dependency graph: {str(e)}"
        )


@router.get("/node/{node_id}/metrics", response_model=NodeMetricsResponse)
async def get_node_metrics(
    node_id: str,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get detailed metrics for a specific node."""
    try:
        logger.info(f"Getting metrics for node {node_id}")

        # Create analyzer with mock data for demonstration
        analyzer = DependencyGraphAnalyzer()
        mock_nodes, mock_edges = _create_mock_graph_data()
        analyzer.build_graph(mock_nodes, mock_edges)

        metrics = analyzer.get_node_metrics(node_id)

        if not metrics:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Node {node_id} not found"
            )

        return NodeMetricsResponse(**metrics)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get node metrics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get node metrics: {str(e)}"
        )


@router.get("/centrality/{centrality_type}/top", response_model=list[dict[str, Any]])
async def get_top_central_nodes(
    centrality_type: CentralityType,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get top central nodes by specified centrality measure."""
    try:
        logger.info(f"Getting top {limit} nodes by {centrality_type.value} centrality")

        # Create analyzer with mock data
        analyzer = DependencyGraphAnalyzer()
        mock_nodes, mock_edges = _create_mock_graph_data()
        analyzer.build_graph(mock_nodes, mock_edges)

        top_nodes = analyzer.get_top_central_nodes(centrality_type, limit)
        return top_nodes

    except Exception as e:
        logger.error(f"Failed to get top central nodes: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get top central nodes: {str(e)}"
        )


@router.get("/cycles", response_model=list[list[str]])
async def find_cycles(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Find cycles in the dependency graph."""
    try:
        logger.info("Finding cycles in dependency graph")

        # Create analyzer with mock data
        analyzer = DependencyGraphAnalyzer()
        mock_nodes, mock_edges = _create_mock_graph_data()
        analyzer.build_graph(mock_nodes, mock_edges)

        cycles = analyzer.find_cycles()
        return cycles

    except Exception as e:
        logger.error(f"Failed to find cycles: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to find cycles: {str(e)}"
        )


@router.get("/path/{source}/{target}", response_model=list[str])
async def find_shortest_path(
    source: str,
    target: str,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Find shortest path between two nodes."""
    try:
        logger.info(f"Finding shortest path from {source} to {target}")

        # Create analyzer with mock data
        analyzer = DependencyGraphAnalyzer()
        mock_nodes, mock_edges = _create_mock_graph_data()
        analyzer.build_graph(mock_nodes, mock_edges)

        path = analyzer.find_shortest_path(source, target)
        return path

    except Exception as e:
        logger.error(f"Failed to find shortest path: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to find shortest path: {str(e)}"
        )


@router.get("/visualize", response_model=GraphVisualizationResponse)
async def visualize_graph(
    layout: str = "spring",
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Generate graph visualization data."""
    try:
        logger.info(f"Generating graph visualization with {layout} layout")

        # Create analyzer with mock data
        analyzer = DependencyGraphAnalyzer()
        mock_nodes, mock_edges = _create_mock_graph_data()
        analyzer.build_graph(mock_nodes, mock_edges)

        visualization = analyzer.visualize_graph(layout)
        return GraphVisualizationResponse(**visualization)

    except Exception as e:
        logger.error(f"Failed to visualize graph: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to visualize graph: {str(e)}"
        )


@router.get("/export/{format}", response_model=dict[str, Any])
async def export_graph(
    format: str,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Export graph in specified format."""
    try:
        logger.info(f"Exporting graph in {format} format")

        # Create analyzer with mock data
        analyzer = DependencyGraphAnalyzer()
        mock_nodes, mock_edges = _create_mock_graph_data()
        analyzer.build_graph(mock_nodes, mock_edges)

        exported_data = analyzer.export_graph(format)

        return {
            "format": format,
            "data": exported_data,
            "exported_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to export graph: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export graph: {str(e)}"
        )


@router.get("/centrality-types", response_model=list[dict[str, str]])
async def get_centrality_types(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get available centrality types."""
    try:
        centrality_types = [
            {
                "id": CentralityType.DEGREE.value,
                "name": "Degree Centrality",
                "description": "Number of connections to a node"
            },
            {
                "id": CentralityType.BETWEENNESS.value,
                "name": "Betweenness Centrality",
                "description": "How often a node lies on shortest paths"
            },
            {
                "id": CentralityType.CLOSENESS.value,
                "name": "Closeness Centrality",
                "description": "Average distance to all other nodes"
            },
            {
                "id": CentralityType.EIGENVECTOR.value,
                "name": "Eigenvector Centrality",
                "description": "Importance based on connections to important nodes"
            },
            {
                "id": CentralityType.PAGERANK.value,
                "name": "PageRank",
                "description": "Google's PageRank algorithm"
            },
            {
                "id": CentralityType.HARMONIC.value,
                "name": "Harmonic Centrality",
                "description": "Sum of reciprocal distances to other nodes"
            }
        ]
        return centrality_types
    except Exception as e:
        logger.error(f"Failed to get centrality types: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get centrality types: {str(e)}"
        )


@router.get("/statistics", response_model=dict[str, Any])
async def get_analysis_statistics(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """Get graph analysis statistics."""
    try:
        # Create analyzer with mock data
        analyzer = DependencyGraphAnalyzer()
        mock_nodes, mock_edges = _create_mock_graph_data()
        analyzer.build_graph(mock_nodes, mock_edges)

        stats = analyzer.get_analysis_statistics()
        return stats
    except Exception as e:
        logger.error(f"Failed to get analysis statistics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get analysis statistics: {str(e)}"
        )


# Helper Functions
def _create_mock_graph_data():
    """Create mock graph data for demonstration."""
    nodes = [
        GraphNode("react", "React", "18.2.0", "npm", "package", {"description": "React library"}),
        GraphNode("react-dom", "React DOM", "18.2.0", "npm", "package", {"description": "React DOM"}),
        GraphNode("loose-envify", "Loose Envify", "1.4.0", "npm", "package", {"description": "Environment variable replacement"}),
        GraphNode("js-tokens", "JS Tokens", "4.0.0", "npm", "package", {"description": "JavaScript tokenizer"}),
        GraphNode("fastapi", "FastAPI", "0.104.1", "pypi", "package", {"description": "FastAPI framework"}),
        GraphNode("starlette", "Starlette", "0.27.0", "pypi", "package", {"description": "Starlette framework"}),
        GraphNode("pydantic", "Pydantic", "2.5.0", "pypi", "package", {"description": "Data validation library"})
    ]

    edges = [
        GraphEdge("react", "loose-envify", "depends_on", 1.0, {}),
        GraphEdge("react", "js-tokens", "depends_on", 1.0, {}),
        GraphEdge("react-dom", "react", "depends_on", 1.0, {}),
        GraphEdge("react-dom", "loose-envify", "depends_on", 1.0, {}),
        GraphEdge("fastapi", "starlette", "depends_on", 1.0, {}),
        GraphEdge("fastapi", "pydantic", "depends_on", 1.0, {}),
        GraphEdge("starlette", "pydantic", "depends_on", 0.5, {})
    ]

    return nodes, edges


async def _log_graph_analysis_event(
    user_id: str,
    organization_id: UUID,
    request: GraphAnalysisRequest,
    result: GraphAnalysisResult
):
    """Log graph analysis event to audit logger."""
    try:
        from udp.security.audit_logger import (
            AuditEventSeverity,
            AuditEventStatus,
            AuditEventType,
            AuditLogger,
        )

        audit_logger = AuditLogger()
        audit_logger.log_event(
            event_type=AuditEventType.DEPENDENCY_ANALYSIS,
            action="graph_analysis",
            description=f"Analyzed dependency graph with {len(request.nodes)} nodes and {len(request.edges)} edges",
            user_id=user_id,
            organization_id=organization_id,
            details={
                "node_count": len(request.nodes),
                "edge_count": len(request.edges),
                "analysis_duration": result.analysis_duration,
                "critical_nodes": len(result.vulnerability_analysis.critical_nodes),
                "single_points_of_failure": len(result.vulnerability_analysis.single_points_of_failure),
                "resilience_score": result.vulnerability_analysis.resilience_score
            },
            severity=AuditEventSeverity.MEDIUM,
            status=AuditEventStatus.SUCCESS,
            tags=["graph", "analysis", "networkx"]
        )
    except Exception as e:
        logger.error(f"Failed to log graph analysis event: {e}")
