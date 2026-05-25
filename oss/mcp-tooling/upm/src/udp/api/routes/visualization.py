"""
API routes for visualization system.

Provides endpoints for interactive dependency graph visualization,
dashboard management, analytics, and export functionality.
"""

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel

# Mock models for visualization
try:
    from udp.core.models import Dependency, Project, Vulnerability
except ImportError:
    # Mock models for testing
    from datetime import datetime

    from pydantic import BaseModel as PydanticBaseModel

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
        dependencies: Optional[list['Dependency']] = None
        vulnerabilities: Optional[list['Vulnerability']] = None

    class Vulnerability(PydanticBaseModel):
        id: str
        title: str
        description: str
        severity: str
        cvss_score: Optional[float] = None
        affected_dependencies: Optional[list[Dependency]] = None
from udp.visualization.analytics import (
    AnalyticsEngine,
    AnalyticsType,
)
from udp.visualization.dashboard import (
    DashboardConfig,
    VisualizationDashboard,
    WidgetType,
)
from udp.visualization.exporters import (
    ExportConfig,
    ExportFormat,
    GraphExporter,
    ReportExporter,
)
from udp.visualization.graph_visualizer import (
    DependencyGraphVisualizer,
    EdgeType,
    GraphLayout,
    NodeType,
    VisualizationConfig,
)

router = APIRouter()

# Global visualization instances
graph_visualizer: Optional[DependencyGraphVisualizer] = None
dashboard: Optional[VisualizationDashboard] = None
analytics_engine: Optional[AnalyticsEngine] = None

# Visualization state
visualization_initialized = False


class VisualizationRequest(BaseModel):
    """Request model for visualization operations."""
    project_id: Optional[str] = None
    layout: Optional[GraphLayout] = GraphLayout.FORCE_DIRECTED
    config: Optional[VisualizationConfig] = None


class DashboardRequest(BaseModel):
    """Request model for dashboard operations."""
    title: str = "Dependency Graph Dashboard"
    config: Optional[DashboardConfig] = None


class AnalyticsRequest(BaseModel):
    """Request model for analytics operations."""
    analytics_types: list[AnalyticsType] = [AnalyticsType.DEPENDENCY_ANALYSIS]
    time_range: Optional[dict[str, str]] = None
    root_node_id: Optional[str] = None
    max_depth: int = 5


class ExportRequest(BaseModel):
    """Request model for export operations."""
    format: ExportFormat = ExportFormat.JSON
    include_metadata: bool = True
    include_positions: bool = True
    include_analytics: bool = False
    compress: bool = False


class FilterRequest(BaseModel):
    """Request model for filtering operations."""
    filters: dict[str, Any] = {}
    node_types: Optional[list[NodeType]] = None
    edge_types: Optional[list[EdgeType]] = None
    risk_levels: Optional[list[str]] = None
    ecosystems: Optional[list[str]] = None


class SearchRequest(BaseModel):
    """Request model for search operations."""
    query: str
    max_results: int = 50
    search_fields: list[str] = ["name", "label", "description"]


async def get_visualization_system():
    """Get or initialize the visualization system."""
    global graph_visualizer, dashboard, analytics_engine, visualization_initialized

    if not visualization_initialized:
        try:
            # Initialize graph visualizer
            config = VisualizationConfig()
            graph_visualizer = DependencyGraphVisualizer(config)
            await graph_visualizer.initialize()

            # Initialize dashboard
            dashboard_config = DashboardConfig()
            dashboard = VisualizationDashboard(dashboard_config)
            await dashboard.initialize(graph_visualizer)

            # Initialize analytics engine
            analytics_engine = AnalyticsEngine(graph_visualizer)

            visualization_initialized = True

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to initialize visualization system: {e}")

    return graph_visualizer, dashboard, analytics_engine


