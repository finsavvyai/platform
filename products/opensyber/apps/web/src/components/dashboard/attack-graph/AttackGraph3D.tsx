'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * 3D Attack Graph Visualization
 *
 * Renders attack paths as a 3D force-directed graph using Canvas 2D
 * with perspective projection. Lightweight alternative to Three.js
 * that works in SSR-friendly Next.js without heavy 3D dependencies.
 *
 * Nodes = assets, edges = attack paths, color = severity.
 */

export interface GraphNode {
  id: string;
  label: string;
  type: 'asset' | 'vulnerability' | 'entry' | 'crown-jewel';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  x?: number;
  y?: number;
  z?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  label?: string;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width?: number;
  height?: number;
}

const NODE_COLORS: Record<string, string> = {
  'crown-jewel': '#EF4444',
  entry: '#3B82F6',
  vulnerability: '#F59E0B',
  asset: '#6B7280',
};

const SEVERITY_GLOW: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#22C55E',
};

export function AttackGraph3D({ nodes, edges, width = 600, height = 400 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const animRef = useRef<number>(0);

  const initPositions = useCallback(() => {
    return nodes.map((n) => ({
      ...n,
      x: n.x ?? (Math.random() - 0.5) * 200,
      y: n.y ?? (Math.random() - 0.5) * 200,
      z: n.z ?? (Math.random() - 0.5) * 200,
    }));
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const positioned = initPositions();

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#0A0A0A';
      ctx.fillRect(0, 0, width, height);

      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const cx = width / 2;
      const cy = height / 2;
      const focalLength = 400 * zoom;

      const project = (x: number, y: number, z: number) => {
        const rx = x * cos - z * sin;
        const rz = x * sin + z * cos;
        const scale = focalLength / (focalLength + rz);
        return { px: cx + rx * scale, py: cy + y * scale, scale };
      };

      // Draw edges
      ctx.lineWidth = 1;
      for (const edge of edges) {
        const s = positioned.find((n) => n.id === edge.source);
        const t = positioned.find((n) => n.id === edge.target);
        if (!s || !t) continue;
        const sp = project(s.x, s.y, s.z);
        const tp = project(t.x, t.y, t.z);
        ctx.strokeStyle = `rgba(82, 82, 82, ${0.3 + edge.weight * 0.5})`;
        ctx.beginPath();
        ctx.moveTo(sp.px, sp.py);
        ctx.lineTo(tp.px, tp.py);
        ctx.stroke();
      }

      // Draw nodes (sorted by z for depth ordering)
      const projected = positioned.map((n) => ({
        ...n,
        ...project(n.x, n.y, n.z),
      }));
      projected.sort((a, b) => b.scale - a.scale);

      for (const n of projected) {
        const radius = Math.max(3, 6 * n.scale);
        const color = NODE_COLORS[n.type] ?? '#6B7280';

        if (n.severity && SEVERITY_GLOW[n.severity]) {
          ctx.shadowColor = SEVERITY_GLOW[n.severity];
          ctx.shadowBlur = 8 * n.scale;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.px, n.py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (n.scale > 0.7) {
          ctx.fillStyle = '#A3A3A3';
          ctx.font = `${Math.max(8, 10 * n.scale)}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(n.label, n.px, n.py - radius - 4);
        }
      }

      setRotation((r) => r + 0.003);
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes, edges, width, height, zoom, rotation, initPositions]);

  return (
    <div className="relative rounded border border-border bg-panel/30 overflow-hidden">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full"
        style={{ height }}
      />
      <div className="absolute bottom-3 right-3 flex gap-1">
        <button
          onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
          className="rounded bg-surface/80 p-1.5 text-text-dim hover:text-text-primary"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))}
          className="rounded bg-surface/80 p-1.5 text-text-dim hover:text-text-primary"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setRotation(0)}
          className="rounded bg-surface/80 p-1.5 text-text-dim hover:text-text-primary"
          aria-label="Reset rotation"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
