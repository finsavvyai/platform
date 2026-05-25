"""
Export functionality for visualization data.

Provides various export formats for graphs, charts, and reports.
"""

import json
import csv
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from enum import Enum
from dataclasses import asdict
import base64
from io import StringIO, BytesIO

from .graph_visualizer import DependencyGraphVisualizer, GraphNode, GraphEdge
from .dashboard import VisualizationDashboard
from .analytics import AnalyticsResult


class ExportFormat(str, Enum):
    """Supported export formats."""
    JSON = "json"
    CSV = "csv"
    XML = "xml"
    SVG = "svg"
    PNG = "png"
    PDF = "pdf"
    HTML = "html"
    DOT = "dot"
    GEXF = "gexf"
    GRAPHML = "graphml"


class ExportConfig:
    """Configuration for exports."""
    
    def __init__(
        self,
        format: ExportFormat,
        include_metadata: bool = True,
        include_positions: bool = True,
        include_analytics: bool = False,
        compress: bool = False,
        custom_fields: Optional[List[str]] = None
    ):
        """Initialize export configuration."""
        self.format = format
        self.include_metadata = include_metadata
        self.include_positions = include_positions
        self.include_analytics = include_analytics
        self.compress = compress
        self.custom_fields = custom_fields or []


class GraphExporter:
    """Exporter for graph data."""
    
    def __init__(self, graph_visualizer: DependencyGraphVisualizer):
        """Initialize graph exporter."""
        self.graph_visualizer = graph_visualizer
    
    async def export(self, config: ExportConfig) -> Union[str, bytes]:
        """Export graph data in the specified format."""
        if config.format == ExportFormat.JSON:
            return await self._export_json(config)
        elif config.format == ExportFormat.CSV:
            return await self._export_csv(config)
        elif config.format == ExportFormat.XML:
            return await self._export_xml(config)
        elif config.format == ExportFormat.DOT:
            return await self._export_dot(config)
        elif config.format == ExportFormat.GEXF:
            return await self._export_gexf(config)
        elif config.format == ExportFormat.GRAPHML:
            return await self._export_graphml(config)
        else:
            raise ValueError(f"Unsupported export format: {config.format}")
    
    async def _export_json(self, config: ExportConfig) -> str:
        """Export graph as JSON."""
        export_data = {
            "metadata": {
                "export_timestamp": datetime.utcnow().isoformat(),
                "format": "json",
                "version": "1.0"
            },
            "graph": {
                "nodes": [],
                "edges": [],
                "metrics": asdict(self.graph_visualizer.metrics) if self.graph_visualizer.metrics else None
            }
        }
        
        # Add nodes
        for node in self.graph_visualizer.nodes.values():
            node_data = {
                "id": node.id,
                "label": node.label,
                "type": node.node_type.value,
                "data": node.data
            }
            
            if config.include_positions and node.position:
                node_data["position"] = {"x": node.position[0], "y": node.position[1]}
            
            if config.include_metadata:
                node_data["metadata"] = node.metadata
            
            export_data["graph"]["nodes"].append(node_data)
        
        # Add edges
        for edge in self.graph_visualizer.edges.values():
            edge_data = {
                "id": edge.id,
                "source": edge.source,
                "target": edge.target,
                "type": edge.edge_type.value,
                "data": edge.data,
                "weight": edge.weight
            }
            
            if config.include_metadata:
                edge_data["metadata"] = edge.metadata
            
            export_data["graph"]["edges"].append(edge_data)
        
        return json.dumps(export_data, indent=2)
    
    async def _export_csv(self, config: ExportConfig) -> str:
        """Export graph as CSV files."""
        output = StringIO()
        
        # Export nodes
        nodes_writer = csv.writer(output)
        nodes_writer.writerow(["id", "label", "type", "data", "position_x", "position_y"])
        
        for node in self.graph_visualizer.nodes.values():
            row = [
                node.id,
                node.label,
                node.node_type.value,
                json.dumps(node.data),
                node.position[0] if node.position else "",
                node.position[1] if node.position else ""
            ]
            nodes_writer.writerow(row)
        
        output.write("\n\n")  # Separator between nodes and edges
        
        # Export edges
        edges_writer = csv.writer(output)
        edges_writer.writerow(["id", "source", "target", "type", "weight", "data"])
        
        for edge in self.graph_visualizer.edges.values():
            row = [
                edge.id,
                edge.source,
                edge.target,
                edge.edge_type.value,
                edge.weight,
                json.dumps(edge.data)
            ]
            edges_writer.writerow(row)
        
        return output.getvalue()
    
    async def _export_xml(self, config: ExportConfig) -> str:
        """Export graph as XML."""
        root = ET.Element("graph")
        root.set("version", "1.0")
        root.set("export_timestamp", datetime.utcnow().isoformat())
        
        # Add metadata
        if config.include_metadata:
            metadata = ET.SubElement(root, "metadata")
            if self.graph_visualizer.metrics:
                metrics_elem = ET.SubElement(metadata, "metrics")
                for key, value in asdict(self.graph_visualizer.metrics).items():
                    metrics_elem.set(key, str(value))
        
        # Add nodes
        nodes_elem = ET.SubElement(root, "nodes")
        for node in self.graph_visualizer.nodes.values():
            node_elem = ET.SubElement(nodes_elem, "node")
            node_elem.set("id", node.id)
            node_elem.set("label", node.label)
            node_elem.set("type", node.node_type.value)
            
            if config.include_positions and node.position:
                node_elem.set("x", str(node.position[0]))
                node_elem.set("y", str(node.position[1]))
            
            # Add data attributes
            for key, value in node.data.items():
                node_elem.set(key, str(value))
        
        # Add edges
        edges_elem = ET.SubElement(root, "edges")
        for edge in self.graph_visualizer.edges.values():
            edge_elem = ET.SubElement(edges_elem, "edge")
            edge_elem.set("id", edge.id)
            edge_elem.set("source", edge.source)
            edge_elem.set("target", edge.target)
            edge_elem.set("type", edge.edge_type.value)
            edge_elem.set("weight", str(edge.weight))
            
            # Add data attributes
            for key, value in edge.data.items():
                edge_elem.set(key, str(value))
        
        return ET.tostring(root, encoding='unicode')
    
    async def _export_dot(self, config: ExportConfig) -> str:
        """Export graph as DOT format."""
        output = StringIO()
        output.write("digraph G {\n")
        output.write("  rankdir=LR;\n")
        output.write("  node [shape=box];\n\n")
        
        # Add nodes
        for node in self.graph_visualizer.nodes.values():
            node_id = node.id.replace("-", "_").replace(" ", "_")
            label = node.label.replace('"', '\\"')
            
            if config.include_positions and node.position:
                output.write(f'  {node_id} [label="{label}", pos="{node.position[0]},{node.position[1]}!"];\n')
            else:
                output.write(f'  {node_id} [label="{label}"];\n')
        
        output.write("\n")
        
        # Add edges
        for edge in self.graph_visualizer.edges.values():
            source_id = edge.source.replace("-", "_").replace(" ", "_")
            target_id = edge.target.replace("-", "_").replace(" ", "_")
            
            if edge.weight > 1.0:
                output.write(f'  {source_id} -> {target_id} [penwidth={edge.weight}];\n')
            else:
                output.write(f'  {source_id} -> {target_id};\n')
        
        output.write("}\n")
        return output.getvalue()
    
    async def _export_gexf(self, config: ExportConfig) -> str:
        """Export graph as GEXF format."""
        root = ET.Element("gexf")
        root.set("xmlns", "http://www.gexf.net/1.2draft")
        root.set("version", "1.2")
        
        # Add meta element
        meta = ET.SubElement(root, "meta")
        meta.set("lastmodifieddate", datetime.utcnow().strftime("%Y-%m-%d"))
        
        # Add graph element
        graph = ET.SubElement(root, "graph")
        graph.set("mode", "static")
        graph.set("defaultedgetype", "directed")
        
        # Add nodes
        nodes = ET.SubElement(graph, "nodes")
        for node in self.graph_visualizer.nodes.values():
            node_elem = ET.SubElement(nodes, "node")
            node_elem.set("id", node.id)
            node_elem.set("label", node.label)
            
            # Add attributes
            attrs = ET.SubElement(node_elem, "attvalues")
            attrs.append(self._create_attvalue("type", node.node_type.value))
            
            for key, value in node.data.items():
                attrs.append(self._create_attvalue(key, str(value)))
        
        # Add edges
        edges = ET.SubElement(graph, "edges")
        for edge in self.graph_visualizer.edges.values():
            edge_elem = ET.SubElement(edges, "edge")
            edge_elem.set("id", edge.id)
            edge_elem.set("source", edge.source)
            edge_elem.set("target", edge.target)
            edge_elem.set("weight", str(edge.weight))
            
            # Add attributes
            attrs = ET.SubElement(edge_elem, "attvalues")
            attrs.append(self._create_attvalue("type", edge.edge_type.value))
            
            for key, value in edge.data.items():
                attrs.append(self._create_attvalue(key, str(value)))
        
        return ET.tostring(root, encoding='unicode')
    
    async def _export_graphml(self, config: ExportConfig) -> str:
        """Export graph as GraphML format."""
        root = ET.Element("graphml")
        root.set("xmlns", "http://graphml.graphdrawing.org/xmlns")
        root.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
        root.set("xsi:schemaLocation", "http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd")
        
        # Add key definitions
        keys = ET.SubElement(root, "keys")
        
        # Node keys
        keys.append(self._create_key("node_type", "string", "node"))
        keys.append(self._create_key("node_label", "string", "node"))
        keys.append(self._create_key("node_x", "double", "node"))
        keys.append(self._create_key("node_y", "double", "node"))
        
        # Edge keys
        keys.append(self._create_key("edge_type", "string", "edge"))
        keys.append(self._create_key("edge_weight", "double", "edge"))
        
        # Add graph element
        graph = ET.SubElement(root, "graph")
        graph.set("id", "G")
        graph.set("edgedefault", "directed")
        
        # Add nodes
        for node in self.graph_visualizer.nodes.values():
            node_elem = ET.SubElement(graph, "node")
            node_elem.set("id", node.id)
            
            # Add data elements
            node_elem.append(self._create_data("node_type", node.node_type.value))
            node_elem.append(self._create_data("node_label", node.label))
            
            if config.include_positions and node.position:
                node_elem.append(self._create_data("node_x", str(node.position[0])))
                node_elem.append(self._create_data("node_y", str(node.position[1])))
        
        # Add edges
        for edge in self.graph_visualizer.edges.values():
            edge_elem = ET.SubElement(graph, "edge")
            edge_elem.set("id", edge.id)
            edge_elem.set("source", edge.source)
            edge_elem.set("target", edge.target)
            
            # Add data elements
            edge_elem.append(self._create_data("edge_type", edge.edge_type.value))
            edge_elem.append(self._create_data("edge_weight", str(edge.weight)))
        
        return ET.tostring(root, encoding='unicode')
    
    def _create_attvalue(self, key: str, value: str) -> ET.Element:
        """Create an attvalue element."""
        attvalue = ET.Element("attvalue")
        attvalue.set("for", key)
        attvalue.set("value", value)
        return attvalue
    
    def _create_key(self, id: str, attr_type: str, for_type: str) -> ET.Element:
        """Create a key element."""
        key = ET.Element("key")
        key.set("id", id)
        key.set("attr.name", id)
        key.set("attr.type", attr_type)
        key.set("for", for_type)
        return key
    
    def _create_data(self, key: str, value: str) -> ET.Element:
        """Create a data element."""
        data = ET.Element("data")
        data.set("key", key)
        data.text = value
        return data