@router.post("/initialize")
async def initialize_visualization(request: VisualizationRequest = Body(...)):
    """Initialize the visualization system."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        return {
            "status": "success",
            "message": "Visualization system initialized",
            "graph_visualizer": await graph_visualizer.get_graph_summary(),
            "dashboard": await dashboard.get_dashboard_summary()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/load")
async def load_project_into_visualization(
    project_id: str,
    request: VisualizationRequest = Body(...)
):
    """Load a project and its dependencies into the visualization."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        # In a real implementation, you would fetch the project data from the database
        # For now, we'll create mock data
        project = Project(
            id=project_id,
            name=f"Project {project_id}",
            description="A test project for visualization",
            ecosystem="pypi",
            package_manager="pip"
        )

        # Mock dependencies
        dependencies = [
            Dependency(
                id=f"dep_{i}",
                name=f"package_{i}",
                version=f"1.{i}.0",
                ecosystem="pypi",
                is_direct=i < 5,
                license="MIT"
            )
            for i in range(10)
        ]

        # Mock vulnerabilities
        vulnerabilities = [
            Vulnerability(
                id=f"vuln_{i}",
                title=f"Vulnerability {i}",
                description=f"Test vulnerability {i}",
                severity="HIGH" if i % 3 == 0 else "MEDIUM",
                cvss_score=7.5 if i % 3 == 0 else 5.0
            )
            for i in range(3)
        ]

        # Add project to graph
        await graph_visualizer.add_project(project, dependencies, vulnerabilities)

        return {
            "status": "success",
            "message": f"Project {project_id} loaded into visualization",
            "project_id": project_id,
            "dependencies_loaded": len(dependencies),
            "vulnerabilities_loaded": len(vulnerabilities),
            "graph_summary": await graph_visualizer.get_graph_summary()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph/summary")
async def get_graph_summary():
    """Get a summary of the current graph state."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        return await graph_visualizer.get_graph_summary()

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph/export")
async def export_graph(
    format: ExportFormat = Query(ExportFormat.JSON),
    include_metadata: bool = Query(True),
    include_positions: bool = Query(True),
    include_analytics: bool = Query(False)
):
    """Export the graph data."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        config = ExportConfig(
            format=format,
            include_metadata=include_metadata,
            include_positions=include_positions,
            include_analytics=include_analytics
        )

        exporter = GraphExporter(graph_visualizer)
        export_data = await exporter.export(config)

        return {
            "status": "success",
            "format": format.value,
            "data": export_data,
            "export_timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/graph/layout")
