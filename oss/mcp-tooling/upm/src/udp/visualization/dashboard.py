"""
Interactive visualization dashboard.

Provides a comprehensive dashboard for dependency graph visualization
with multiple widgets, charts, and interactive controls.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum
from dataclasses import dataclass, asdict
from pydantic import BaseModel, Field

from .graph_visualizer import DependencyGraphVisualizer, GraphLayout, NodeType, EdgeType


class WidgetType(str, Enum):
    """Types of dashboard widgets."""
    GRAPH_VIEWER = "graph_viewer"
    METRICS_PANEL = "metrics_panel"
    FILTER_PANEL = "filter_panel"
    SEARCH_PANEL = "search_panel"
    LEGEND_PANEL = "legend_panel"
    TIMELINE = "timeline"
    HEATMAP = "heatmap"
    TREE_VIEW = "tree_view"
    TABLE_VIEW = "table_view"
    STATISTICS = "statistics"


class ChartType(str, Enum):
    """Types of charts."""
    BAR = "bar"
    LINE = "line"
    PIE = "pie"
    SCATTER = "scatter"
    AREA = "area"
    HISTOGRAM = "histogram"
    BOX_PLOT = "box_plot"
    HEATMAP = "heatmap"
    TREEMAP = "treemap"
    SANKEY = "sankey"


class FilterType(str, Enum):
    """Types of filters."""
    NODE_TYPE = "node_type"
    EDGE_TYPE = "edge_type"
    RISK_LEVEL = "risk_level"
    ECOSYSTEM = "ecosystem"
    VULNERABILITY = "vulnerability"
    LICENSE = "license"
    DATE_RANGE = "date_range"
    CUSTOM = "custom"


@dataclass
class DashboardWidget:
    """Represents a dashboard widget."""
    id: str
    title: str
    widget_type: WidgetType
    position: Dict[str, int]  # x, y, width, height
    config: Dict[str, Any]
    visible: bool = True
    collapsible: bool = True
    resizable: bool = True
    data: Optional[Dict[str, Any]] = None
    last_updated: Optional[datetime] = None


class DashboardConfig(BaseModel):
    """Configuration for the visualization dashboard."""
    title: str = "Dependency Graph Dashboard"
    theme: str = "light"
    layout: str = "grid"
    auto_refresh: bool = True
    refresh_interval: float = 5.0
    max_widgets: int = 20
    default_widget_size: Tuple[int, int] = (300, 200)
    grid_size: int = 20
    snap_to_grid: bool = True
    show_grid: bool = True
    enable_fullscreen: bool = True
    enable_export: bool = True
    enable_sharing: bool = True
    enable_collaboration: bool = False


class VisualizationDashboard:
    """Interactive visualization dashboard."""
    
    def __init__(self, config: Optional[DashboardConfig] = None):
        """Initialize the dashboard."""
        self.config = config or DashboardConfig()
        self.widgets: Dict[str, DashboardWidget] = {}
        self.graph_visualizer: Optional[DependencyGraphVisualizer] = None
        self.is_initialized = False
        self.update_callbacks: List[callable] = []
        self.widget_callbacks: Dict[str, List[callable]] = {}
        self.current_filters: Dict[str, Any] = {}
        self.search_query: str = ""
        self.selected_time_range: Optional[Tuple[datetime, datetime]] = None
        
        # Dashboard state
        self.fullscreen_widget: Optional[str] = None
        self.collaboration_enabled = self.config.enable_collaboration
        self.active_users: List[str] = []
        
    async def initialize(self, graph_visualizer: DependencyGraphVisualizer):
        """Initialize the dashboard with a graph visualizer."""
        try:
            self.graph_visualizer = graph_visualizer
            
            # Create default widgets
            await self._create_default_widgets()
            
            # Set up callbacks
            self._setup_graph_callbacks()
            
            self.is_initialized = True
            await self._notify_update_callbacks("dashboard_initialized")
            
        except Exception as e:
            raise Exception(f"Failed to initialize dashboard: {e}")
    
    async def _create_default_widgets(self):
        """Create default dashboard widgets."""
        # Graph viewer widget
        graph_widget = DashboardWidget(
            id="graph_viewer",
            title="Dependency Graph",
            widget_type=WidgetType.GRAPH_VIEWER,
            position={"x": 0, "y": 0, "width": 800, "height": 600},
            config={
                "layout": GraphLayout.FORCE_DIRECTED.value,
                "interaction_enabled": True,
                "animation_enabled": True,
                "show_labels": True,
                "show_edges": True,
                "node_size_multiplier": 1.0,
                "edge_width_multiplier": 1.0
            }
        )
        self.widgets["graph_viewer"] = graph_widget
        
        # Metrics panel widget
        metrics_widget = DashboardWidget(
            id="metrics_panel",
            title="Graph Metrics",
            widget_type=WidgetType.METRICS_PANEL,
            position={"x": 800, "y": 0, "width": 300, "height": 200},
            config={
                "show_node_count": True,
                "show_edge_count": True,
                "show_vulnerability_count": True,
                "show_risk_score": True,
                "show_connected_components": True,
                "show_density": True
            }
        )
        self.widgets["metrics_panel"] = metrics_widget
        
        # Filter panel widget
        filter_widget = DashboardWidget(
            id="filter_panel",
            title="Filters",
            widget_type=WidgetType.FILTER_PANEL,
            position={"x": 800, "y": 200, "width": 300, "height": 300},
            config={
                "available_filters": [
                    FilterType.NODE_TYPE.value,
                    FilterType.EDGE_TYPE.value,
                    FilterType.RISK_LEVEL.value,
                    FilterType.ECOSYSTEM.value,
                    FilterType.VULNERABILITY.value
                ],
                "multi_select": True,
                "show_counts": True
            }
        )
        self.widgets["filter_panel"] = filter_widget
        
        # Search panel widget
        search_widget = DashboardWidget(
            id="search_panel",
            title="Search",
            widget_type=WidgetType.SEARCH_PANEL,
            position={"x": 800, "y": 500, "width": 300, "height": 100},
            config={
                "placeholder": "Search nodes...",
                "search_fields": ["name", "label", "description"],
                "highlight_results": True,
                "max_results": 50
            }
        )
        self.widgets["search_panel"] = search_widget
        
        # Legend panel widget
        legend_widget = DashboardWidget(
            id="legend_panel",
            title="Legend",
            widget_type=WidgetType.LEGEND_PANEL,
            position={"x": 0, "y": 600, "width": 400, "height": 150},
            config={
                "show_node_types": True,
                "show_edge_types": True,
                "show_colors": True,
                "show_risk_levels": True
            }
        )
        self.widgets["legend_panel"] = legend_widget
        
        # Statistics widget
        stats_widget = DashboardWidget(
            id="statistics",
            title="Statistics",
            widget_type=WidgetType.STATISTICS,
            position={"x": 400, "y": 600, "width": 400, "height": 150},
            config={
                "chart_type": ChartType.BAR.value,
                "show_node_type_distribution": True,
                "show_edge_type_distribution": True,
                "show_risk_distribution": True,
                "show_ecosystem_distribution": True
            }
        )
        self.widgets["statistics"] = stats_widget
    
    def _setup_graph_callbacks(self):
        """Set up callbacks for graph visualizer events."""
        if self.graph_visualizer:
            self.graph_visualizer.add_update_callback(self._on_graph_update)
            self.graph_visualizer.add_selection_callback(self._on_node_selection)
            self.graph_visualizer.add_filter_callback(self._on_graph_filter)
    
    async def _on_graph_update(self, event_type: str, visualizer: DependencyGraphVisualizer):
        """Handle graph update events."""
        # Update relevant widgets
        await self._update_metrics_widget()
        await self._update_legend_widget()
        await self._update_statistics_widget()
        
        # Notify dashboard callbacks
        await self._notify_update_callbacks(f"graph_{event_type}")
    
    async def _on_node_selection(self, selected_nodes: set, visualizer: DependencyGraphVisualizer):
        """Handle node selection events."""
        # Update widgets that depend on selection
        await self._update_selection_dependent_widgets(selected_nodes)
        
        # Notify dashboard callbacks
        await self._notify_update_callbacks("node_selection_changed")
    
    async def _on_graph_filter(self, filtered_nodes: set, filtered_edges: set, visualizer: DependencyGraphVisualizer):
        """Handle graph filter events."""
        # Update widgets that show filtered data
        await self._update_filter_dependent_widgets(filtered_nodes, filtered_edges)
        
        # Notify dashboard callbacks
        await self._notify_update_callbacks("graph_filtered")
    
    async def _update_metrics_widget(self):
        """Update the metrics widget."""
        if "metrics_panel" not in self.widgets or not self.graph_visualizer:
            return
        
        metrics = self.graph_visualizer.metrics
        if metrics:
            self.widgets["metrics_panel"].data = {
                "total_nodes": metrics.total_nodes,
                "total_edges": metrics.total_edges,
                "vulnerability_count": metrics.vulnerability_count,
                "risk_score": metrics.risk_score,
                "connected_components": metrics.connected_components,
                "density": metrics.density,
                "average_degree": metrics.average_degree,
                "clustering_coefficient": metrics.clustering_coefficient,
                "last_updated": datetime.utcnow().isoformat()
            }
            self.widgets["metrics_panel"].last_updated = datetime.utcnow()
    
    async def _update_legend_widget(self):
        """Update the legend widget."""
        if "legend_panel" not in self.widgets or not self.graph_visualizer:
            return
        
        # Collect node type information
        node_types = {}
        edge_types = {}
        risk_levels = {}
        
        for node in self.graph_visualizer.nodes.values():
            node_type = node.node_type.value
            if node_type not in node_types:
                node_types[node_type] = {"count": 0, "color": node.color}
            node_types[node_type]["count"] += 1
            
            # Determine risk level
            risk_level = self._get_node_risk_level(node)
            if risk_level not in risk_levels:
                risk_levels[risk_level] = {"count": 0, "color": node.color}
            risk_levels[risk_level]["count"] += 1
        
        for edge in self.graph_visualizer.edges.values():
            edge_type = edge.edge_type.value
            if edge_type not in edge_types:
                edge_types[edge_type] = {"count": 0, "color": edge.color}
            edge_types[edge_type]["count"] += 1
        
        self.widgets["legend_panel"].data = {
            "node_types": node_types,
            "edge_types": edge_types,
            "risk_levels": risk_levels,
            "last_updated": datetime.utcnow().isoformat()
        }
        self.widgets["legend_panel"].last_updated = datetime.utcnow()
    
    async def _update_statistics_widget(self):
        """Update the statistics widget."""
        if "statistics" not in self.widgets or not self.graph_visualizer:
            return
        
        metrics = self.graph_visualizer.metrics
        if metrics:
            self.widgets["statistics"].data = {
                "node_type_distribution": metrics.node_types,
                "edge_type_distribution": metrics.edge_types,
                "risk_distribution": self._calculate_risk_distribution(),
                "ecosystem_distribution": self._calculate_ecosystem_distribution(),
                "chart_data": self._prepare_chart_data(),
                "last_updated": datetime.utcnow().isoformat()
            }
            self.widgets["statistics"].last_updated = datetime.utcnow()
    
    def _get_node_risk_level(self, node) -> str:
        """Get risk level for a node."""
        if node.node_type == NodeType.VULNERABILITY:
            return node.data.get('severity', 'LOW')
        elif node.node_type == NodeType.PACKAGE:
            if node.color == "#e74c3c":
                return "CRITICAL"
            elif node.color == "#f39c12":
                return "HIGH"
            elif node.color == "#f1c40f":
                return "MEDIUM"
            else:
                return "LOW"
        return "LOW"
    
    def _calculate_risk_distribution(self) -> Dict[str, int]:
        """Calculate risk level distribution."""
        risk_distribution = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        
        for node in self.graph_visualizer.nodes.values():
            risk_level = self._get_node_risk_level(node)
            risk_distribution[risk_level] += 1
        
        return risk_distribution
    
    def _calculate_ecosystem_distribution(self) -> Dict[str, int]:
        """Calculate ecosystem distribution."""
        ecosystem_distribution = {}
        
        for node in self.graph_visualizer.nodes.values():
            ecosystem = node.data.get('ecosystem', 'unknown')
            ecosystem_distribution[ecosystem] = ecosystem_distribution.get(ecosystem, 0) + 1
        
        return ecosystem_distribution
    
    def _prepare_chart_data(self) -> Dict[str, Any]:
        """Prepare data for charts."""
        metrics = self.graph_visualizer.metrics
        if not metrics:
            return {}
        
        return {
            "node_types": {
                "labels": list(metrics.node_types.keys()),
                "data": list(metrics.node_types.values())
            },
            "edge_types": {
                "labels": list(metrics.edge_types.keys()),
                "data": list(metrics.edge_types.values())
            },
            "risk_levels": {
                "labels": list(self._calculate_risk_distribution().keys()),
                "data": list(self._calculate_risk_distribution().values())
            }
        }
    
    async def _update_selection_dependent_widgets(self, selected_nodes: set):
        """Update widgets that depend on node selection."""
        # Update any widgets that show details about selected nodes
        for widget_id, widget in self.widgets.items():
            if widget.widget_type in [WidgetType.TABLE_VIEW, WidgetType.TREE_VIEW]:
                await self._update_widget_data(widget_id, {"selected_nodes": list(selected_nodes)})
    
    async def _update_filter_dependent_widgets(self, filtered_nodes: set, filtered_edges: set):
        """Update widgets that depend on graph filtering."""
        # Update widgets that show filtered data
        for widget_id, widget in self.widgets.items():
            if widget.widget_type in [WidgetType.TABLE_VIEW, WidgetType.STATISTICS]:
                await self._update_widget_data(widget_id, {
                    "filtered_nodes": list(filtered_nodes),
                    "filtered_edges": list(filtered_edges)
                })
    
    async def add_widget(self, widget: DashboardWidget):
        """Add a widget to the dashboard."""
        if len(self.widgets) >= self.config.max_widgets:
            raise ValueError(f"Maximum number of widgets ({self.config.max_widgets}) reached")
        
        self.widgets[widget.id] = widget
        await self._notify_update_callbacks("widget_added")
    
    async def remove_widget(self, widget_id: str):
        """Remove a widget from the dashboard."""
        if widget_id in self.widgets:
            del self.widgets[widget_id]
            await self._notify_update_callbacks("widget_removed")
    
    async def update_widget(self, widget_id: str, updates: Dict[str, Any]):
        """Update a widget."""
        if widget_id in self.widgets:
            widget = self.widgets[widget_id]
            for key, value in updates.items():
                if hasattr(widget, key):
                    setattr(widget, key, value)
            
            await self._update_widget_data(widget_id, updates)
            await self._notify_update_callbacks("widget_updated")
    
    async def _update_widget_data(self, widget_id: str, data: Dict[str, Any]):
        """Update widget data."""
        if widget_id in self.widgets:
            if self.widgets[widget_id].data is None:
                self.widgets[widget_id].data = {}
            self.widgets[widget_id].data.update(data)
            self.widgets[widget_id].last_updated = datetime.utcnow()
    
    async def move_widget(self, widget_id: str, position: Dict[str, int]):
        """Move a widget to a new position."""
        if widget_id in self.widgets:
            self.widgets[widget_id].position.update(position)
            await self._notify_update_callbacks("widget_moved")
    
    async def resize_widget(self, widget_id: str, size: Dict[str, int]):
        """Resize a widget."""
        if widget_id in self.widgets:
            self.widgets[widget_id].position.update(size)
            await self._notify_update_callbacks("widget_resized")
    
    async def toggle_widget_visibility(self, widget_id: str):
        """Toggle widget visibility."""
        if widget_id in self.widgets:
            self.widgets[widget_id].visible = not self.widgets[widget_id].visible
            await self._notify_update_callbacks("widget_visibility_toggled")
    
    async def set_fullscreen_widget(self, widget_id: Optional[str]):
        """Set a widget to fullscreen mode."""
        self.fullscreen_widget = widget_id
        await self._notify_update_callbacks("fullscreen_changed")
    
    async def apply_filters(self, filters: Dict[str, Any]):
        """Apply filters to the graph."""
        self.current_filters = filters
        
        if self.graph_visualizer:
            await self.graph_visualizer.filter_graph(filters)
        
        await self._notify_update_callbacks("filters_applied")
    
    async def search(self, query: str):
        """Search for nodes in the graph."""
        self.search_query = query
        
        if self.graph_visualizer:
            results = await self.graph_visualizer.search_nodes(query)
            
            # Update search widget
            if "search_panel" in self.widgets:
                await self._update_widget_data("search_panel", {
                    "query": query,
                    "results": [{"id": node.id, "label": node.label, "type": node.node_type.value} for node in results],
                    "result_count": len(results)
                })
            
            # Highlight search results
            if results:
                node_ids = [node.id for node in results]
                await self.graph_visualizer.highlight_nodes(node_ids)
        
        await self._notify_update_callbacks("search_performed")
    
    async def set_time_range(self, start_time: datetime, end_time: datetime):
        """Set the time range for temporal analysis."""
        self.selected_time_range = (start_time, end_time)
        
        # Update widgets that support time-based filtering
        for widget_id, widget in self.widgets.items():
            if widget.widget_type == WidgetType.TIMELINE:
                await self._update_widget_data(widget_id, {
                    "time_range": {
                        "start": start_time.isoformat(),
                        "end": end_time.isoformat()
                    }
                })
        
        await self._notify_update_callbacks("time_range_changed")
    
    async def change_graph_layout(self, layout: GraphLayout):
        """Change the graph layout."""
        if self.graph_visualizer:
            await self.graph_visualizer.set_layout(layout)
            
            # Update graph viewer widget
            if "graph_viewer" in self.widgets:
                await self._update_widget_data("graph_viewer", {"layout": layout.value})
    
    async def export_dashboard(self, format: str = "json") -> Dict[str, Any]:
        """Export the dashboard configuration and data."""
        return {
            "config": self.config.dict(),
            "widgets": {widget_id: asdict(widget) for widget_id, widget in self.widgets.items()},
            "filters": self.current_filters,
            "search_query": self.search_query,
            "time_range": {
                "start": self.selected_time_range[0].isoformat() if self.selected_time_range else None,
                "end": self.selected_time_range[1].isoformat() if self.selected_time_range else None
            },
            "fullscreen_widget": self.fullscreen_widget,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    async def import_dashboard(self, data: Dict[str, Any]):
        """Import dashboard configuration and data."""
        try:
            # Update config
            if "config" in data:
                self.config = DashboardConfig(**data["config"])
            
            # Update widgets
            if "widgets" in data:
                self.widgets.clear()
                for widget_id, widget_data in data["widgets"].items():
                    widget = DashboardWidget(**widget_data)
                    self.widgets[widget_id] = widget
            
            # Update state
            if "filters" in data:
                self.current_filters = data["filters"]
            
            if "search_query" in data:
                self.search_query = data["search_query"]
            
            if "time_range" in data and data["time_range"]["start"]:
                start_time = datetime.fromisoformat(data["time_range"]["start"])
                end_time = datetime.fromisoformat(data["time_range"]["end"])
                self.selected_time_range = (start_time, end_time)
            
            if "fullscreen_widget" in data:
                self.fullscreen_widget = data["fullscreen_widget"]
            
            await self._notify_update_callbacks("dashboard_imported")
            
        except Exception as e:
            raise Exception(f"Failed to import dashboard: {e}")
    
    def add_update_callback(self, callback: callable):
        """Add a callback for dashboard updates."""
        self.update_callbacks.append(callback)
    
    def add_widget_callback(self, widget_id: str, callback: callable):
        """Add a callback for specific widget updates."""
        if widget_id not in self.widget_callbacks:
            self.widget_callbacks[widget_id] = []
        self.widget_callbacks[widget_id].append(callback)
    
    async def _notify_update_callbacks(self, event_type: str):
        """Notify update callbacks."""
        for callback in self.update_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event_type, self)
                else:
                    callback(event_type, self)
            except Exception as e:
                print(f"Error in dashboard update callback: {e}")
    
    async def get_dashboard_summary(self) -> Dict[str, Any]:
        """Get a summary of the dashboard state."""
        return {
            "is_initialized": self.is_initialized,
            "total_widgets": len(self.widgets),
            "visible_widgets": len([w for w in self.widgets.values() if w.visible]),
            "current_filters": self.current_filters,
            "search_query": self.search_query,
            "time_range": self.selected_time_range,
            "fullscreen_widget": self.fullscreen_widget,
            "collaboration_enabled": self.collaboration_enabled,
            "active_users": self.active_users,
            "config": self.config.dict()
        }