class ChartExporter:
    """Exporter for chart data."""
    
    def __init__(self, dashboard: VisualizationDashboard):
        """Initialize chart exporter."""
        self.dashboard = dashboard
    
    async def export_chart_data(self, widget_id: str, config: ExportConfig) -> Union[str, bytes]:
        """Export chart data from a widget."""
        if widget_id not in self.dashboard.widgets:
            raise ValueError(f"Widget {widget_id} not found")
        
        widget = self.dashboard.widgets[widget_id]
        
        if config.format == ExportFormat.JSON:
            return await self._export_chart_json(widget, config)
        elif config.format == ExportFormat.CSV:
            return await self._export_chart_csv(widget, config)
        elif config.format == ExportFormat.HTML:
            return await self._export_chart_html(widget, config)
        else:
            raise ValueError(f"Unsupported chart export format: {config.format}")
    
    async def _export_chart_json(self, widget: Any, config: ExportConfig) -> str:
        """Export chart data as JSON."""
        export_data = {
            "metadata": {
                "widget_id": widget.id,
                "widget_title": widget.title,
                "widget_type": widget.widget_type.value,
                "export_timestamp": datetime.utcnow().isoformat(),
                "format": "json"
            },
            "data": widget.data or {},
            "config": widget.config
        }
        
        return json.dumps(export_data, indent=2)
    
    async def _export_chart_csv(self, widget: Any, config: ExportConfig) -> str:
        """Export chart data as CSV."""
        if not widget.data:
            return ""
        
        output = StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(["widget_id", "widget_title", "widget_type", "data_key", "data_value"])
        
        # Write data
        for key, value in widget.data.items():
            if isinstance(value, (list, dict)):
                value = json.dumps(value)
            writer.writerow([widget.id, widget.title, widget.widget_type.value, key, value])
        
        return output.getvalue()
    
    async def _export_chart_html(self, widget: Any, config: ExportConfig) -> str:
        """Export chart as HTML."""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>{widget.title}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .widget {{ border: 1px solid #ccc; padding: 20px; margin: 10px 0; }}
                .metadata {{ background-color: #f5f5f5; padding: 10px; margin-bottom: 20px; }}
                .data {{ background-color: #fff; padding: 10px; }}
                pre {{ background-color: #f8f8f8; padding: 10px; overflow-x: auto; }}
            </style>
        </head>
        <body>
            <div class="widget">
                <h1>{widget.title}</h1>
                <div class="metadata">
                    <h3>Widget Information</h3>
                    <p><strong>ID:</strong> {widget.id}</p>
                    <p><strong>Type:</strong> {widget.widget_type.value}</p>
                    <p><strong>Export Time:</strong> {datetime.utcnow().isoformat()}</p>
                </div>
                <div class="data">
                    <h3>Data</h3>
                    <pre>{json.dumps(widget.data, indent=2) if widget.data else 'No data available'}</pre>
                </div>
                <div class="data">
                    <h3>Configuration</h3>
                    <pre>{json.dumps(widget.config, indent=2)}</pre>
                </div>
            </div>
        </body>
        </html>
        """
        return html


class ReportExporter:
    """Exporter for comprehensive reports."""
    
    def __init__(self, graph_visualizer: DependencyGraphVisualizer, dashboard: VisualizationDashboard):
        """Initialize report exporter."""
        self.graph_visualizer = graph_visualizer
        self.dashboard = dashboard
        self.graph_exporter = GraphExporter(graph_visualizer)
        self.chart_exporter = ChartExporter(dashboard)
    
    async def export_comprehensive_report(self, config: ExportConfig, analytics_results: Optional[Dict[str, AnalyticsResult]] = None) -> Union[str, bytes]:
        """Export a comprehensive report."""
        if config.format == ExportFormat.HTML:
            return await self._export_html_report(config, analytics_results)
        elif config.format == ExportFormat.PDF:
            return await self._export_pdf_report(config, analytics_results)
        elif config.format == ExportFormat.JSON:
            return await self._export_json_report(config, analytics_results)
        else:
            raise ValueError(f"Unsupported report format: {config.format}")
    
    async def _export_html_report(self, config: ExportConfig, analytics_results: Optional[Dict[str, AnalyticsResult]] = None) -> str:
        """Export report as HTML."""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dependency Graph Report</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }}
                .header {{ background-color: #2c3e50; color: white; padding: 20px; text-align: center; }}
                .section {{ margin: 20px 0; padding: 20px; border: 1px solid #ddd; }}
                .metrics {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }}
                .metric {{ background-color: #f8f9fa; padding: 15px; text-align: center; }}
                .metric-value {{ font-size: 2em; font-weight: bold; color: #2c3e50; }}
                .metric-label {{ color: #666; margin-top: 5px; }}
                .insights {{ background-color: #e8f5e8; padding: 15px; margin: 10px 0; }}
                .recommendations {{ background-color: #fff3cd; padding: 15px; margin: 10px 0; }}
                .widget {{ margin: 20px 0; padding: 15px; border: 1px solid #ccc; }}
                pre {{ background-color: #f8f8f8; padding: 10px; overflow-x: auto; }}
                table {{ width: 100%; border-collapse: collapse; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Dependency Graph Analysis Report</h1>
                <p>Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
        """
        
        # Add graph summary
        if self.graph_visualizer.metrics:
            html += f"""
            <div class="section">
                <h2>Graph Summary</h2>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value">{self.graph_visualizer.metrics.total_nodes}</div>
                        <div class="metric-label">Total Nodes</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">{self.graph_visualizer.metrics.total_edges}</div>
                        <div class="metric-label">Total Edges</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">{self.graph_visualizer.metrics.vulnerability_count}</div>
                        <div class="metric-label">Vulnerabilities</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">{self.graph_visualizer.metrics.risk_score:.2f}</div>
                        <div class="metric-label">Risk Score</div>
                    </div>
                </div>
            </div>
            """
        
        # Add analytics results
        if analytics_results:
            html += """
            <div class="section">
                <h2>Analytics Results</h2>
            """
            
            for analytics_type, result in analytics_results.items():
                html += f"""
                <div class="widget">
                    <h3>{analytics_type.replace('_', ' ').title()}</h3>
                    <p><strong>Confidence:</strong> {result.confidence:.2f}</p>
                    
                    <h4>Insights</h4>
                    <div class="insights">
                        <ul>
                """
                for insight in result.insights:
                    html += f"<li>{insight}</li>"
                
                html += """
                        </ul>
                    </div>
                    
                    <h4>Recommendations</h4>
                    <div class="recommendations">
                        <ul>
                """
                for recommendation in result.recommendations:
                    html += f"<li>{recommendation}</li>"
                
                html += """
                        </ul>
                    </div>
                </div>
                """
            
            html += "</div>"
        
        # Add dashboard widgets
        html += """
        <div class="section">
            <h2>Dashboard Widgets</h2>
        """
        
        for widget in self.dashboard.widgets.values():
            html += f"""
            <div class="widget">
                <h3>{widget.title}</h3>
                <p><strong>Type:</strong> {widget.widget_type.value}</p>
                <p><strong>Last Updated:</strong> {widget.last_updated.isoformat() if widget.last_updated else 'Never'}</p>
                <h4>Data</h4>
                <pre>{json.dumps(widget.data, indent=2) if widget.data else 'No data available'}</pre>
            </div>
            """
        
        html += "</div>"
        
        # Add graph data
        if config.include_metadata:
            html += f"""
            <div class="section">
                <h2>Graph Data</h2>
                <h3>Node Types Distribution</h3>
                <table>
                    <tr><th>Node Type</th><th>Count</th></tr>
            """
            
            if self.graph_visualizer.metrics:
                for node_type, count in self.graph_visualizer.metrics.node_types.items():
                    html += f"<tr><td>{node_type}</td><td>{count}</td></tr>"
            
            html += """
                </table>
                
                <h3>Edge Types Distribution</h3>
                <table>
                    <tr><th>Edge Type</th><th>Count</th></tr>
            """
            
            if self.graph_visualizer.metrics:
                for edge_type, count in self.graph_visualizer.metrics.edge_types.items():
                    html += f"<tr><td>{edge_type}</td><td>{count}</td></tr>"
            
            html += """
                </table>
            </div>
            """
        
        html += """
        </body>
        </html>
        """
        
        return html
    
    async def _export_pdf_report(self, config: ExportConfig, analytics_results: Optional[Dict[str, AnalyticsResult]] = None) -> bytes:
        """Export report as PDF."""
        # This would require a PDF library like reportlab or weasyprint
        # For now, we'll return a placeholder
        html_content = await self._export_html_report(config, analytics_results)
        
        # In a real implementation, you would convert HTML to PDF here
        # For now, return the HTML content as bytes
        return html_content.encode('utf-8')
    
    async def _export_json_report(self, config: ExportConfig, analytics_results: Optional[Dict[str, AnalyticsResult]] = None) -> str:
        """Export report as JSON."""
        report_data = {
            "metadata": {
                "export_timestamp": datetime.utcnow().isoformat(),
                "format": "json",
                "version": "1.0"
            },
            "graph_summary": asdict(self.graph_visualizer.metrics) if self.graph_visualizer.metrics else None,
            "dashboard_summary": await self.dashboard.get_dashboard_summary(),
            "analytics_results": {}
        }
        
        # Add analytics results
        if analytics_results:
            for analytics_type, result in analytics_results.items():
                report_data["analytics_results"][analytics_type] = {
                    "insights": result.insights,
                    "recommendations": result.recommendations,
                    "confidence": result.confidence,
                    "timestamp": result.timestamp.isoformat()
                }
        
        # Add widget data
        report_data["widgets"] = {}
        for widget_id, widget in self.dashboard.widgets.items():
            report_data["widgets"][widget_id] = {
                "title": widget.title,
                "type": widget.widget_type.value,
                "data": widget.data,
                "config": widget.config,
                "last_updated": widget.last_updated.isoformat() if widget.last_updated else None
            }
        
        return json.dumps(report_data, indent=2)