async def change_graph_layout(layout: GraphLayout = Body(...)):
    """Change the graph layout."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        await graph_visualizer.set_layout(layout)

        return {
            "status": "success",
            "message": f"Graph layout changed to {layout.value}",
            "current_layout": layout.value
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/graph/filter")
async def filter_graph(request: FilterRequest = Body(...)):
    """Filter the graph based on criteria."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        # Build filters
        filters = request.filters.copy()

        if request.node_types:
            filters["node_type"] = [t.value for t in request.node_types]

        if request.edge_types:
            filters["edge_type"] = [t.value for t in request.edge_types]

        if request.risk_levels:
            filters["risk_level"] = request.risk_levels

        if request.ecosystems:
            filters["ecosystem"] = request.ecosystems

        await graph_visualizer.filter_graph(filters)

        return {
            "status": "success",
            "message": "Graph filtered",
            "filters_applied": filters,
            "filtered_nodes": len(graph_visualizer.filtered_nodes),
            "filtered_edges": len(graph_visualizer.filtered_edges)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/graph/search")
async def search_graph(request: SearchRequest = Body(...)):
    """Search for nodes in the graph."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        results = await graph_visualizer.search_nodes(request.query)

        # Limit results
        limited_results = results[:request.max_results]

        return {
            "status": "success",
            "query": request.query,
            "results": [
                {
                    "id": node.id,
                    "label": node.label,
                    "type": node.node_type.value,
                    "data": node.data
                }
                for node in limited_results
            ],
            "total_results": len(results),
            "returned_results": len(limited_results)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/graph/select")
async def select_nodes(node_ids: list[str] = Body(...)):
    """Select nodes in the graph."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        await graph_visualizer.select_nodes(node_ids)

        return {
            "status": "success",
            "message": f"Selected {len(node_ids)} nodes",
            "selected_nodes": node_ids
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/graph/highlight")
async def highlight_nodes(node_ids: list[str] = Body(...)):
    """Highlight nodes in the graph."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        await graph_visualizer.highlight_nodes(node_ids)

        return {
            "status": "success",
            "message": f"Highlighted {len(node_ids)} nodes",
            "highlighted_nodes": node_ids
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph/neighbors/{node_id}")
async def get_node_neighbors(
    node_id: str,
    depth: int = Query(1, ge=1, le=5)
):
    """Get neighbors of a node."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        neighbors = await graph_visualizer.get_node_neighbors(node_id, depth)

        return {
            "status": "success",
            "node_id": node_id,
            "depth": depth,
            "neighbors": [
                {
                    "id": node.id,
                    "label": node.label,
                    "type": node.node_type.value,
                    "data": node.data
                }
                for node in neighbors
            ],
            "neighbor_count": len(neighbors)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/summary")
async def get_dashboard_summary():
    """Get dashboard summary."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        return await dashboard.get_dashboard_summary()

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/widgets")
async def get_dashboard_widgets():
    """Get all dashboard widgets."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        widgets = {}
        for widget_id, widget in dashboard.widgets.items():
            widgets[widget_id] = {
                "id": widget.id,
                "title": widget.title,
                "type": widget.widget_type.value,
                "position": widget.position,
                "visible": widget.visible,
                "data": widget.data,
                "last_updated": widget.last_updated.isoformat() if widget.last_updated else None
            }

        return {
            "status": "success",
            "widgets": widgets,
            "total_widgets": len(widgets)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dashboard/widgets")
async def create_widget(
    widget_id: str = Body(...),
    title: str = Body(...),
    widget_type: WidgetType = Body(...),
    position: dict[str, int] = Body(...),
    config: dict[str, Any] = Body(default={})
):
    """Create a new dashboard widget."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        from udp.visualization.dashboard import DashboardWidget

        widget = DashboardWidget(
            id=widget_id,
            title=title,
            widget_type=widget_type,
            position=position,
            config=config
        )

        await dashboard.add_widget(widget)

        return {
            "status": "success",
            "message": f"Widget {widget_id} created",
            "widget": {
                "id": widget.id,
                "title": widget.title,
                "type": widget.widget_type.value,
                "position": widget.position
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/dashboard/widgets/{widget_id}")
async def delete_widget(widget_id: str):
    """Delete a dashboard widget."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        await dashboard.remove_widget(widget_id)

        return {
            "status": "success",
            "message": f"Widget {widget_id} deleted"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dashboard/export")
async def export_dashboard(
    format: ExportFormat = Body(ExportFormat.JSON),
    include_data: bool = Body(True)
):
    """Export dashboard configuration and data."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        export_data = await dashboard.export_dashboard(format.value)

        return {
            "status": "success",
            "format": format.value,
            "data": export_data,
            "export_timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analytics/run")
async def run_analytics(request: AnalyticsRequest = Body(...)):
    """Run analytics on the graph."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        # Prepare kwargs
        kwargs = {}
        if request.time_range:
            start_time = datetime.fromisoformat(request.time_range["start"])
            end_time = datetime.fromisoformat(request.time_range["end"])
            kwargs["time_range"] = (start_time, end_time)

        if request.root_node_id:
            kwargs["root_node_id"] = request.root_node_id
            kwargs["max_depth"] = request.max_depth

        # Run analytics
        results = await analytics_engine.run_analytics(request.analytics_types, **kwargs)

        # Format results
        formatted_results = {}
        for analytics_type, result in results.items():
            formatted_results[analytics_type] = {
                "insights": result.insights,
                "recommendations": result.recommendations,
                "confidence": result.confidence,
                "timestamp": result.timestamp.isoformat(),
                "data_summary": {
                    "keys": list(result.data.keys()) if result.data else []
                }
            }

        return {
            "status": "success",
            "analytics_types": [t.value for t in request.analytics_types],
            "results": formatted_results,
            "total_analytics": len(results)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/summary")
async def get_analytics_summary():
    """Get analytics summary."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        return await analytics_engine.get_analytics_summary()

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports/generate")
async def generate_report(
    format: ExportFormat = Body(ExportFormat.HTML),
    include_analytics: bool = Body(True),
    include_widgets: bool = Body(True)
):
    """Generate a comprehensive report."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        # Get analytics results if requested
        analytics_results = None
        if include_analytics:
            results = await analytics_engine.run_analytics([
                AnalyticsType.DEPENDENCY_ANALYSIS,
                AnalyticsType.VULNERABILITY_ANALYSIS,
                AnalyticsType.RISK_ANALYSIS
            ])
            analytics_results = results

        # Create export config
        config = ExportConfig(
            format=format,
            include_metadata=True,
            include_positions=True,
            include_analytics=include_analytics
        )

        # Generate report
        exporter = ReportExporter(graph_visualizer, dashboard)
        report_data = await exporter.export_comprehensive_report(config, analytics_results)

        return {
            "status": "success",
            "format": format.value,
            "report_data": report_data,
            "generated_timestamp": datetime.utcnow().isoformat(),
            "includes_analytics": include_analytics,
            "includes_widgets": include_widgets
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def visualization_health():
    """Check visualization system health."""
    try:
        graph_visualizer, dashboard, analytics_engine = await get_visualization_system()

        return {
            "status": "healthy",
            "visualization_initialized": visualization_initialized,
            "graph_visualizer": {
                "initialized": graph_visualizer.is_initialized,
                "total_nodes": len(graph_visualizer.nodes),
                "total_edges": len(graph_visualizer.edges)
            },
            "dashboard": {
                "initialized": dashboard.is_initialized,
                "total_widgets": len(dashboard.widgets)
            },
            "analytics_engine": {
                "available": analytics_engine is not None
            },
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
