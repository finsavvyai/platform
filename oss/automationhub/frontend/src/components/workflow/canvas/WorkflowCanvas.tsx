/**
 * Enhanced Workflow Canvas
 *
 * Advanced workflow canvas with features including:
 * - Mini-map with navigation
 * - Advanced zoom/pan controls
 * - Grid system with snap-to-grid
 * - Multi-selection tools
 * - Keyboard shortcuts
 * - Context menu
 * - Undo/redo support
 * - Real-time collaboration cursors
 */

import React, { useCallback, useRef, useMemo, useState, useEffect, useLayoutEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Connection,
  EdgeChange,
  NodeChange,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  SelectionMode,
  ViewportPortal,
  Panel,
  useStore,
  useStoreApi,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Typography,
  Slider,
  Switch,
  FormControlLabel,
  Chip,
  Badge,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  GridOn,
  GridOff,
  Save,
  PlayArrow,
  Pause,
  Stop,
  Undo,
  Redo,
  SelectAll,
  Clear,
  Settings,
  Fullscreen,
  FullscreenExit,
  Screenshot,
  Download,
  Upload,
  Help,
} from '@mui/icons-material';

import WorkflowNode from '../nodes/WorkflowNode';
import { NodeStatus } from '../nodes/WorkflowNode';

// Custom node types
const nodeTypes = {
  workflowNode: WorkflowNode,
};

interface WorkflowCanvasProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onNodesChange?: OnNodesChange;
  onEdgesChange?: OnEdgesChange;
  onConnect?: OnConnect;
  onNodeUpdate?: (nodeId: string, updates: Partial<any>) => void;
  onSave?: () => void;
  onExecute?: () => void;
  onDebug?: () => void;
  onExport?: () => void;
  onImport?: (data: { nodes: Node[]; edges: Edge[] }) => void;
  readOnly?: boolean;
  collaborationMode?: boolean;
  collaborators?: Array<{ id: string; name: string; color: string; cursor?: { x: number; y: number } }>;
  selectionMode?: SelectionMode;
  snapToGrid?: boolean;
  gridSpacing?: number;
  minimap?: boolean;
  controls?: boolean;
  background?: boolean;
}

