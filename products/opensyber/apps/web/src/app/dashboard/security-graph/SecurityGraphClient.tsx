'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Network } from 'lucide-react';
import type { NodeType, GraphData } from './graph-types';
import { ALL_NODE_TYPES } from './graph-types';
import { applyForceLayout, applyHierarchicalLayout, filterNodes, getGraphStats } from './graph-utils';
import { GraphStatsBar } from './GraphStatsBar';
import { GraphControls } from './GraphControls';
import { GraphSvg } from './GraphSvg';
import { GraphDetailPanel } from './GraphDetailPanel';

export function SecurityGraphClient() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTypes, setActiveTypes] = useState<Set<NodeType>>(new Set(ALL_NODE_TYPES));
  const [layout, setLayout] = useState<'force' | 'hierarchical'>('force');
  const [highlightRisks, setHighlightRisks] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/proxy/security/graph')
      .then((r) => r.json())
      .then((d) => {
        if (d?.data?.nodes?.length) {
          setGraphData(d.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredNodes = useMemo(
    () => filterNodes(graphData.nodes, activeTypes, search),
    [graphData.nodes, activeTypes, search],
  );

  const visibleIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(
    () => graphData.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [graphData.edges, visibleIds],
  );

  const positioned = useMemo(
    () => layout === 'force'
      ? applyForceLayout(filteredNodes, filteredEdges)
      : applyHierarchicalLayout(filteredNodes),
    [filteredNodes, filteredEdges, layout],
  );

  const stats = useMemo(
    () => getGraphStats(filteredNodes, filteredEdges),
    [filteredNodes, filteredEdges],
  );

  const selectedNode = selectedNodeId
    ? graphData.nodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  const handleToggleType = useCallback((t: NodeType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    const svg = graphContainerRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, 1200, 800);
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = 'security-graph.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  }, []);

  const isEmpty = !loading && graphData.nodes.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Security Graph</h1>
        <p className="mt-2 text-neutral-400">
          Interactive topology of all cloud resources and their relationships
        </p>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <Network className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Security Graph Data Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start seeing your security graph. Data will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <GraphStatsBar {...stats} />

          <div className="flex gap-6">
            <div className="w-72 flex-shrink-0">
              <GraphControls
                search={search}
                onSearchChange={setSearch}
                activeTypes={activeTypes}
                onToggleType={handleToggleType}
                layout={layout}
                onLayoutChange={setLayout}
                highlightRisks={highlightRisks}
                onToggleRisks={() => setHighlightRisks((v) => !v)}
                onExport={handleExport}
              />
            </div>

            <div className="flex min-h-[600px] flex-1 overflow-hidden rounded-xl" ref={graphContainerRef}>
              <div className="flex-1">
                <GraphSvg
                  nodes={positioned}
                  edges={filteredEdges}
                  highlightRisks={highlightRisks}
                  onSelectNode={setSelectedNodeId}
                  selectedNodeId={selectedNodeId}
                />
              </div>
              {selectedNode && (
                <GraphDetailPanel
                  node={selectedNode}
                  edges={graphData.edges}
                  allNodes={graphData.nodes}
                  onClose={() => setSelectedNodeId(null)}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
