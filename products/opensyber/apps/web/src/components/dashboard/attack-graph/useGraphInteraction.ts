'use client';

import { useState, useCallback, useRef, type WheelEvent, type MouseEvent } from 'react';

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DragState {
  dragging: boolean;
  startX: number;
  startY: number;
  startViewX: number;
  startViewY: number;
}

interface GraphInteraction {
  viewBox: ViewBox;
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onWheel: (e: WheelEvent<SVGSVGElement>) => void;
  onMouseDown: (e: MouseEvent<SVGSVGElement>) => void;
  onMouseMove: (e: MouseEvent<SVGSVGElement>) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onNodeHover: (nodeId: string | null) => void;
  onNodeClick: (nodeId: string) => void;
  onDismissTooltip: () => void;
  resetView: () => void;
}

const ZOOM_FACTOR = 0.1;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

export function useGraphInteraction(
  baseWidth: number,
  baseHeight: number,
): GraphInteraction {
  const defaultVb: ViewBox = { x: 0, y: 0, w: baseWidth, h: baseHeight };
  const [viewBox, setViewBox] = useState<ViewBox>(defaultVb);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState>({
    dragging: false, startX: 0, startY: 0, startViewX: 0, startViewY: 0,
  });

  const onWheel = useCallback((e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    setViewBox((prev) => {
      const direction = e.deltaY > 0 ? 1 : -1;
      const factor = 1 + direction * ZOOM_FACTOR;
      const newW = Math.max(baseWidth * MIN_ZOOM, Math.min(baseWidth * MAX_ZOOM, prev.w * factor));
      const newH = Math.max(baseHeight * MIN_ZOOM, Math.min(baseHeight * MAX_ZOOM, prev.h * factor));
      const ratio = newW / prev.w;
      const svg = svgRef.current;
      let cx = prev.x + prev.w / 2;
      let cy = prev.y + prev.h / 2;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width;
        const my = (e.clientY - rect.top) / rect.height;
        cx = prev.x + mx * prev.w;
        cy = prev.y + my * prev.h;
      }
      return {
        x: cx - (cx - prev.x) * ratio,
        y: cy - (cy - prev.y) * ratio,
        w: newW,
        h: newH,
      };
    });
  }, [baseWidth, baseHeight]);

  const onMouseDown = useCallback((e: MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      dragging: true, startX: e.clientX, startY: e.clientY,
      startViewX: viewBox.x, startViewY: viewBox.y,
    };
  }, [viewBox.x, viewBox.y]);

  const onMouseMove = useCallback((e: MouseEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d.dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - d.startX) / rect.width) * viewBox.w;
    const dy = ((e.clientY - d.startY) / rect.height) * viewBox.h;
    setViewBox((prev) => ({ ...prev, x: d.startViewX - dx, y: d.startViewY - dy }));
  }, [viewBox.w, viewBox.h]);

  const onMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  const onMouseLeave = useCallback(() => {
    dragRef.current.dragging = false;
    setHoveredNodeId(null);
  }, []);

  const onNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);
  }, []);

  const onNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const onDismissTooltip = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const resetView = useCallback(() => {
    setViewBox({ x: 0, y: 0, w: baseWidth, h: baseHeight });
  }, [baseWidth, baseHeight]);

  return {
    viewBox, hoveredNodeId, selectedNodeId, svgRef,
    onWheel, onMouseDown, onMouseMove, onMouseUp, onMouseLeave,
    onNodeHover, onNodeClick, onDismissTooltip, resetView,
  };
}