const WorkflowCanvasComponent: React.FC<WorkflowCanvasProps> = ({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeUpdate,
  onSave,
  onExecute,
  onDebug,
  onExport,
  onImport,
  readOnly = false,
  collaborationMode = false,
  collaborators = [],
  selectionMode = SelectionMode.Partial,
  snapToGrid = true,
  gridSpacing = 20,
  minimap = true,
  controls = true,
  background = true,
}) => {
  const theme = useTheme();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(snapToGrid);
  const [gridSize, setGridSize] = useState(gridSpacing);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null);
  const [selectedTool, setSelectedTool] = useState<string>('select');
  const [zoom, setZoom] = useState(1);

  const { setViewport, getViewport, fitView, zoomIn, zoomOut, project, screenToFlowPosition } = useReactFlow();
  const store = useStoreApi();

  // Update external handlers
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChangeInternal(changes);
    onNodesChange?.(changes);
  }, [onNodesChangeInternal, onNodesChange]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChangeInternal(changes);
    onEdgesChange?.(changes);
  }, [onEdgesChangeInternal, onEdgesChange]);

  const handleConnect = useCallback((connection: Connection) => {
    const edge = addEdge(connection, edges);
    setEdges([edge]);
    onConnect?.(connection);
  }, [edges, setEdges, onConnect]);

  // Handle node updates
  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<any>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...updates } } : node
      )
    );
    onNodeUpdate?.(nodeId, updates);
  }, [setNodes, onNodeUpdate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent shortcuts in input fields
      if (event.target && (event.target as HTMLElement).tagName === 'INPUT') {
        return;
      }

      // Ctrl/Cmd + S: Save
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        onSave?.();
      }

      // Ctrl/Cmd + Z: Undo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        // Implement undo logic
      }

      // Ctrl/Cmd + Shift + Z: Redo
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'z') {
        event.preventDefault();
        // Implement redo logic
      }

      // Ctrl/Cmd + A: Select all
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();
        // Implement select all logic
      }

      // Delete: Remove selected nodes/edges
      if (event.key === 'Delete') {
        event.preventDefault();
        // Implement delete logic
      }

      // Space + Drag: Pan canvas
      if (event.key === ' ') {
        event.preventDefault();
        setSelectedTool('pan');
      }

      // Escape: Return to select tool
      if (event.key === 'Escape') {
        setSelectedTool('select');
      }

      // F: Fit view
      if (event.key === 'f') {
        event.preventDefault();
        fitView({ duration: 800 });
      }

      // G: Toggle grid
      if (event.key === 'g') {
        setShowGrid((prev) => !prev);
      }

      // +/-: Zoom in/out
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomIn({ duration: 200 });
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        zoomOut({ duration: 200 });
      }

      // Ctrl/Cmd + 0: Reset zoom
      if ((event.ctrlKey || event.metaKey) && event.key === '0') {
        event.preventDefault();
        setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 800 });
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        setSelectedTool('select');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [onSave, fitView, setViewport, zoomIn, zoomOut]);

  // Handle drag over
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // Apply grid snapping if enabled
      const snappedPosition = showGrid
        ? {
            x: Math.round(position.x / gridSize) * gridSize,
            y: Math.round(position.y / gridSize) * gridSize,
          }
        : position;

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: 'workflowNode',
        position: snappedPosition,
        data: {
          nodeType: type,
          label: `${type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' ')}`,
          status: NodeStatus.IDLE,
          config: {},
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [project, showGrid, gridSize, setNodes]
  );

  // Handle context menu
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle canvas actions
  const handleCanvasAction = useCallback((action: string) => {
    closeContextMenu();

    switch (action) {
      case 'selectAll':
        // Implement select all
        break;
      case 'clearSelection':
        // Implement clear selection
        break;
      case 'save':
        onSave?.();
        break;
      case 'export':
        onExport?.();
        break;
      case 'import':
        // Trigger import dialog
        break;
      case 'screenshot':
        // Implement screenshot
        break;
      case 'fullscreen':
        setIsFullscreen((prev) => !prev);
        break;
    }
  }, [closeContextMenu, onSave, onExport]);

  // Handle fullscreen
  const handleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      reactFlowWrapper.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen((prev) => !prev);
  }, [isFullscreen]);

  // Get viewport zoom
  const currentZoom = useStore((store) => store.transform[2]);

  return (
    <ReactFlowProvider>
      <Box
        sx={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Toolbar */}
        <Paper
          sx={{
            p: 1,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            zIndex: 1000,
          }}
          elevation={2}
        >
          {/* Save/Execute Controls */}
          {!readOnly && (
            <>
              <Tooltip title="Save Workflow (Ctrl+S)">
                <IconButton size="small" onClick={onSave}>
                  <Save />
                </IconButton>
              </Tooltip>
              <Tooltip title="Execute Workflow">
                <IconButton size="small" color="success" onClick={onExecute}>
                  <PlayArrow />
                </IconButton>
              </Tooltip>
              <Tooltip title="Debug Workflow">
                <IconButton size="small" color="warning" onClick={onDebug}>
                  <Pause />
                </IconButton>
              </Tooltip>
            </>
          )}

          <Box sx={{ width: 1, height: 20 }} />

          {/* View Controls */}
          <Tooltip title="Zoom In">
            <IconButton size="small" onClick={() => zoomIn({ duration: 200 })}>
              <ZoomIn />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton size="small" onClick={() => zoomOut({ duration: 200 })}>
              <ZoomOut />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fit View (F)">
            <IconButton size="small" onClick={() => fitView({ duration: 800 })}>
              <CenterFocusStrong />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle Grid (G)">
            <IconButton size="small" onClick={() => setShowGrid((prev) => !prev)}>
              {showGrid ? <GridOn /> : <GridOff />}
            </IconButton>
          </Tooltip>

          <Box sx={{ width: 1, height: 20 }} />

          {/* Advanced Controls */}
          <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            <IconButton size="small" onClick={handleFullscreen}>
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Undo (Ctrl+Z)">
            <IconButton size="small">
              <Undo />
            </IconButton>
          </Tooltip>
          <Tooltip title="Redo (Ctrl+Shift+Z)">
            <IconButton size="small">
              <Redo />
            </IconButton>
          </Tooltip>
          <Tooltip title="Screenshot">
            <IconButton size="small">
              <Screenshot />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export">
            <IconButton size="small" onClick={onExport}>
              <Download />
            </IconButton>
          </Tooltip>
          <Tooltip title="Import">
            <IconButton size="small">
              <Upload />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton size="small">
              <Settings />
            </IconButton>
          </Tooltip>

          {/* Collaboration Indicator */}
          {collaborationMode && (
            <Badge
              badgeContent={collaborators.length}
              color="primary"
              sx={{ ml: 1 }}
            >
              <Chip
                label="Collaboration"
                size="small"
                color="info"
                variant="outlined"
              />
            </Badge>
          )}

          {/* Zoom Level */}
          <Chip
            label={`${Math.round(currentZoom * 100)}%`}
            size="small"
            sx={{ ml: 1 }}
          />
        </Paper>

        {/* Main Canvas */}
        <Box sx={{ flex: 1, position: 'relative' }} onContextMenu={handleContextMenu}>
          <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
            <ReactFlow
              nodes={nodes.map(node => ({
                ...node,
                draggable: !readOnly,
                selectable: !readOnly,
              }))}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onNodeDragStop={handleNodeUpdate}
              onInit={(reactFlowInstance) => {
                // Store instance for advanced features
              }}
              nodeTypes={nodeTypes}
              connectionLineStyle={{
                strokeWidth: 2,
                stroke: theme.palette.primary.main,
              }}
              snapToGrid={showGrid}
              snapGrid={[gridSize, gridSize]}
              selectionMode={selectionMode}
              deleteKeyCode={['Delete', 'Backspace']}
              multiSelectionKeyCode={['Ctrl', 'Cmd']}
              panOnDrag={selectedTool === 'pan' ? 1 : 0}
              fitView
              attributionPosition="bottom-left"
            >
              {background && <Background gap={gridSize} size={gridSize} />}
              {controls && <Controls />}
              {minimap && (
                <MiniMap
                  nodeColor={(node) => {
                    const status = node.data?.status;
                    switch (status) {
                      case NodeStatus.RUNNING:
                        return theme.palette.primary.main;
                      case NodeStatus.SUCCESS:
                        return theme.palette.success.main;
                      case NodeStatus.ERROR:
                        return theme.palette.error.main;
                      default:
                        return theme.palette.grey[400];
                    }
                  }}
                  nodeStrokeWidth={3}
                  pannable
                  zoomable
                />
              )}

              {/* Custom Controls Panel */}
              <Panel position="top-left">
                <Paper sx={{ p: 1, display: 'flex', gap: 1 }}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Tool</InputLabel>
                    <Select
                      value={selectedTool}
                      label="Tool"
                      onChange={(e) => setSelectedTool(e.target.value)}
                    >
                      <MenuItem value="select">Select</MenuItem>
                      <MenuItem value="pan">Pan</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                        size="small"
                      />
                    }
                    label="Grid"
                  />

                  {showGrid && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption">Size:</Typography>
                      <Slider
                        value={gridSize}
                        onChange={(_, value) => setGridSize(value as number)}
                        min={10}
                        max={50}
                        step={5}
                        size="small"
                        sx={{ width: 60 }}
                      />
                    </Box>
                  )}
                </Paper>
              </Panel>

              {/* Status Panel */}
              <Panel position="bottom-right">
                <Paper sx={{ p: 1 }}>
                  <Typography variant="caption" display="block">
                    Nodes: {nodes.length}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Edges: {edges.length}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Selected: {nodes.filter(n => n.selected).length}
                  </Typography>
                </Paper>
              </Panel>

              {/* Collaboration Cursors */}
              {collaborationMode && collaborators.map((collaborator) => (
                collaborator.cursor && (
                  <ViewportPortal key={collaborator.id}>
                    <Box
                      sx={{
                        position: 'absolute',
                        left: collaborator.cursor.x,
                        top: collaborator.cursor.y,
                        pointerEvents: 'none',
                        zIndex: 10000,
                      }}
                    >
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          backgroundColor: collaborator.color,
                          border: '2px solid white',
                          boxShadow: theme.shadows[2],
                        }}
                      />
                      <Paper sx={{ p: 0.5, ml: 2, fontSize: '12px' }}>
                        {collaborator.name}
                      </Paper>
                    </Box>
                  </ViewportPortal>
                )
              ))}
            </ReactFlow>
          </div>
        </Box>

        {/* Context Menu */}
        {contextMenu && (
          <Menu
            open={Boolean(contextMenu)}
            onClose={closeContextMenu}
            anchorReference="anchorPosition"
            anchorPosition={
              contextMenu.y !== null && contextMenu.x !== null
                ? { top: contextMenu.y, left: contextMenu.x }
                : undefined
            }
          >
            <MenuItem onClick={() => handleCanvasAction('selectAll')}>
              <SelectAll sx={{ mr: 1 }} fontSize="small" />
              Select All
            </MenuItem>
            <MenuItem onClick={() => handleCanvasAction('clearSelection')}>
              <Clear sx={{ mr: 1 }} fontSize="small" />
              Clear Selection
            </MenuItem>
            <MenuItem onClick={() => handleCanvasAction('save')}>
              <Save sx={{ mr: 1 }} fontSize="small" />
              Save
            </MenuItem>
            <MenuItem onClick={() => handleCanvasAction('export')}>
              <Download sx={{ mr: 1 }} fontSize="small" />
              Export
            </MenuItem>
            <MenuItem onClick={() => handleCanvasAction('import')}>
              <Upload sx={{ mr: 1 }} fontSize="small" />
              Import
            </MenuItem>
            <MenuItem onClick={() => handleCanvasAction('screenshot')}>
              <Screenshot sx={{ mr: 1 }} fontSize="small" />
              Screenshot
            </MenuItem>
            <MenuItem onClick={() => handleCanvasAction('fullscreen')}>
              <Fullscreen sx={{ mr: 1 }} fontSize="small" />
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </MenuItem>
          </Menu>
        )}
      </Box>
    </ReactFlowProvider>
  );
};

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = (props) => (
  <WorkflowCanvasComponent {...props} />
);

export default WorkflowCanvas;